import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, ChevronRight, Users, Sparkles } from 'lucide-react'
import { CriarCelulaDialog } from '@/components/supervisor/criar-celula-dialog'
import { CriarEventoDialog } from '@/components/shared/criar-evento-dialog'
import { format, isThisWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type CelulaRow = { id: string; nome: string; logo_url: string | null; ativa: boolean }

export default async function RedeDetalhesPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const canView = ['supervisor', 'supervisor_treinamento', 'pastor', 'admin'].includes(profile.role)
  if (!canView) redirect('/home')

  // Supervisors: check rede access
  if (profile.role === 'supervisor' || profile.role === 'supervisor_treinamento') {
    const { data: acesso } = await supabase
      .from('rede_supervisores')
      .select('rede_id')
      .eq('rede_id', params.id)
      .eq('supervisor_id', user.id)
      .maybeSingle()
    if (!acesso) redirect('/supervisor')
  }

  const { data: redeData } = await supabase
    .from('redes')
    .select('id, nome, descricao, cor, supervisor_nome')
    .eq('id', params.id)
    .single()

  if (!redeData) notFound()
  const rede = redeData as { id: string; nome: string; descricao: string | null; cor: string; supervisor_nome: string | null }

  const { data: celulasData } = await supabase
    .from('celulas')
    .select('id, nome, logo_url, ativa')
    .eq('rede_id', params.id)
    .neq('ativa', false)
    .order('nome')

  const celulas = (celulasData ?? []) as CelulaRow[]
  const celulaIds = celulas.map((c) => c.id)

  const [
    { data: membrosData },
    { data: encontrosData },
    { data: supData },
    { data: lideresData },
    { data: eventosRedeData },
  ] = await Promise.all([
    celulaIds.length > 0
      ? supabase.from('celula_membros').select('celula_id, user_id, papel').in('celula_id', celulaIds)
      : Promise.resolve({ data: [] }),
    celulaIds.length > 0
      ? supabase
          .from('encontros')
          .select('id, celula_id, data_hora, status')
          .in('celula_id', celulaIds)
          .eq('status', 'agendado')
          .gte('data_hora', new Date().toISOString())
          .order('data_hora', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from('rede_supervisores')
      .select('supervisor_id')
      .eq('rede_id', params.id),
    Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    supabase
      .from('eventos')
      .select('id, titulo, data_hora, local, imagem_url')
      .eq('rede_id', params.id)
      .gte('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: true })
      .limit(10),
  ])

  type MembroRow = { celula_id: string; user_id: string; papel: string }
  type EncontroRow = { id: string; celula_id: string; data_hora: string; status: string }
  type EventoRedeRow = { id: string; titulo: string; data_hora: string; local: string | null; imagem_url: string | null }

  const eventosRede = (eventosRedeData ?? []) as EventoRedeRow[]

  const membros = (membrosData ?? []) as MembroRow[]
  const encontros = (encontrosData ?? []) as EncontroRow[]

  // Supervisor names
  const supIds = (supData ?? []).map((s: { supervisor_id: string }) => s.supervisor_id)
  const { data: supProfiles } = supIds.length > 0
    ? await supabase.from('profiles').select('id, nome, avatar_url').in('id', supIds)
    : { data: [] }

  const supervisores = (supProfiles ?? []) as { id: string; nome: string; avatar_url: string | null }[]

  // Líder names per célula
  const liderIds = membros.filter((m) => m.papel === 'lider').map((m) => m.user_id)
  const { data: liderProfiles } = liderIds.length > 0
    ? await supabase.from('profiles').select('id, nome').in('id', liderIds)
    : { data: [] }

  const liderNomePorId = new Map(((liderProfiles ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))

  const lideresPorCelula = new Map<string, string[]>()
  membros.filter((m) => m.papel === 'lider').forEach((m) => {
    const nome = liderNomePorId.get(m.user_id) ?? null
    if (!nome) return
    const list = lideresPorCelula.get(m.celula_id) ?? []
    list.push(nome.split(' ')[0])
    lideresPorCelula.set(m.celula_id, list)
  })

  // Member count per célula
  const membrosPorCelula = new Map<string, number>()
  membros.forEach((m) => {
    membrosPorCelula.set(m.celula_id, (membrosPorCelula.get(m.celula_id) ?? 0) + 1)
  })

  // Next encontro per célula
  const proximoPorCelula = new Map<string, EncontroRow>()
  encontros.forEach((e) => {
    if (!proximoPorCelula.has(e.celula_id)) proximoPorCelula.set(e.celula_id, e)
  })

  const encontrosEstaSemana = encontros.filter((e) =>
    isThisWeek(new Date(e.data_hora), { locale: ptBR })
  ).length
  const totalMembros = membros.length

  const backHref = profile.role === 'pastor' || profile.role === 'admin' ? '/pastor' : '/supervisor'

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" render={<Link href={backHref} />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: rede.cor }} />
            <h1 className="text-xl font-bold">{rede.nome}</h1>
          </div>
          {rede.descricao && (
            <p className="text-sm text-muted-foreground ml-6">{rede.descricao}</p>
          )}
          {(supervisores.length > 0 || rede.supervisor_nome) && (
            <div className="flex items-center gap-1.5 mt-1.5 ml-6 flex-wrap">
              <span className="text-xs font-medium text-foreground/60">supervisores:</span>
              {supervisores.length > 0
                ? supervisores.map((s) => (
                    <div key={s.id} className="flex items-center gap-1 bg-muted rounded-full pl-0.5 pr-2.5 py-0.5">
                      {s.avatar_url ? (
                        <img src={s.avatar_url} alt={s.nome} className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">
                          {s.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">{s.nome.split(' ')[0]}</span>
                    </div>
                  ))
                : <span className="text-xs text-muted-foreground">{rede.supervisor_nome}</span>
              }
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <CriarEventoDialog tipoFixo="rede" redeId={params.id} label="+ Evento" />
          <CriarCelulaDialog redeId={params.id} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{celulas.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Células</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalMembros}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Membros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{encontrosEstaSemana}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Eventos da rede */}
      {eventosRede.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Próximos eventos</h2>
          </div>
          <div className="space-y-2">
            {eventosRede.map((evento) => (
              <Card key={evento.id}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  {evento.imagem_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={evento.imagem_url} alt={evento.titulo} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{evento.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(evento.data_hora), "EEE, d MMM 'às' HH'h'mm", { locale: ptBR })}
                      {evento.local && ` · ${evento.local}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Células */}
      {celulas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma célula nesta rede.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {celulas.map((celula) => {
            const numMembros = membrosPorCelula.get(celula.id) ?? 0
            const lideresNomes = lideresPorCelula.get(celula.id) ?? []
            const proximoEncontro = proximoPorCelula.get(celula.id)
            const iniciais = celula.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

            return (
              <Link key={celula.id} href={`/celula/${celula.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden relative">
                          {celula.logo_url ? (
                            <img src={celula.logo_url} alt={celula.nome} className="h-full w-full object-cover" />
                          ) : iniciais}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{celula.nome}</p>
                          {lideresNomes.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground/60">líderes:</span>{' '}
                              {lideresNomes.join(', ')}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {numMembros} {numMembros === 1 ? 'membro' : 'membros'}
                          </p>
                          {proximoEncontro && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <CalendarDays className="h-3 w-3 shrink-0" />
                              {format(new Date(proximoEncontro.data_hora), "EEE, d MMM 'às' HH'h'", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!proximoEncontro && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Sem encontro</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
