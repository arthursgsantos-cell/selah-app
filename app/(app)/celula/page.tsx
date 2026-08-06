import { FundoGaleria } from '@/components/shared/fundo-galeria'
import { loginCom } from '@/lib/destino-login'
import { PAINEL } from '@/lib/estilos'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Users, CalendarDays, MapPin, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CelulaTabs } from '@/components/celula/celula-tabs'
import { projetarDatasCelula, montarEscalasCalendario, type EscalaRowBanco } from '@/lib/calendario-celula'
import { CelulaLogoUpload } from '@/components/celula/celula-logo-upload'
import { CelulaCapaUpload } from '@/components/celula/celula-capa-upload'
import { CelulaFundoPagina } from '@/components/celula/celula-fundo-pagina'
import { EditarCelulaDialog } from '@/components/supervisor/editar-celula-dialog'

type MembroComProfile = {
  user_id: string
  papel: 'lider' | 'membro'
  profiles: { nome: string; avatar_url: string | null; conjuge_id: string | null; data_nascimento_1: string | null; data_nascimento_2: string | null; data_casamento: string | null; endereco: string | null; endereco_maps: string | null } | null
}

type EncontroRow = {
  id: string
  data_hora: string
  local: string | null
  local_maps_url: string | null
  status: string
  card_imagem_url: string | null
}

interface AnivSemana {
  nome: string
  subtitulo?: string
  avatar_url: string | null
  daysUntil: number
}

function diasAteAniv(dataStr: string): number {
  const [, mm, dd] = dataStr.split('-')
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const ano = hoje.getFullYear()
  let d = new Date(ano, parseInt(mm, 10) - 1, parseInt(dd, 10))
  d.setHours(0, 0, 0, 0)
  if (d < hoje) d = new Date(ano + 1, parseInt(mm, 10) - 1, parseInt(dd, 10))
  return Math.floor((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function MinhasCelulaPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/celula'))

  const [{ data: membroCelula }, { data: profile }] = await Promise.all([
    supabase.from('celula_membros').select('celula_id, papel').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!membroCelula) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-base font-semibold">Você ainda não está em uma célula</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Aguarde seu líder ou supervisor te adicionar.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const celulaId = membroCelula.celula_id
  const isAdminRole = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento'].includes(profile?.role ?? '')
  const canEdit = isAdminRole || membroCelula.papel === 'lider'
  const canDelete = isAdminRole

  const admin = createAdminClient()

  const [
    { data: celula, error: celulaError },
    { data: membrosData },
    { data: encontrosData },
    { data: fotosData },
    { data: escalasData },
    { data: preCadastradosData },
    { data: celulasDisponiveisData },
  ] = await Promise.all([
    admin
      .from('celulas')
      .select('id, nome, descricao, logo_url, capa_url, cor, cor_secundaria, fundo_tipo, fundo_imagem_url, fundo_opacidade, fundo_galeria, fundo_galeria_opacidade, fundo_auto_cor, fundo_auto_cor_origem, capa_automatica, frequencia, local_padrao, dia_semana, horario, rede_id')
      .eq('id', celulaId)
      .single(),
    admin
      .from('celula_membros')
      .select('user_id, papel, profiles(nome, avatar_url, conjuge_id, data_nascimento_1, data_nascimento_2, data_casamento, endereco, endereco_maps)')
      .eq('celula_id', celulaId),
    admin
      .from('encontros')
      .select('id, data_hora, local, local_maps_url, status, card_imagem_url')
      .eq('celula_id', celulaId)
      .order('data_hora', { ascending: false })
      .limit(20),
    admin
      .from('fotos_comunidade')
      .select('id, url, criado_em')
      .eq('celula_id', celulaId)
      .order('criado_em', { ascending: false }),
    // Escalas da célula: as já ligadas a um encontro e as ainda "de sobre aviso".
    admin
      .from('escalas')
      .select('funcao, responsavel_id, data_prevista, encontro_id, encontros(data_hora)')
      .eq('celula_id', celulaId),
    // Pessoas já organizadas nesta célula que ainda não criaram conta.
    admin
      .from('membros_pre_cadastro')
      .select('id, nome, email, telefone, cargo, celula_id')
      .eq('celula_id', celulaId)
      .is('profile_id', null)
      .order('nome'),
    admin.from('celulas').select('id, nome').neq('ativa', false).order('nome'),
  ])

  if (celulaError) console.error('[celula/page] erro ao buscar célula:', celulaError.message, '| celulaId:', celulaId)
  if (!celula) redirect('/home')

  const membros = ((membrosData ?? []) as unknown as MembroComProfile[]).map((m) => ({
    user_id: m.user_id,
    nome: m.profiles?.nome ?? 'Membro',
    avatar_url: m.profiles?.avatar_url ?? null,
    conjuge_id: m.profiles?.conjuge_id ?? null,
    data_nascimento_1: m.profiles?.data_nascimento_1 ?? null,
    data_nascimento_2: m.profiles?.data_nascimento_2 ?? null,
    data_casamento: m.profiles?.data_casamento ?? null,
    endereco: m.profiles?.endereco ?? null,
    endereco_maps: m.profiles?.endereco_maps ?? null,
    papel: m.papel,
  }))

  const membroIds = membros.map((m) => m.user_id)
  const [{ data: dependentesData }, { data: presencasMembros }] = await Promise.all([
    membroIds.length
      ? admin.from('dependentes').select('profile_id, nome, data_nascimento, tipo, sexo').in('profile_id', membroIds)
      : Promise.resolve({ data: [] }),
    membroIds.length
      ? admin.from('evento_presencas').select('evento_id, user_id').eq('resposta', 'vou').in('user_id', membroIds)
      : Promise.resolve({ data: [] }),
  ])

  // Eventos da igreja com membros confirmados
  const eventosComPresencaIds = [...new Set((presencasMembros ?? []).map((p) => p.evento_id))]
  const { data: eventosConfirmadosData } = eventosComPresencaIds.length
    ? await admin
        .from('eventos')
        .select('id, slug, titulo, data_hora, local, tipo, imagem_url')
        .in('id', eventosComPresencaIds)
        .gte('data_hora', new Date().toISOString())
        .order('data_hora', { ascending: true })
        .limit(5)
    : { data: [] }

  type EventoComMembros = {
    id: string; slug: string | null; titulo: string; data_hora: string; local: string | null
    tipo: string; imagem_url: string | null
    membrosVao: Array<{ nome: string; avatar_url: string | null }>
  }
  const eventosConfirmados: EventoComMembros[] = (eventosConfirmadosData ?? []).map((ev) => {
    const uidsVao = (presencasMembros ?? []).filter((p) => p.evento_id === ev.id).map((p) => p.user_id)
    return {
      ...ev,
      membrosVao: membros.filter((m) => uidsVao.includes(m.user_id)).map((m) => ({ nome: m.nome, avatar_url: m.avatar_url })),
    }
  })

  // Aniversariantes da semana (próximos 7 dias)
  const aniversariantesSemana: AnivSemana[] = []
  for (const m of membros) {
    if (m.data_nascimento_1) {
      const d = diasAteAniv(m.data_nascimento_1)
      if (d <= 6) aniversariantesSemana.push({ nome: m.nome, avatar_url: m.avatar_url, daysUntil: d })
    }
  }
  for (const dep of (dependentesData ?? [])) {
    if (dep.data_nascimento) {
      const d = diasAteAniv(dep.data_nascimento)
      if (d <= 6) {
        const membroNome = membros.find((m) => m.user_id === dep.profile_id)?.nome?.split(' ')[0]
        // "Cônjuge" fica sem tag (mesma razão da aba Aniversários: ambíguo
        // quando o outro lado também tem conta própria). Filho(a) ganha
        // rótulo por sexo quando cadastrado.
        const rotulo = dep.tipo === 'cônjuge'
          ? null
          : dep.sexo === 'M' ? 'Filho' : dep.sexo === 'F' ? 'Filha' : 'Filho(a)'
        aniversariantesSemana.push({
          nome: dep.nome,
          subtitulo: rotulo ? `${rotulo}${membroNome ? ` de ${membroNome}` : ''}` : undefined,
          avatar_url: null,
          daysUntil: d,
        })
      }
    }
  }
  aniversariantesSemana.sort((a, b) => a.daysUntil - b.daysUntil)

  const lideres = membros.filter((m) => m.papel === 'lider')

  const encontros = ((encontrosData ?? []) as EncontroRow[]).map((e) => ({
    id: e.id,
    data_hora: e.data_hora,
    local: e.local,
    local_maps_url: e.local_maps_url,
    status: e.status,
    card_imagem_url: e.card_imagem_url,
  }))

  // ── Calendário: datas futuras + escalas (ligadas ao encontro ou de sobre aviso)
  const datasCalendario = projetarDatasCelula(
    { dia_semana: celula.dia_semana, frequencia: celula.frequencia, horario: celula.horario },
    encontros,
  )
  const escalasCalendario = montarEscalasCalendario(
    (escalasData ?? []) as unknown as EscalaRowBanco[],
    membros,
  )

  const iniciais = celula.nome
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()

  const frequenciaLabel = celula.frequencia === 'semanal' ? 'Semanal' : 'Quinzenal'

  // Fotos da própria célula, já em ordem decrescente de data na consulta.
  const aparencia = celula as unknown as {
    fundo_galeria?: boolean; fundo_galeria_opacidade?: number
    fundo_auto_cor?: boolean; fundo_auto_cor_origem?: string | null
    capa_automatica?: boolean
  }
  const fotosDoFundo = ((fotosData ?? []) as { url: string }[]).map((f) => f.url)

  // Nome da rede: entra na marca d'água do visualizador de fotos.
  const { data: redeDaCelula } = (celula as { rede_id?: string | null }).rede_id
    ? await admin.from('redes').select('nome').eq('id', (celula as { rede_id: string }).rede_id).maybeSingle()
    : { data: null }
  const redeNome = (redeDaCelula as { nome: string } | null)?.nome ?? null

  // Lista para transferir a célula de rede. Só a gestão recebe (a lista
  // vazia esconde o campo no diálogo).
  const { data: redesData } = await admin.from('redes').select('id, nome').order('nome')
  const redesDisponiveis = (redesData ?? []) as { id: string; nome: string }[]
  const galeriaAtiva = aparencia.fundo_galeria ?? true
  const galeriaOpacidade = aparencia.fundo_galeria_opacidade ?? 15

  // A capa automática usa a foto mais recente da galeria; os cards de encontro
  // ficam de fora porque são artes com texto.
  const capaAutomatica = aparencia.capa_automatica ?? true
  const fotoMaisRecente = fotosDoFundo[0] ?? null
  const capaExibida = capaAutomatica ? fotoMaisRecente ?? celula.capa_url : celula.capa_url

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <FundoGaleria fotos={fotosDoFundo} opacidade={galeriaOpacidade} ativo={galeriaAtiva} />

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {/* Camada de fundo da página + editor de aparência (só para quem edita) */}
        <CelulaFundoPagina
          celulaId={celulaId}
          cor={celula.cor ?? '#6366f1'}
          corSecundaria={celula.cor_secundaria}
          fundoTipo={celula.fundo_tipo ?? 'cor'}
          fundoImagemUrl={celula.fundo_imagem_url}
          fundoOpacidade={celula.fundo_opacidade}
          galeriaAtiva={galeriaAtiva}
          galeriaOpacidade={galeriaOpacidade}
          totalFotos={fotosDoFundo.length}
          capaUrl={capaExibida}
          autoCorAtivo={aparencia.fundo_auto_cor ?? true}
          autoCorOrigem={aparencia.fundo_auto_cor_origem ?? null}
          canEdit={canEdit}
        />
      </div>

      {/* Banner/capa da célula */}
      <CelulaCapaUpload
        celulaId={celulaId}
        capaUrl={celula.capa_url}
        fotoMaisRecente={fotoMaisRecente}
        capaAutomatica={capaAutomatica}
        cor={celula.cor ?? '#6366f1'}
        canEdit={canEdit}
      />

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <CelulaLogoUpload celulaId={celulaId} logoUrl={celula.logo_url} iniciais={iniciais} cor={null} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-bold leading-tight">{celula.nome}</h1>
                {canEdit && (
                  <EditarCelulaDialog
                    celulaId={celulaId}
                    nome={celula.nome}
                    descricao={celula.descricao}
                    localPadrao={celula.local_padrao}
                    frequencia={celula.frequencia}
                    diaSemana={celula.dia_semana}
                    horario={celula.horario}
                    cor={null}
                    canDelete={canDelete}
                    redeId={(celula as { rede_id?: string | null }).rede_id ?? null}
                    redes={isAdminRole ? redesDisponiveis : []}
                  />
                )}
              </div>
              {celula.descricao && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{celula.descricao}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="secondary" className="text-xs">{frequenciaLabel}</Badge>
                {celula.local_padrao && (
                  <Badge variant="outline" className="text-xs">{celula.local_padrao}</Badge>
                )}
              </div>
            </div>
          </div>

          {lideres.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">{lideres.length === 1 ? 'Líder' : 'Líderes'}</p>
              <div className="flex flex-wrap gap-2">
                {lideres.map((lider) => (
                  <div key={lider.user_id} className="flex items-center gap-1.5 bg-muted rounded-full pl-0.5 pr-3 py-0.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={lider.avatar_url ?? undefined} alt={lider.nome} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {lider.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{lider.nome.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aniversariantes da semana */}
      {aniversariantesSemana.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-500 p-4 text-white shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎂</span>
            <h2 className="font-bold text-sm">
              {aniversariantesSemana.length === 1 ? 'Aniversariante da semana' : 'Aniversariantes da semana'}
            </h2>
          </div>
          <div className="space-y-2">
            {aniversariantesSemana.map((a, i) => {
              const ini = a.nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
              const label = a.daysUntil === 0 ? 'Hoje! 🎉' : a.daysUntil === 1 ? 'Amanhã' : `Em ${a.daysUntil} dias`
              return (
                <div key={i} className="flex items-center gap-3 bg-white/20 rounded-xl p-2.5">
                  <div className="h-9 w-9 rounded-full bg-white/30 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                    {a.avatar_url
                      ? <img referrerPolicy="no-referrer" src={a.avatar_url} alt={a.nome} className="h-full w-full object-cover rounded-full" />
                      : ini}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{a.nome}</p>
                    {a.subtitulo && <p className="text-xs text-white/70">{a.subtitulo}</p>}
                  </div>
                  <span className="text-xs font-bold text-white shrink-0">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Membros da célula confirmados em eventos da igreja */}
      {eventosConfirmados.length > 0 && (
        <div className={`${PAINEL} space-y-2`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Eventos da igreja</h2>
          </div>
          {eventosConfirmados.map((ev) => (
            <Link
              key={ev.id}
              href={`/evento/${ev.slug ?? ev.id}`}
              className="rounded-2xl border border-border bg-card p-3 flex gap-3 hover:bg-accent transition-colors"
            >
              {ev.imagem_url ? (
                <img src={ev.imagem_url} alt={ev.titulo} className="h-12 w-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarDays className="h-5 w-5 text-primary/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{ev.titulo}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {format(new Date(ev.data_hora), "EEE, d 'de' MMM 'às' HH'h'mm", { locale: ptBR })}
                </p>
                {ev.local && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {ev.local}
                  </p>
                )}
                {/* Membros que vão */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {ev.membrosVao.map((m, i) => (
                    <div key={i} className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full pl-0.5 pr-2 py-0.5">
                      <div className="h-4 w-4 rounded-full bg-green-200 overflow-hidden shrink-0">
                        {m.avatar_url
                          ? <img referrerPolicy="no-referrer" src={m.avatar_url} alt={m.nome} className="h-full w-full object-cover" />
                          : <span className="text-[8px] font-bold text-green-700 flex items-center justify-center h-full">
                              {m.nome[0]}
                            </span>
                        }
                      </div>
                      <span className="text-[11px] font-medium text-green-700">{m.nome.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CelulaTabs
        encontros={encontros}
        membros={membros}
        celulaId={celulaId}
        celulaNome={celula.nome}
        localPadrao={celula.local_padrao}
        diaSemana={celula.dia_semana}
        horarioPadrao={celula.horario}
        dependentes={dependentesData ?? []}
        celulaColor={null}
        fotosInit={(fotosData ?? []) as { id: string; url: string; criado_em: string }[]}
        redeNome={redeNome}
        canUpload={canEdit}
        datasCalendario={datasCalendario}
        escalasCalendario={escalasCalendario}
        canEditEscala={canEdit}
        preCadastrados={preCadastradosData ?? []}
        celulasDisponiveis={(celulasDisponiveisData ?? []) as { id: string; nome: string }[]}
      />
    </div>
  )
}
