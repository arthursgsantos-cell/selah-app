import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { CalendarDays, ChevronRight, Shield } from 'lucide-react'
import { CriarCelulaDialog } from '@/components/supervisor/criar-celula-dialog'
import { CriarEventoDialog } from '@/components/shared/criar-evento-dialog'
import { format, isThisWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type RedeRow = { id: string; nome: string; descricao: string | null; cor: string }
type CelulaRow = { id: string; nome: string; rede_id: string; ativa: boolean }
type MembroRow = { celula_id: string; user_id: string; papel: string }
type ProfileRow = { id: string; nome: string }
type EncontroRow = { id: string; celula_id: string; data_hora: string; status: string }

export default async function SupervisorPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const isSupervisor = profile.role === 'supervisor' || profile.role === 'pastor' || profile.role === 'admin'
  if (!isSupervisor) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-base font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Esta área é exclusiva para supervisores e pastores.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  let redeIds: string[] = []

  if (profile.role === 'supervisor') {
    const { data: redeSup } = await supabase
      .from('rede_supervisores')
      .select('rede_id')
      .eq('supervisor_id', user.id)
    redeIds = (redeSup ?? []).map((r) => (r as { rede_id: string }).rede_id)
  } else {
    const { data: todasRedes } = await supabase
      .from('redes')
      .select('id')
      .eq('igreja_id', profile.igreja_id)
    redeIds = (todasRedes ?? []).map((r) => (r as { id: string }).id)
  }

  if (redeIds.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-xl font-bold">Painel da rede</h1>
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Nenhuma rede atribuída ainda.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: redesData } = await supabase
    .from('redes')
    .select('id, nome, descricao, cor')
    .in('id', redeIds)

  const redes = (redesData ?? []) as RedeRow[]

  const { data: celulasData } = await supabase
    .from('celulas')
    .select('id, nome, rede_id, ativa')
    .in('rede_id', redeIds)
    .eq('ativa', true)
    .order('nome')

  const celulas = (celulasData ?? []) as CelulaRow[]
  const celulaIds = celulas.map((c) => c.id)

  const { data: membrosData } = await supabase
    .from('celula_membros')
    .select('celula_id, user_id, papel')
    .in('celula_id', celulaIds)

  const membros = (membrosData ?? []) as MembroRow[]

  const { data: encontrosData } = await supabase
    .from('encontros')
    .select('id, celula_id, data_hora, status')
    .in('celula_id', celulaIds)
    .eq('status', 'agendado')
    .gte('data_hora', new Date().toISOString())
    .order('data_hora', { ascending: true })

  const encontros = (encontrosData ?? []) as EncontroRow[]

  // Group members by celula
  const membrosPorCelula = new Map<string, number>()
  membros.forEach((m) => {
    membrosPorCelula.set(m.celula_id, (membrosPorCelula.get(m.celula_id) ?? 0) + 1)
  })

  // Fetch lider names
  const liderIds = membros.filter((m) => m.papel === 'lider').map((m) => m.user_id)

  const { data: lideresData } = liderIds.length > 0
    ? await supabase.from('profiles').select('id, nome').in('id', liderIds)
    : { data: [] }

  const lideresProfiles = (lideresData ?? []) as ProfileRow[]
  const liderNomePorId = new Map(lideresProfiles.map((p) => [p.id, p.nome]))

  const liderPorCelula = new Map<string, string>()
  membros
    .filter((m) => m.papel === 'lider')
    .forEach((m) => {
      liderPorCelula.set(m.celula_id, liderNomePorId.get(m.user_id) ?? 'Líder')
    })

  // Next meeting per celula
  const proximoEncontroPorCelula = new Map<string, EncontroRow>()
  encontros.forEach((e) => {
    if (!proximoEncontroPorCelula.has(e.celula_id)) {
      proximoEncontroPorCelula.set(e.celula_id, e)
    }
  })

  const totalCelulas = celulas.length
  const totalMembros = membros.length
  const encontrosEstaSemana = encontros.filter((e) =>
    isThisWeek(new Date(e.data_hora), { locale: ptBR })
  ).length

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Painel da rede</h1>
        <CriarEventoDialog tipoFixo="rede" label="Criar evento" />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalCelulas}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Células ativas</p>
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

      {/* Redes e células */}
      {redes.map((rede) => {
        const celulasDaRede = celulas.filter((c) => c.rede_id === rede.id)

        return (
          <section key={rede.id}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: rede.cor }} />
                <h2 className="text-sm font-semibold">{rede.nome}</h2>
                <span className="text-xs text-muted-foreground">
                  {celulasDaRede.length} {celulasDaRede.length === 1 ? 'célula' : 'células'}
                </span>
              </div>
              <CriarCelulaDialog redeId={rede.id} />
            </div>

            {celulasDaRede.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma célula nesta rede.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {celulasDaRede.map((celula) => {
                  const numMembros = membrosPorCelula.get(celula.id) ?? 0
                  const liderNome = liderPorCelula.get(celula.id)
                  const proximoEncontro = proximoEncontroPorCelula.get(celula.id)

                  return (
                    <Link key={celula.id} href={`/celula/${celula.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">{celula.nome}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {liderNome ? `Líder: ${liderNome} · ` : ''}
                                {numMembros} {numMembros === 1 ? 'membro' : 'membros'}
                              </p>
                              {proximoEncontro && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <CalendarDays className="h-3 w-3 shrink-0" />
                                  {format(
                                    new Date(proximoEncontro.data_hora),
                                    "EEE, d MMM 'às' HH'h'",
                                    { locale: ptBR }
                                  )}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!proximoEncontro && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Sem encontro
                                </Badge>
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
          </section>
        )
      })}
    </div>
  )
}
