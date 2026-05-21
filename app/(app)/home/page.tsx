import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CalendarDays, MapPin, ChevronRight, Users, Sparkles, Cake, History, Bell } from 'lucide-react'
import { SolicitacaoNotificacaoCard } from '@/components/home/solicitacao-notificacao-card'
import { EventoCard } from '@/components/home/evento-card'
import { SolicitarCelulaDialog } from '@/components/home/solicitar-celula-dialog'
import { FotosComunidadeCarousel } from '@/components/home/fotos-comunidade-carousel'
import { EncontroShareBtn } from '@/components/home/encontro-share-btn'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Role } from '@/lib/supabase/types'

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  pastor: 'Pastor',
  supervisor: 'Supervisor',
  supervisor_treinamento: 'Supervisor em Treinamento',
  lider: 'Líder',
  lider_treinamento: 'Líder em Treinamento',
  membro: 'Membro',
}

const funcaoLabels: Record<string, string> = {
  louvor: '🎵 Louvor',
  quebra_gelo: '🎲 Quebra-gelo',
  edificacao: '📖 Edificação',
  compartilhar: '🤝 Compartilhar',
}

export default async function HomePage() {
  const user = await getAuthUser()
  const supabase = await createClient()

  const profile = user
    ? (await supabase.from('profiles').select('id, nome, role, avatar_url, igreja_id, data_nascimento_1, data_casamento, telefone').eq('id', user.id).single()).data
    : null

  if (user && !profile) redirect('/onboarding')

  // Fetch church (with name for guest welcome)
  const { data: ig } = profile?.igreja_id
    ? await supabase.from('igrejas').select('id, nome, logo_url, descricao, instagram_url, facebook_url, youtube_url, pastor_nome, pastor_titulo, pastor_foto_url, horario_culto, endereco, fundada_em').eq('id', profile.igreja_id).single()
    : await supabase.from('igrejas').select('id, nome, logo_url, descricao, instagram_url, facebook_url, youtube_url, pastor_nome, pastor_titulo, pastor_foto_url, horario_culto, endereco, fundada_em').limit(1).single()

  const church = ig as any
  const igrejaId = church?.id ?? null

  const { data: membroCelula } = user
    ? await supabase
        .from('celula_membros')
        .select('celula_id, papel, celulas(id, nome)')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null }

  const celulaId = membroCelula?.celula_id ?? null

  const { data: proximoEncontro } = celulaId
    ? await supabase
        .from('encontros')
        .select('id, data_hora, local, avisos, card_imagem_url')
        .eq('celula_id', celulaId)
        .eq('status', 'agendado')
        .gte('data_hora', new Date().toISOString())
        .order('data_hora', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const { data: minhasEscalas } = proximoEncontro && user
    ? await supabase
        .from('escalas')
        .select('funcao')
        .eq('encontro_id', proximoEncontro.id)
        .eq('responsavel_id', user.id)
    : { data: null }

  const admin = createAdminClient()

  const [{ data: eventos }, { data: profilesIgreja }, { data: ultimosEncontrosCelula }, { data: ultimosEventosPast }, { data: pastorProfiles }, { data: fotosComunidade }, { data: encontroFotos }] = await Promise.all([
    supabase
      .from('eventos')
      .select('id, titulo, descricao, data_hora, local, tipo, imagem_url')
      .eq('igreja_id', igrejaId ?? '')
      .gte('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: true })
      .limit(4),
    supabase
      .from('profiles')
      .select('id, nome, avatar_url, data_nascimento_1')
      .eq('igreja_id', igrejaId ?? '')
      .not('data_nascimento_1', 'is', null),
    celulaId
      ? supabase
          .from('encontros')
          .select('id, data_hora, local, card_imagem_url')
          .eq('celula_id', celulaId)
          .eq('status', 'realizado')
          .lt('data_hora', new Date().toISOString())
          .order('data_hora', { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] }),
    supabase
      .from('eventos')
      .select('id, titulo, data_hora, local, tipo, imagem_url')
      .eq('igreja_id', igrejaId ?? '')
      .lt('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: false })
      .limit(3),
    igrejaId
      ? supabase
          .from('profiles')
          .select('id, nome, avatar_url, titulo')
          .eq('igreja_id', igrejaId)
          .eq('role', 'pastor')
          .order('nome')
      : Promise.resolve({ data: [] }),
    igrejaId
      ? admin.from('fotos_comunidade').select('url, criado_em').eq('igreja_id', igrejaId).order('criado_em', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    igrejaId
      ? admin.from('encontros').select('card_imagem_url, data_hora').eq('igreja_id', igrejaId).not('card_imagem_url', 'is', null).order('data_hora', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ])

  // Solicitações encaminhadas para este líder
  const isLider = profile && ['lider', 'lider_treinamento'].includes(profile.role)
  const { data: minhasSolicitacoes } = isLider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from('solicitacoes_celula')
        .select('id, nome, telefone, email, idade, bairro, melhor_dia, estado_civil, tem_filhos, filhos_detalhes, tipo_membro, criado_em')
        .eq('lider_encaminhado_id', user!.id)
        .eq('status', 'encaminhado')
        .order('criado_em', { ascending: false })
    : { data: [] as any[] }

  type HistItem = { id: string; titulo: string; data_hora: string; tipo: 'celula' | 'evento'; local: string | null; img: string | null }
  const historico: HistItem[] = [
    ...(ultimosEncontrosCelula ?? []).map((e) => ({
      id: e.id,
      titulo: format(new Date(e.data_hora), "EEEE, d 'de' MMMM", { locale: ptBR }),
      data_hora: e.data_hora,
      tipo: 'celula' as const,
      local: e.local,
      img: e.card_imagem_url ?? null,
    })),
    ...(ultimosEventosPast ?? []).map((e) => ({
      id: e.id,
      titulo: e.titulo,
      data_hora: e.data_hora,
      tipo: 'evento' as const,
      local: e.local,
      img: e.imagem_url ?? null,
    })),
  ]
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
    .slice(0, 3)

  const eventIds = (eventos ?? []).map((e) => e.id)
  const { data: presencas } = eventIds.length
    ? await supabase
        .from('evento_presencas')
        .select('evento_id, user_id, resposta')
        .in('evento_id', eventIds)
    : { data: [] }

  const presencasMap = new Map(
    eventIds.map((eid) => {
      const eps = (presencas ?? []).filter((p) => p.evento_id === eid)
      return [eid, {
        minhaResposta: (eps.find((p) => p.user_id === user?.id)?.resposta ?? null) as 'vou' | 'nao_vou' | null,
        totalVou: eps.filter((p) => p.resposta === 'vou').length,
      }]
    })
  )

  const mesAtual = new Date().getMonth() + 1
  const nomeMes = format(new Date(), 'MMMM', { locale: ptBR })
  const nomeMesCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)

  function diasAteAnivHome(dataStr: string): number {
    const [, mm, dd] = dataStr.split('-')
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const ano = hoje.getFullYear()
    let d = new Date(ano, parseInt(mm, 10) - 1, parseInt(dd, 10))
    d.setHours(0, 0, 0, 0)
    if (d < hoje) d = new Date(ano + 1, parseInt(mm, 10) - 1, parseInt(dd, 10))
    return Math.floor((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  }

  const aniversariantesMes = (profilesIgreja ?? [])
    .filter((p) => parseInt(p.data_nascimento_1!.slice(5, 7), 10) === mesAtual)
    .map((p) => ({ ...p, daysUntil: diasAteAnivHome(p.data_nascimento_1!) }))
    .sort((a, b) => {
      const diaA = parseInt(a.data_nascimento_1!.slice(8, 10), 10)
      const diaB = parseInt(b.data_nascimento_1!.slice(8, 10), 10)
      return diaA - diaB
    })

  const aniversariantesHoje = aniversariantesMes.filter((p) => p.daysUntil === 0)
  const meuAniversarioHoje = profile?.data_nascimento_1
    ? diasAteAnivHome(profile.data_nascimento_1) === 0
    : false

  // Merge community photos + encontro cover photos, dedupe, sort newest first
  type GalleryItem = { src: string; date: string }
  const galleryItems: GalleryItem[] = [
    ...(fotosComunidade ?? []).map((f: any) => ({ src: f.url as string, date: f.criado_em as string })),
    ...(encontroFotos ?? []).filter((e: any) => e.card_imagem_url).map((e: any) => ({ src: e.card_imagem_url as string, date: e.data_hora as string })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30)

  const staticPhotos = [
    '/fotos/foto-01.png', '/fotos/foto-02.png', '/fotos/foto-03.png',
    '/fotos/foto-04.png', '/fotos/foto-05.png', '/fotos/foto-06.png',
    '/fotos/foto-07.png', '/fotos/foto-08.png', '/fotos/foto-09.png',
    '/fotos/foto-10.png', '/fotos/foto-11.png',
  ]
  const galleryPhotos = galleryItems.length > 0 ? galleryItems.map((g) => g.src) : staticPhotos

  const primeiroNome = profile?.nome.split(' ')[0] ?? 'Visitante'
  const iniciais = profile ? profile.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() : '?'

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const igSvg = <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
  const fbSvg = <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  const ytSvg = <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>

  if (!profile) {
    // ── GUEST / PUBLIC VIEW ──────────────────────────────────────────
    return (
      <div className="space-y-4 max-w-2xl mx-auto pb-8">

        {/* Hero — identidade da igreja */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fotos/foto-05.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-105" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B2447]/93 via-[#19376D]/88 to-[#0F52BA]/82" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, white, transparent)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="relative px-6 pt-8 pb-7 text-white text-center">
            {church?.logo_url && (
              <div className="mb-5 flex justify-center">
                <div className="h-20 w-20 rounded-2xl bg-white p-2 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={church.logo_url} alt={church?.nome ?? ''} className="h-full w-full object-contain" />
                </div>
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight leading-tight">{church?.nome ?? 'Nossa Igreja'}</h1>
            {church?.descricao && (
              <p className="mt-2 text-sm text-blue-100/75 italic font-light max-w-xs mx-auto leading-relaxed">"{church.descricao}"</p>
            )}
            {church?.fundada_em && (
              <p className="mt-1.5 text-[11px] text-blue-200/50 font-medium tracking-widest uppercase">Fundada em {church.fundada_em}</p>
            )}
            <div className="flex gap-2.5 justify-center mt-6">
              <Link href="/login" className="px-6 py-2.5 rounded-full bg-white text-[#0B2447] text-sm font-bold hover:bg-blue-50 transition-colors shadow-lg">
                Entrar
              </Link>
              <Link href="/cadastro" className="px-6 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm">
                Criar conta
              </Link>
            </div>
          </div>
        </div>

        {/* Cards dos pastores — baseado nos perfis com role='pastor' */}
        {(() => {
          type PastorRow = { id: string; nome: string; avatar_url: string | null; titulo: string | null }
          const pastores = (pastorProfiles ?? []) as unknown as PastorRow[]

          // Fallback: se não houver perfis de pastor, usa dados da igreja
          if (pastores.length === 0 && church?.pastor_nome) {
            return (
              <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
                <div className="h-1 bg-gradient-to-r from-[#0B2447] via-[#0F52BA] to-[#4DA6FF]" />
                <div className="p-4 flex items-center gap-4">
                  {church?.pastor_foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={church.pastor_foto_url} alt={church.pastor_nome}
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-100 shadow-md shrink-0" />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#0B2447] to-[#0F52BA] flex items-center justify-center ring-2 ring-blue-100 shadow-md shrink-0">
                      <span className="text-xl font-bold text-white">
                        {(church.pastor_nome as string).split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-widest">{church.pastor_titulo ?? 'Pastor'}</p>
                    <p className="font-bold text-lg text-gray-900 leading-tight mt-0.5">{church.pastor_nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{church?.nome ?? 'Igreja Batista Zona Sul'}</p>
                  </div>
                </div>
              </div>
            )
          }

          if (pastores.length === 0) return null

          return (
            <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
              <div className="h-1 bg-gradient-to-r from-[#0B2447] via-[#0F52BA] to-[#4DA6FF]" />
              <div className="divide-y divide-blue-50">
                {pastores.map((pastor) => {
                  const iniciais = pastor.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')
                  return (
                    <div key={pastor.id} className="p-4 flex items-center gap-4">
                      {pastor.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pastor.avatar_url} alt={pastor.nome}
                          className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-100 shadow-md shrink-0" />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#0B2447] to-[#0F52BA] flex items-center justify-center ring-2 ring-blue-100 shadow-md shrink-0">
                          <span className="text-lg font-bold text-white">{iniciais}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-widest">
                          {pastor.titulo ?? 'Pastor'}
                        </p>
                        <p className="font-bold text-base text-gray-900 leading-tight mt-0.5">{pastor.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{church?.nome ?? 'Igreja Batista Zona Sul'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Info rápida — cultos e endereço */}
        {(church?.horario_culto || church?.endereco) && (
          <div className="grid grid-cols-2 gap-2.5">
            {church?.horario_culto && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#0B2447]/10 shrink-0 mt-0.5">
                  <CalendarDays className="h-3.5 w-3.5 text-[#0B2447]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#0B2447]/60 uppercase tracking-wider">Cultos</p>
                  <p className="text-xs font-semibold text-gray-800 mt-0.5 leading-snug">{church.horario_culto ?? 'Nove horas, 11 horas, 17 horas'}</p>
                </div>
              </div>
            )}
            {church?.endereco && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#0B2447]/10 shrink-0 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-[#0B2447]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[#0B2447]/60 uppercase tracking-wider">Endereço</p>
                  <p className="text-xs font-semibold text-gray-800 mt-0.5 leading-snug line-clamp-3">{church.endereco}</p>
                  <a
                    href="https://www.google.com/maps/place/Igreja+Batista+Zona+Sul/@-5.8897497,-35.2019375,230m/data=!3m1!1e3!4m6!3m5!1s0x7b2f8bc8265d247:0xfd5ac94ff0adde02!8m2!3d-5.8897333!4d-35.2013972!16s%2Fg%2F119x5pn_w?entry=ttu&g_ep=EgoyMDI2MDUxMy4wIKXMDSoASAFQAw%3D%3D"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold text-[#0B2447] hover:text-[#0F52BA] transition-colors"
                  >
                    <MapPin className="h-3 w-3" />
                    Ver no mapa
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fotos — Nossa comunidade */}
        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">Nossa comunidade</p>
          <FotosComunidadeCarousel srcs={galleryPhotos} />
        </section>

        {/* CTA — quero uma célula */}
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[#0B2447]/10 shrink-0 mt-0.5">
              <Users className="h-5 w-5 text-[#0B2447]" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-base text-gray-900">Faça parte de um grupo</h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                As células são grupos pequenos que se reúnem semanalmente para crescer na fé, compartilhar a vida e se apoiar mutuamente.
              </p>
              <SolicitarCelulaDialog email="" nomeInicial="" buttonClassName="mt-3" />
            </div>
          </div>
        </div>

        {/* Próximos eventos */}
        {eventos && eventos.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#0F52BA]" />
              <h2 className="text-sm font-semibold">Próximos eventos</h2>
            </div>
            <div className="space-y-2">
              {eventos.map((evento) => {
                const p = presencasMap.get(evento.id) ?? { minhaResposta: null, totalVou: 0 }
                return <EventoCard key={evento.id} evento={evento} minhaResposta={p.minhaResposta} totalVou={p.totalVou} />
              })}
            </div>
          </section>
        )}

        {/* Mapa */}
        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">Como nos encontrar</p>
          <div className="rounded-2xl overflow-hidden border border-blue-100 relative">
            <iframe
              src="https://maps.google.com/maps?q=-5.8897333,-35.2013972&z=17&output=embed"
              width="100%"
              height="220"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localização da Igreja Batista Zona Sul"
            />
            <div className="absolute bottom-3 right-3">
              <a
                href="https://www.google.com/maps/place/Igreja+Batista+Zona+Sul/@-5.8897497,-35.2019375,230m/data=!3m1!1e3!4m6!3m5!1s0x7b2f8bc8265d247:0xfd5ac94ff0adde02!8m2!3d-5.8897333!4d-35.2013972!16s%2Fg%2F119x5pn_w?entry=ttu&g_ep=EgoyMDI2MDUxMy4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white shadow-md text-xs font-semibold text-[#0B2447] hover:bg-blue-50 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                Abrir no mapa
              </a>
            </div>
          </div>
        </section>

        {/* Rodapé */}
        <footer className="-mx-4 -mb-4 md:-mx-6 md:-mb-6 bg-[#0B2447] text-white px-6 pt-8 pb-10 rounded-t-3xl mt-2">
          {/* Logo + nome */}
          <div className="flex items-center gap-3 mb-5">
            {church?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={church.logo_url} alt={church?.nome ?? ''} className="h-10 w-10 rounded-xl bg-white p-1.5 object-contain shrink-0" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-xl bg-white p-1.5 object-contain shrink-0" />
            )}
            <div>
              <p className="font-bold text-base leading-tight">{church?.nome ?? 'Igreja Batista Zona Sul'}</p>
              {church?.descricao && (
                <p className="text-xs text-blue-200/70 mt-0.5 line-clamp-1">{church.descricao}</p>
              )}
            </div>
          </div>

          {/* Endereço e horários */}
          <div className="space-y-2 mb-5">
            {church?.endereco && (
              <div className="flex items-start gap-2 text-xs text-blue-100/80">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-300" />
                <span>{church.endereco}</span>
              </div>
            )}
            {church?.horario_culto && (
              <div className="flex items-start gap-2 text-xs text-blue-100/80">
                <CalendarDays className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-300" />
                <span>{church.horario_culto}</span>
              </div>
            )}
          </div>

          {/* Redes sociais */}
          {(church?.instagram_url || church?.facebook_url || church?.youtube_url) && (
            <div className="flex gap-2 mb-6">
              {church?.instagram_url && (
                <a href={church.instagram_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
                  {igSvg} Instagram
                </a>
              )}
              {church?.facebook_url && (
                <a href={church.facebook_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                  {fbSvg} Facebook
                </a>
              )}
              {church?.youtube_url && (
                <a href={church.youtube_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF0000] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                  {ytSvg} YouTube
                </a>
              )}
            </div>
          )}

          {/* Links rápidos */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-blue-200/70 border-t border-white/10 pt-5 mb-4">
            <Link href="/login" className="hover:text-white transition-colors">Entrar</Link>
            <Link href="/cadastro" className="hover:text-white transition-colors">Criar conta</Link>
            <Link href="/eventos" className="hover:text-white transition-colors">Eventos</Link>
          </div>

          {/* Copyright */}
          <p className="text-[10px] text-blue-200/40">
            © {new Date().getFullYear()} {church?.nome ?? 'Igreja Batista Zona Sul'} · Todos os direitos reservados
          </p>
        </footer>

      </div>
    )
  }

  // ── MEMBER / LOGGED-IN VIEW ─────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-6">

      {/* Hero — boas-vindas pessoal */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0B2447] via-[#19376D] to-[#0F52BA] p-6 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }}
        />
        <div className="relative flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-white/40 shadow-xl shrink-0">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={primeiroNome} />
            <AvatarFallback className="bg-white/20 text-white text-xl font-bold">{iniciais}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white/70 text-sm">{saudacao},</p>
            <h1 className="text-2xl font-bold leading-tight">{primeiroNome} 👋</h1>
            <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/20 text-white">
              {roleLabels[profile.role] ?? profile.role}
            </span>
          </div>
        </div>
      </div>

      {/* Cards dos pastores */}
      {(() => {
        type PastorRow = { id: string; nome: string; avatar_url: string | null; titulo: string | null }
        const pastores = (pastorProfiles ?? []) as unknown as PastorRow[]

        if (pastores.length === 0 && church?.pastor_nome) {
          return (
            <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
              <div className="h-1 bg-gradient-to-r from-[#0B2447] via-[#0F52BA] to-[#4DA6FF]" />
              <div className="p-4 flex items-center gap-4">
                {church?.pastor_foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={church.pastor_foto_url} alt={church.pastor_nome}
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-100 shadow-md shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#0B2447] to-[#0F52BA] flex items-center justify-center ring-2 ring-blue-100 shadow-md shrink-0">
                    <span className="text-xl font-bold text-white">
                      {(church.pastor_nome as string).split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-widest">{church.pastor_titulo ?? 'Pastor'}</p>
                  <p className="font-bold text-lg text-gray-900 leading-tight mt-0.5">{church.pastor_nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{church?.nome ?? 'Igreja Batista Zona Sul'}</p>
                </div>
              </div>
            </div>
          )
        }

        if (pastores.length === 0) return null

        return (
          <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
            <div className="h-1 bg-gradient-to-r from-[#0B2447] via-[#0F52BA] to-[#4DA6FF]" />
            <div className="divide-y divide-blue-50">
              {pastores.map((pastor) => {
                const iniciais = pastor.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')
                return (
                  <div key={pastor.id} className="p-4 flex items-center gap-4">
                    {pastor.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pastor.avatar_url} alt={pastor.nome}
                        className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-100 shadow-md shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#0B2447] to-[#0F52BA] flex items-center justify-center ring-2 ring-blue-100 shadow-md shrink-0">
                        <span className="text-lg font-bold text-white">{iniciais}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-widest">
                        {pastor.titulo ?? 'Pastor'}
                      </p>
                      <p className="font-bold text-base text-gray-900 leading-tight mt-0.5">{pastor.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{church?.nome ?? 'Igreja Batista Zona Sul'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Aniversário próprio — destaque pessoal */}
      {meuAniversarioHoje && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-rose-400 p-5 text-white shadow-lg">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white, transparent 60%)' }} />
          <div className="relative flex items-center gap-4">
            <span className="text-5xl select-none">🎂</span>
            <div>
              <p className="font-bold text-lg leading-tight">Feliz aniversário, {primeiroNome}! 🎉</p>
              <p className="text-sm text-white/80 mt-0.5">Que Deus te abençoe abundantemente hoje e sempre!</p>
            </div>
          </div>
        </div>
      )}

      {/* Aniversariantes de hoje — destaque para toda a igleja */}
      {aniversariantesHoje.filter((p) => p.id !== profile.id).length > 0 && (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 border border-rose-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎂</span>
            <p className="font-semibold text-sm text-rose-700">
              {aniversariantesHoje.filter((p) => p.id !== profile.id).length === 1
                ? 'Aniversariante de hoje!'
                : 'Aniversariantes de hoje!'}
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">
              {format(new Date(), "d 'de' MMM", { locale: ptBR })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {aniversariantesHoje.filter((p) => p.id !== profile.id).map((p) => {
              const ini = p.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
              return (
                <div key={p.id} className="flex items-center gap-2 bg-white border border-rose-100 rounded-2xl px-3 py-2 shadow-sm">
                  <div className="h-9 w-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt={p.nome} className="h-full w-full object-cover" />
                      : ini}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{p.nome.split(' ')[0]}</p>
                    <p className="text-[10px] text-rose-500 font-medium">Parabéns! 🎉</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* CTA célula — visível para membros sem célula */}
      {!celulaId && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[#0B2447]/10 shrink-0 mt-0.5">
              <Users className="h-5 w-5 text-[#0B2447]" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-base text-gray-900">Faça parte de uma célula</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Grupos pequenos que se reúnem para crescer na fé, compartilhar a vida e se apoiar mutuamente.
              </p>
              <SolicitarCelulaDialog
                email={user?.email ?? ''}
                nomeInicial={profile.nome}
                telefoneInicial={(profile as any).telefone ?? ''}
                idadeInicial={
                  profile.data_nascimento_1
                    ? Math.floor((Date.now() - new Date(profile.data_nascimento_1).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                    : null
                }
                estadoCivilInicial={(profile as any).data_casamento ? 'Casado(a)' : ''}
                buttonClassName="mt-3"
              />
            </div>
          </div>
        </div>
      )}

      {/* Solicitações de célula — visível apenas para líderes com pendências */}
      {minhasSolicitacoes && minhasSolicitacoes.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="h-4 w-4 text-primary" />
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Solicitações para você</h2>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {minhasSolicitacoes.length}
              </span>
            </div>
            <Link href="/solicitacoes" className="text-xs text-primary hover:underline font-medium">
              Ver todas
            </Link>
          </div>
          <div className="space-y-2">
            {(minhasSolicitacoes as any[]).slice(0, 3).map((sol: any) => (
              <SolicitacaoNotificacaoCard key={sol.id} sol={{ ...sol, status: 'encaminhado' }} />
            ))}
          </div>
          {minhasSolicitacoes.length > 3 && (
            <Link
              href="/solicitacoes"
              className="mt-2 flex w-full items-center justify-center py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Ver mais {minhasSolicitacoes.length - 3} solicitações
            </Link>
          )}
        </section>
      )}

      {/* Próximo encontro */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Próximo encontro</h2>
        </div>
        {proximoEncontro ? (
          <>
          <Link href={`/encontro/${proximoEncontro.id}`}>
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/10 p-4 hover:shadow-md transition-all cursor-pointer group flex gap-3">
              {proximoEncontro.card_imagem_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proximoEncontro.card_imagem_url} alt="Capa do encontro" className="h-14 w-14 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 self-start">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold capitalize text-sm">
                    {format(new Date(proximoEncontro.data_hora), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(proximoEncontro.data_hora), "HH'h'mm", { locale: ptBR })}
                  {' · '}
                  {formatDistanceToNow(new Date(proximoEncontro.data_hora), { locale: ptBR, addSuffix: true })}
                </p>
                {proximoEncontro.local && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {proximoEncontro.local}
                  </p>
                )}
                {minhasEscalas && minhasEscalas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {minhasEscalas.map((e) => (
                      <Badge key={e.funcao} variant="secondary" className="text-xs">
                        {funcaoLabels[e.funcao] ?? e.funcao}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
          <EncontroShareBtn
            celulaNome={(membroCelula as { celulas?: { nome?: string } | null } | null)?.celulas?.nome ?? 'Célula'}
            dataHora={proximoEncontro.data_hora}
            local={proximoEncontro.local ?? null}
          />
          </>
        ) : celulaId ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum encontro agendado</p>
            <Link href="/celula" className="inline-block mt-3 text-xs font-semibold text-primary hover:underline">
              Agendar encontro →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Você ainda não está em uma célula</p>
            <p className="text-xs text-muted-foreground mt-1">Solicite e nossa equipe vai te indicar a melhor célula</p>
            <SolicitarCelulaDialog email={user?.email ?? ''} nomeInicial={profile?.nome ?? ''} />
          </div>
        )}
      </section>

      {/* Aniversariantes do mês */}
      {aniversariantesMes.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Cake className="h-4 w-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-foreground">Aniversariantes de {nomeMesCapitalizado}</h2>
          </div>
          <div className="rounded-2xl overflow-hidden border border-rose-100 divide-y divide-rose-50">
            {aniversariantesMes.map((p) => {
              const ini = p.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
              const dia = parseInt(p.data_nascimento_1!.slice(8, 10), 10)
              const isPast = p.daysUntil > 300
              const isToday = p.daysUntil === 0
              const label = isToday ? 'Hoje! 🎉' : p.daysUntil === 1 ? 'Amanhã' : isPast ? `Dia ${dia}` : `Em ${p.daysUntil} dias`
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    isToday
                      ? 'bg-gradient-to-r from-rose-50 to-pink-50'
                      : isPast
                      ? 'bg-white opacity-45'
                      : 'bg-white'
                  }`}
                >
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden ring-2 ${isToday ? 'ring-rose-300 bg-rose-100 text-rose-600' : 'ring-transparent bg-muted text-muted-foreground'}`}>
                    {p.avatar_url ? <img src={p.avatar_url} alt={p.nome} className="h-full w-full object-cover" /> : ini}
                  </div>
                  <p className={`text-sm flex-1 min-w-0 truncate ${isToday ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{p.nome}</p>
                  <span className={`text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full ${
                    isToday
                      ? 'bg-rose-100 text-rose-600'
                      : isPast
                      ? 'text-muted-foreground'
                      : p.daysUntil <= 3
                      ? 'bg-orange-50 text-orange-500'
                      : 'text-rose-400'
                  }`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
            </div>
            <Link href="/historico" className="text-xs text-primary font-medium hover:underline">Ver tudo →</Link>
          </div>
          <div className="space-y-2 opacity-75">
            {historico.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 rounded-2xl border border-border bg-card">
                {item.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.img} alt={item.titulo} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {item.tipo === 'celula' ? <Users className="h-4 w-4 text-muted-foreground" /> : <Sparkles className="h-4 w-4 text-muted-foreground" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize truncate">{item.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(item.data_hora), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                    {item.local && ` · ${item.local}`}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full self-start mt-0.5 shrink-0 ${item.tipo === 'celula' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                  {item.tipo === 'celula' ? 'Célula' : 'Evento'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Eventos da igreja */}
      {eventos && eventos.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Eventos da igreja</h2>
          </div>
          <div className="space-y-2">
            {eventos.map((evento) => {
              const p = presencasMap.get(evento.id) ?? { minhaResposta: null, totalVou: 0 }
              return <EventoCard key={evento.id} evento={evento} minhaResposta={p.minhaResposta} totalVou={p.totalVou} />
            })}
          </div>
        </section>
      )}

      {/* Fotos — Nossa comunidade */}
      <section>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">Nossa comunidade</p>
        <FotosComunidadeCarousel srcs={galleryPhotos} />
      </section>

      {/* Info da igreja — cultos, endereço, redes sociais */}
      {(church?.horario_culto || church?.endereco || church?.instagram_url || church?.facebook_url || church?.youtube_url) && (
        <div className="space-y-2.5">
          {(church?.horario_culto || church?.endereco) && (
            <div className="grid grid-cols-2 gap-2.5">
              {church?.horario_culto && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-[#0B2447]/10 shrink-0 mt-0.5">
                    <CalendarDays className="h-3.5 w-3.5 text-[#0B2447]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#0B2447]/60 uppercase tracking-wider">Cultos</p>
                    <p className="text-xs font-semibold text-gray-800 mt-0.5 leading-snug">{church.horario_culto}</p>
                  </div>
                </div>
              )}
              {church?.endereco && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-[#0B2447]/10 shrink-0 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-[#0B2447]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[#0B2447]/60 uppercase tracking-wider">Endereço</p>
                    <p className="text-xs font-semibold text-gray-800 mt-0.5 leading-snug line-clamp-3">{church.endereco}</p>
                    <a
                      href="https://www.google.com/maps/place/Igreja+Batista+Zona+Sul/@-5.8897497,-35.2019375,230m/data=!3m1!1e3!4m6!3m5!1s0x7b2f8bc8265d247:0xfd5ac94ff0adde02!8m2!3d-5.8897333!4d-35.2013972!16s%2Fg%2F119x5pn_w?entry=ttu&g_ep=EgoyMDI2MDUxMy4wIKXMDSoASAFQAw%3D%3D"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold text-[#0B2447] hover:text-[#0F52BA] transition-colors"
                    >
                      <MapPin className="h-3 w-3" />
                      Ver no mapa
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Mapa */}
      <section>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">Como nos encontrar</p>
        <div className="rounded-2xl overflow-hidden border border-blue-100 relative">
          <iframe
            src="https://maps.google.com/maps?q=-5.8897333,-35.2013972&z=17&output=embed"
            width="100%"
            height="220"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Localização da Igreja Batista Zona Sul"
          />
          <div className="absolute bottom-3 right-3">
            <a
              href="https://www.google.com/maps/place/Igreja+Batista+Zona+Sul/@-5.8897497,-35.2019375,230m/data=!3m1!1e3!4m6!3m5!1s0x7b2f8bc8265d247:0xfd5ac94ff0adde02!8m2!3d-5.8897333!4d-35.2013972!16s%2Fg%2F119x5pn_w?entry=ttu&g_ep=EgoyMDI2MDUxMy4wIKXMDSoASAFQAw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white shadow-md text-xs font-semibold text-[#0B2447] hover:bg-blue-50 transition-colors"
            >
              <MapPin className="h-3.5 w-3.5" />
              Abrir no mapa
            </a>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="-mx-4 -mb-6 md:-mx-6 bg-[#0B2447] text-white px-6 pt-8 pb-10 rounded-t-3xl mt-2">
        {/* Logo + nome */}
        <div className="flex items-center gap-3 mb-5">
          {church?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={church.logo_url} alt={church?.nome ?? ''} className="h-10 w-10 rounded-xl bg-white p-1.5 object-contain shrink-0" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-xl bg-white p-1.5 object-contain shrink-0" />
          )}
          <div>
            <p className="font-bold text-base leading-tight">{church?.nome ?? 'Igreja Batista Zona Sul'}</p>
            {church?.descricao && (
              <p className="text-xs text-blue-200/70 mt-0.5 line-clamp-1">{church.descricao}</p>
            )}
          </div>
        </div>

        {/* Endereço e horários */}
        <div className="space-y-2 mb-5">
          {church?.endereco && (
            <div className="flex items-start gap-2 text-xs text-blue-100/80">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-300" />
              <span>{church.endereco}</span>
            </div>
          )}
          {church?.horario_culto && (
            <div className="flex items-start gap-2 text-xs text-blue-100/80">
              <CalendarDays className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-300" />
              <span>{church.horario_culto}</span>
            </div>
          )}
        </div>

        {/* Redes sociais */}
        {(church?.instagram_url || church?.facebook_url || church?.youtube_url) && (
          <div className="flex gap-2 mb-6">
            {church?.instagram_url && (
              <a href={church.instagram_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
                {igSvg} Instagram
              </a>
            )}
            {church?.facebook_url && (
              <a href={church.facebook_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                {fbSvg} Facebook
              </a>
            )}
            {church?.youtube_url && (
              <a href={church.youtube_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF0000] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                {ytSvg} YouTube
              </a>
            )}
          </div>
        )}

        {/* Links rápidos — versão para membros logados */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-blue-200/70 border-t border-white/10 pt-5 mb-4">
          <Link href="/celula" className="hover:text-white transition-colors">Minha célula</Link>
          <Link href="/eventos" className="hover:text-white transition-colors">Eventos</Link>
          <Link href="/perfil" className="hover:text-white transition-colors">Meu perfil</Link>
        </div>

        {/* Copyright */}
        <p className="text-[10px] text-blue-200/40">
          © {new Date().getFullYear()} {church?.nome ?? 'Igreja Batista Zona Sul'} · Todos os direitos reservados
        </p>
      </footer>

    </div>
  )
}
