import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, ChevronRight, Users, Sparkles, ImageIcon } from 'lucide-react'
import { CriarCelulaDialog } from '@/components/supervisor/criar-celula-dialog'
import { CriarEventoDialog } from '@/components/shared/criar-evento-dialog'
import { EventoCard } from '@/components/home/evento-card'
import { RedeCapaUpload } from '@/components/rede/rede-capa-upload'
import { RedeLogoUpload } from '@/components/rede/rede-logo-upload'
import { format, isThisWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type CelulaRow = { id: string; nome: string; logo_url: string | null; ativa: boolean }

export default async function RedeDetalhesPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const admin = createAdminClient()

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
    .select('id, nome, descricao, cor, supervisor_nome, logo_url, capa_url')
    .eq('id', params.id)
    .single()

  if (!redeData) notFound()
  const rede = redeData as {
    id: string; nome: string; descricao: string | null; cor: string
    supervisor_nome: string | null; logo_url: string | null; capa_url: string | null
  }

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
    { data: eventosRedeData },
    { data: fotosData },
    { data: encontrosComCapa },
  ] = await Promise.all([
    celulaIds.length > 0
      ? supabase.from('celula_membros').select('celula_id, user_id, papel').in('celula_id', celulaIds)
      : Promise.resolve({ data: [] }),
    celulaIds.length > 0
      ? supabase.from('encontros').select('id, celula_id, data_hora, status')
          .in('celula_id', celulaIds).eq('status', 'agendado')
          .gte('data_hora', new Date().toISOString()).order('data_hora', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from('rede_supervisores').select('supervisor_id').eq('rede_id', params.id),
    supabase.from('eventos')
      .select('id, titulo, descricao, data_hora, local, tipo, imagem_url')
      .eq('rede_id', params.id).gte('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: true }).limit(10),
    celulaIds.length > 0
      ? admin.from('fotos_comunidade').select('url, criado_em')
          .in('celula_id', celulaIds).order('criado_em', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    celulaIds.length > 0
      ? admin.from('encontros').select('card_imagem_url, data_hora')
          .in('celula_id', celulaIds).not('card_imagem_url', 'is', null)
          .order('data_hora', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ])

  type MembroRow = { celula_id: string; user_id: string; papel: string }
  type EncontroRow = { id: string; celula_id: string; data_hora: string; status: string }
  type EventoRedeRow = { id: string; titulo: string; descricao: string | null; data_hora: string; local: string | null; tipo: string; imagem_url: string | null }

  const eventosRede = (eventosRedeData ?? []) as EventoRedeRow[]
  const membros = (membrosData ?? []) as MembroRow[]
  const encontros = (encontrosData ?? []) as EncontroRow[]

  const eventoIds = eventosRede.map((e) => e.id)
  const { data: presencasData } = eventoIds.length > 0
    ? await supabase.from('evento_presencas').select('evento_id, user_id, resposta').in('evento_id', eventoIds)
    : { data: [] }

  const presencasMap = new Map(
    eventoIds.map((eid) => {
      const eps = (presencasData ?? []).filter((p) => p.evento_id === eid)
      return [eid, {
        minhaResposta: (eps.find((p) => p.user_id === user.id)?.resposta ?? null) as 'vou' | 'nao_vou' | null,
        totalVou: eps.filter((p) => p.resposta === 'vou').length,
      }]
    })
  )

  const supIds = (supData ?? []).map((s: { supervisor_id: string }) => s.supervisor_id)
  const { data: supProfiles } = supIds.length > 0
    ? await supabase.from('profiles').select('id, nome, avatar_url').in('id', supIds)
    : { data: [] }
  const supervisores = (supProfiles ?? []) as { id: string; nome: string; avatar_url: string | null }[]

  const liderIds = membros.filter((m) => m.papel === 'lider').map((m) => m.user_id)
  const { data: liderProfiles } = liderIds.length > 0
    ? await supabase.from('profiles').select('id, nome').in('id', liderIds)
    : { data: [] }

  const liderNomePorId = new Map(((liderProfiles ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))
  const lideresPorCelula = new Map<string, string[]>()
  membros.filter((m) => m.papel === 'lider').forEach((m) => {
    const nome = liderNomePorId.get(m.user_id)
    if (!nome) return
    const list = lideresPorCelula.get(m.celula_id) ?? []
    list.push(nome.split(' ')[0])
    lideresPorCelula.set(m.celula_id, list)
  })

  const membrosPorCelula = new Map<string, number>()
  membros.forEach((m) => membrosPorCelula.set(m.celula_id, (membrosPorCelula.get(m.celula_id) ?? 0) + 1))

  const proximoPorCelula = new Map<string, EncontroRow>()
  encontros.forEach((e) => { if (!proximoPorCelula.has(e.celula_id)) proximoPorCelula.set(e.celula_id, e) })

  const encontrosEstaSemana = encontros.filter((e) => isThisWeek(new Date(e.data_hora), { locale: ptBR })).length
  const totalMembros = membros.length

  // Galeria: fotos da comunidade + capas de encontros das células desta rede
  type GalleryPhoto = { src: string; date: string }
  const galleryPhotos: GalleryPhoto[] = [
    ...(fotosData ?? []).map((f: any) => ({ src: f.url as string, date: f.criado_em as string })),
    ...(encontrosComCapa ?? []).filter((e: any) => e.card_imagem_url).map((e: any) => ({ src: e.card_imagem_url as string, date: e.data_hora as string })),
  ]
    .filter((item, idx, arr) => arr.findIndex((x) => x.src === item.src) === idx)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 24)

  const iniciais = rede.nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  const canEdit = ['pastor', 'admin', 'supervisor'].includes(profile.role)
  const backHref = profile.role === 'pastor' || profile.role === 'admin' ? '/pastor' : '/supervisor'

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-8">
      <Button variant="ghost" size="sm" render={<Link href={backHref} />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* ── Capa + Logo ── */}
      <div className="relative">
        <RedeCapaUpload redeId={params.id} capaUrl={rede.capa_url} cor={rede.cor} canEdit={canEdit} />

        {/* Logo sobreposto no canto inferior esquerdo da capa */}
        <div className="absolute -bottom-7 left-4">
          <div className="ring-4 ring-background rounded-2xl shadow-lg">
            <RedeLogoUpload redeId={params.id} logoUrl={rede.logo_url} cor={rede.cor} iniciais={iniciais} />
          </div>
        </div>

        {/* Botões de ação no canto inferior direito da capa */}
        <div className="absolute bottom-3 right-3 flex gap-2">
          <CriarEventoDialog tipoFixo="rede" redeId={params.id} label="+ Evento" />
          <CriarCelulaDialog redeId={params.id} />
        </div>
      </div>

      {/* ── Nome e info ── */}
      <div className="pt-8 pl-1">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: rede.cor }} />
          <h1 className="text-2xl font-bold">{rede.nome}</h1>
        </div>
        {rede.descricao && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{rede.descricao}</p>
        )}
        {(supervisores.length > 0 || rede.supervisor_nome) && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs font-medium text-foreground/60">supervisores:</span>
            {supervisores.length > 0
              ? supervisores.map((s) => (
                  <div key={s.id} className="flex items-center gap-1 bg-muted rounded-full pl-0.5 pr-2.5 py-0.5">
                    {s.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.avatar_url} alt={s.nome} className="h-5 w-5 rounded-full object-cover" />
                      : <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">
                          {s.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                        </div>
                    }
                    <span className="text-xs text-muted-foreground">{s.nome.split(' ')[0]}</span>
                  </div>
                ))
              : <span className="text-xs text-muted-foreground">{rede.supervisor_nome}</span>
            }
          </div>
        )}
      </div>

      {/* ── Stats ── */}
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

      {/* ── Próximos eventos ── */}
      {eventosRede.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Próximos eventos</h2>
          </div>
          <div className="space-y-2">
            {eventosRede.map((evento) => {
              const p = presencasMap.get(evento.id) ?? { minhaResposta: null, totalVou: 0 }
              return <EventoCard key={evento.id} evento={evento} minhaResposta={p.minhaResposta} totalVou={p.totalVou} redeNome={rede.nome} />
            })}
          </div>
        </section>
      )}

      {/* ── Galeria da rede ── */}
      {galleryPhotos.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Galeria</h2>
            <span className="text-xs text-muted-foreground">· {galleryPhotos.length} fotos</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {galleryPhotos.map((photo, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={photo.src} alt="" className="aspect-square w-full object-cover rounded-xl" />
            ))}
          </div>
        </section>
      )}

      {/* ── Células ── */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Células ({celulas.length})</h2>
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
              const ini = celula.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

              return (
                <Link key={celula.id} href={`/celula/${celula.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                            {celula.logo_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={celula.logo_url} alt={celula.nome} className="h-full w-full object-cover" />
                              : ini}
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
      </section>
    </div>
  )
}
