import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft, CalendarDays, MapPin, Users, GraduationCap, ClipboardList,
  BookOpen, FolderOpen, MessageCircle, ChevronRight, Pencil, Check, Video,
  ListChecks, CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { contarAprovados, contarPendentes } from '@/app/actions/ensino/turmas'
import {
  STATUS_TURMA, encontrosTexto, periodoTexto, vagasRestantes,
  inscricoesDisponiveis, dataBr, STATUS_AULA,
} from '@/lib/ensino/turma'
import { PAINEL, SECAO, CARTAO_ANINHADO } from '@/lib/estilos'
import { InscricaoTurma } from '@/components/ensino/inscricao-turma'
import { DestaqueTurmaBtn } from '@/components/ensino/destaque-turma-btn'
import { TurmaFundo } from '@/components/ensino/turma-fundo'
import { TurmaCapa } from '@/components/ensino/turma-capa'
import { FundoGaleria } from '@/components/shared/fundo-galeria'
import { MateriaisLista, type MaterialItem } from '@/components/ensino/materiais-lista'
import { RegistroAulas, type FotoRegistro } from '@/components/ensino/registro-aulas'
import { BotaoVideoChamada } from '@/components/ensino/botao-videochamada'
import { linkDaVideoChamada } from '@/lib/ensino/videochamada'
import { RedeShareButton } from '@/components/rede/rede-share-button'
import { porSlugOuId } from '@/lib/slug-ou-id'
import type {
  ModoTurma, ModoVideoChamada, StatusAula, StatusInscricaoEnsino, StatusTurma,
  TipoInscricaoTurma,
} from '@/lib/supabase/types'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data } = await porSlugOuId(
    createAdminClient()
      .from('ensino_turmas')
      .select('nome, descricao, capa_url, ensino_cursos(nome)'),
    params.id
  ).maybeSingle()

  if (!data) return { title: 'Turma não encontrada' }

  const turma = data as unknown as {
    nome: string; descricao: string | null; capa_url: string | null
    ensino_cursos: { nome: string } | null
  }

  return {
    title: `${turma.nome} · Ensino IBZS`,
    description: turma.descricao ?? `Turma de ${turma.ensino_cursos?.nome ?? 'Ensino'} da Igreja Batista Zona Sul.`,
    openGraph: turma.capa_url ? { images: [turma.capa_url] } : undefined,
  }
}

export default async function TurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}`))

  const supabase = await createClient()

  const { data: turmaRaw } = await porSlugOuId(
    supabase
      .from('ensino_turmas')
      .select(
        'id, slug, curso_id, nome, descricao, capa_url, capa_pagina_url, local, data_inicio, data_fim, dias_semana, horario_inicio, horario_fim, total_aulas, vagas, inscricoes_abertas, aprovacao_automatica, status, modo, sequencial, destaque, whatsapp_url, tipo_inscricao, link_inscricao_url, video_chamada_modo, video_chamada_url, cor, cor_secundaria, fundo_tipo, fundo_imagem_url, fundo_opacidade, fundo_galeria, fundo_galeria_opacidade, fundo_auto_cor, fundo_auto_cor_origem, ensino_cursos(nome, descricao)'
      ),
    params.id
  ).maybeSingle()

  if (!turmaRaw) notFound()

  const turma = turmaRaw as unknown as {
    id: string; slug: string | null; curso_id: string; nome: string; descricao: string | null
    capa_url: string | null; capa_pagina_url: string | null; local: string | null
    data_inicio: string | null; data_fim: string | null
    dias_semana: number[]; horario_inicio: string | null; horario_fim: string | null
    total_aulas: number | null; vagas: number | null
    inscricoes_abertas: boolean; aprovacao_automatica: boolean
    status: StatusTurma; modo: ModoTurma; sequencial: boolean
    destaque: boolean; whatsapp_url: string | null
    tipo_inscricao: TipoInscricaoTurma
    link_inscricao_url: string | null
    video_chamada_modo: ModoVideoChamada; video_chamada_url: string | null
    cor: string | null; cor_secundaria: string | null
    fundo_tipo: string | null; fundo_imagem_url: string | null; fundo_opacidade: number
    fundo_galeria: boolean; fundo_galeria_opacidade: number
    fundo_auto_cor: boolean; fundo_auto_cor_origem: string | null
    ensino_cursos: { nome: string; descricao: string | null } | null
  }

  // Quem chegou pelo UUID sai daqui com o endereço legível: assim o que for
  // compartilhado a partir desta página já vai bonito, sem depender de o
  // remetente ter vindo pelo link certo. Mesmo caminho da página do evento.
  if (turma.slug && params.id !== turma.slug) redirect(`/ensino/turma/${turma.slug}`)

  /** O que vai nos links desta página — slug quando existe, UUID nas antigas. */
  const chave = turma.slug ?? turma.id

  const leciona = await podeLecionar(acesso, turma.id)
  const admin = createAdminClient()

  const [
    aprovadosMapa, pendentesMapa, professoresRes, minhaInscricaoRes, fotosRes,
  ] = await Promise.all([
    contarAprovados([turma.id]),
    leciona ? contarPendentes([turma.id]) : Promise.resolve({} as Record<string, number>),
    admin
      .from('ensino_turma_professores')
      .select(
        'principal, profiles(id, nome, avatar_url, titulo), membros_pre_cadastro(id, nome)'
      )
      .eq('turma_id', turma.id)
      .order('principal', { ascending: false }),
    supabase
      .from('ensino_inscricoes')
      .select('id, status, observacao')
      .eq('turma_id', turma.id)
      .eq('user_id', acesso.userId)
      .maybeSingle(),
    // A turma não tem galeria própria, então a cascata usa as fotos da
    // comunidade — as mesmas que célula e rede exibem.
    admin
      .from('fotos_comunidade')
      .select('url')
      .eq('igreja_id', acesso.igrejaId)
      .order('criado_em', { ascending: false })
      .limit(24),
  ])

  const fotosDoFundo = ((fotosRes.data ?? []) as { url: string }[]).map((f) => f.url)
  const aprovados = aprovadosMapa[turma.id] ?? 0
  const pendentes = pendentesMapa[turma.id] ?? 0
  const minhaInscricao = minhaInscricaoRes.data as
    | { id: string; status: StatusInscricaoEnsino; observacao: string | null }
    | null

  // O professor sem conta entra pela lista da igreja: aparece com nome e
  // iniciais, e é só isso que a página precisa dele.
  const professores = ((professoresRes.data ?? []) as unknown as {
    profiles: { id: string; nome: string; avatar_url: string | null; titulo: string | null } | null
    membros_pre_cadastro: { id: string; nome: string } | null
  }[])
    .map((p) =>
      p.profiles ??
      (p.membros_pre_cadastro
        ? {
            id: p.membros_pre_cadastro.id,
            nome: p.membros_pre_cadastro.nome,
            avatar_url: null,
            titulo: null,
          }
        : null)
    )
    .filter((p): p is { id: string; nome: string; avatar_url: string | null; titulo: string | null } => p !== null)

  // Inscrito de verdade: é o que libera aulas e materiais. A RLS já recusaria,
  // mas conhecer o estado aqui evita renderizar seções que viriam vazias.
  const inscrito =
    minhaInscricao !== null && ['aprovada', 'concluida'].includes(minhaInscricao.status)

  const [aulasRes, materiaisRes, registroRes, atividadesRes] = await Promise.all([
    inscrito || leciona
      ? supabase
          .from('ensino_aulas')
          .select('id, numero, titulo, data, hora_inicio, local, status, video_chamada_url')
          .eq('turma_id', turma.id)
          .order('numero')
      : Promise.resolve({ data: [] }),
    supabase
      .from('ensino_materiais')
      .select('id, titulo, descricao, tipo, arquivo_nome, arquivo_tamanho, publico, criado_em, ensino_aulas(numero)')
      .eq('turma_id', turma.id)
      .order('ordem')
      .order('criado_em', { ascending: false }),
    // Fotos do registro. A RLS já limita a quem está na turma ou a leciona.
    inscrito || leciona
      ? supabase
          .from('ensino_aula_fotos')
          .select('id, url, legenda, criado_em, aula_id, ensino_aulas(numero, titulo, data)')
          .eq('turma_id', turma.id)
          .order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Atividades. A policy já esconde o rascunho de quem é só aluno, então a
    // mesma consulta serve às duas visões.
    inscrito || leciona
      ? supabase
          .from('ensino_atividades')
          .select('id, tipo, titulo, prazo, publicada')
          .eq('turma_id', turma.id)
          .order('ordem')
          .order('criado_em')
      : Promise.resolve({ data: [] }),
  ])

  const aulas = (aulasRes.data ?? []) as {
    id: string; numero: number; titulo: string | null; data: string
    hora_inicio: string | null; local: string | null; status: StatusAula
    video_chamada_url: string | null
  }[]

  const materiais: MaterialItem[] = ((materiaisRes.data ?? []) as unknown as {
    id: string; titulo: string; descricao: string | null; tipo: MaterialItem['tipo']
    arquivo_nome: string | null; arquivo_tamanho: number | null
    publico: boolean; criado_em: string; ensino_aulas: { numero: number } | null
  }[]).map((m) => ({
    id: m.id,
    titulo: m.titulo,
    descricao: m.descricao,
    tipo: m.tipo,
    arquivoNome: m.arquivo_nome,
    arquivoTamanho: m.arquivo_tamanho,
    publico: m.publico,
    criadoEm: m.criado_em,
    aulaNumero: m.ensino_aulas?.numero ?? null,
  }))

  const fotosRegistro: FotoRegistro[] = ((registroRes.data ?? []) as unknown as {
    id: string; url: string; legenda: string | null; criado_em: string
    aula_id: string | null
    ensino_aulas: { numero: number; titulo: string | null; data: string } | null
  }[]).map((f) => ({
    id: f.id,
    url: f.url,
    legenda: f.legenda,
    criadoEm: f.criado_em,
    aulaId: f.aula_id,
    aulaNumero: f.ensino_aulas?.numero ?? null,
    aulaTitulo: f.ensino_aulas?.titulo ?? null,
    aulaData: f.ensino_aulas?.data ?? null,
  }))

  const atividades = (atividadesRes.data ?? []) as {
    id: string; tipo: 'tarefa' | 'leitura' | 'quiz'; titulo: string
    prazo: string | null; publicada: boolean
  }[]
  const atividadesCount = atividades.length

  const restantes = vagasRestantes(turma.vagas, aprovados)
  const disponivel = inscricoesDisponiveis(turma, aprovados)
  const status = STATUS_TURMA[turma.status]
  const encontros = encontrosTexto(turma.dias_semana, turma.horario_inicio, turma.horario_fim)
  const periodo = periodoTexto(turma.data_inicio, turma.data_fim)

  const motivoIndisponivel = !turma.inscricoes_abertas
    ? 'As inscrições desta turma estão fechadas no momento.'
    : turma.status === 'concluida'
      ? 'Esta turma já foi concluída.'
      : turma.status === 'cancelada'
        ? 'Esta turma foi cancelada.'
        : 'Todas as vagas desta turma já foram preenchidas.'

  const gravado = turma.modo === 'gravado'

  // Progresso do aluno, só onde ele existe: turma gravada.
  const { data: progressoRaw } = gravado && inscrito
    ? await supabase
        .from('ensino_progresso')
        .select('aula_id')
        .eq('turma_id', turma.id)
        .eq('user_id', acesso.userId)
    : { data: [] }

  const concluidas = new Set(
    ((progressoRaw ?? []) as { aula_id: string }[]).map((p) => p.aula_id)
  )

  // Numa turma gravada não há "próxima do calendário": o que continua é a
  // primeira aula que a pessoa ainda não concluiu.
  const hoje = new Date().toISOString().slice(0, 10)
  const proximaAula = gravado
    ? aulas.find((a) => !concluidas.has(a.id))
    : aulas.find((a) => a.data >= hoje && a.status !== 'cancelada')

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-6">
      <Link
        href="/ensino"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Ensino
      </Link>

      {/* Fundo personalizado — mesma mecânica da página de evento */}
      <FundoGaleria
        fotos={fotosDoFundo}
        opacidade={turma.fundo_galeria_opacidade ?? 35}
        ativo={turma.fundo_galeria ?? false}
      />
      <div className="flex justify-end">
        <TurmaFundo
          turmaId={turma.id}
          cor={turma.cor}
          corSecundaria={turma.cor_secundaria}
          fundoTipo={turma.fundo_tipo}
          fundoImagemUrl={turma.fundo_imagem_url}
          fundoOpacidade={turma.fundo_opacidade}
          galeriaAtiva={turma.fundo_galeria ?? false}
          galeriaOpacidade={turma.fundo_galeria_opacidade ?? 35}
          totalFotos={fotosDoFundo.length}
          capaUrl={turma.capa_url}
          autoCorAtivo={turma.fundo_auto_cor ?? false}
          autoCorOrigem={turma.fundo_auto_cor_origem}
          canEdit={leciona}
        />
      </div>

      {/* Capa */}
      <TurmaCapa
        turmaId={turma.id}
        nome={turma.nome}
        cursoNome={turma.ensino_cursos?.nome ?? 'Curso'}
        capaUrl={turma.capa_url}
        capaPaginaUrl={turma.capa_pagina_url}
        canEdit={leciona}
      />

      {/* Ficha da turma */}
      <div className={`${PAINEL} space-y-3`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.classe}`}>
            {status.label}
          </span>
          {/* Compartilhar é de todo mundo: convidar alguém para o curso não é
              tarefa de professor. */}
          <div className="flex items-center gap-1.5">
            {leciona && (
              <>
                <DestaqueTurmaBtn turmaId={turma.id} destaque={turma.destaque} />
                <Button
                  size="sm"
                  variant="ghost"
                  render={<Link href={`/ensino/turma/${chave}/editar`} />}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              </>
            )}
            <RedeShareButton nome={turma.nome} prefixo="" />
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          {encontros && (
            <div className="flex items-start gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <div>
                <dd>{encontros}</dd>
                {periodo && <dd className="text-xs text-muted-foreground">{periodo}</dd>}
              </div>
            </div>
          )}
          {turma.local && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <dd>{turma.local}</dd>
            </div>
          )}
          {/* Turma que se encontra online: a sala fica aqui, no lugar do
              endereço. Só para quem está na turma — link de chamada aberta na
              página pública é convite a estranho. Quando o link é por aula, é
              a aula que o mostra. */}
          {turma.video_chamada_modo === 'turma' && turma.video_chamada_url && (inscrito || leciona) && (
            <div className="flex items-start gap-2">
              <Video className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <dd>
                <BotaoVideoChamada url={turma.video_chamada_url} forma="linha" />
              </dd>
            </div>
          )}
          {turma.video_chamada_modo === 'aula' && (inscrito || leciona) && (
            <div className="flex items-start gap-2">
              <Video className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <dd className="text-muted-foreground">
                Encontros por videochamada — o link fica na página de cada aula.
              </dd>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <dd>
              {aprovados} {aprovados === 1 ? 'inscrito' : 'inscritos'}
              {restantes !== null && (
                <span className="text-muted-foreground">
                  {' '}· {restantes} {restantes === 1 ? 'vaga restante' : 'vagas restantes'}
                </span>
              )}
              {turma.vagas === null && <span className="text-muted-foreground"> · sem limite de vagas</span>}
            </dd>
          </div>
          {turma.total_aulas && (
            <div className="flex items-start gap-2">
              <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <dd>{turma.total_aulas} aulas</dd>
            </div>
          )}
        </dl>

        {professores.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              {professores.length === 1 ? 'Professor' : 'Professores'}
            </p>
            <div className="space-y-2">
              {professores.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      referrerPolicy="no-referrer"
                      src={p.avatar_url}
                      alt={p.nome}
                      className="h-8 w-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {p.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{p.nome}</p>
                    {p.titulo && <p className="text-xs text-muted-foreground">{p.titulo}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(turma.descricao || turma.ensino_cursos?.descricao) && (
          <div className="border-t pt-3">
            <p className="text-sm whitespace-pre-line leading-relaxed">
              {turma.descricao || turma.ensino_cursos?.descricao}
            </p>
          </div>
        )}

        {turma.whatsapp_url && (inscrito || leciona) && (
          <a
            href={turma.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800 transition-colors border-t pt-3"
          >
            <MessageCircle className="h-4 w-4" />
            Grupo da turma no WhatsApp
          </a>
        )}
      </div>

      {/* Inscrição */}
      <InscricaoTurma
        turmaId={turma.id}
        inscricao={minhaInscricao}
        disponivel={disponivel}
        motivoIndisponivel={motivoIndisponivel}
        tipo={turma.tipo_inscricao ?? 'app'}
        linkUrl={turma.link_inscricao_url}
        grupoUrl={turma.whatsapp_url}
      />

      {/* Atalhos de quem administra a turma */}
      {leciona && (
        <section className={SECAO}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Gestão da turma
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <AtalhoGestao
              href={`/ensino/turma/${chave}/alunos`}
              icone={<Users className="h-5 w-5" />}
              titulo="Alunos e inscrições"
              descricao={
                pendentes > 0
                  ? `${pendentes} ${pendentes === 1 ? 'pedido pendente' : 'pedidos pendentes'}`
                  : `${aprovados} ${aprovados === 1 ? 'aluno' : 'alunos'}`
              }
              destaque={pendentes > 0}
            />
            <AtalhoGestao
              href={`/ensino/turma/${chave}/aulas`}
              icone={<ClipboardList className="h-5 w-5" />}
              titulo="Aulas e chamada"
              descricao={`${aulas.length} ${aulas.length === 1 ? 'aula' : 'aulas'} cadastradas`}
            />
            <AtalhoGestao
              href={`/ensino/turma/${chave}/materiais`}
              icone={<FolderOpen className="h-5 w-5" />}
              titulo="Materiais"
              descricao={`${materiais.length} ${materiais.length === 1 ? 'item' : 'itens'}`}
            />
            <AtalhoGestao
              href={`/ensino/turma/${chave}/presencas`}
              icone={<BookOpen className="h-5 w-5" />}
              titulo="Frequência"
              descricao="Histórico de presenças"
            />
            <AtalhoGestao
              href={`/ensino/turma/${chave}/atividades`}
              icone={<ListChecks className="h-5 w-5" />}
              titulo="Atividades"
              descricao={
                atividadesCount > 0
                  ? `${atividadesCount} ${atividadesCount === 1 ? 'atividade' : 'atividades'}`
                  : 'Tarefas, leitura e provas'
              }
            />
          </div>
        </section>
      )}

      {/* Próxima aula */}
      {/* Progresso do curso gravado */}
      {gravado && inscrito && aulas.length > 0 && (
        <section className={SECAO}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Seu progresso
              </p>
              <span className="text-xs font-medium">
                {concluidas.size} de {aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((concluidas.size / aulas.length) * 100)}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {(inscrito || leciona) && proximaAula && (
        <section className={SECAO}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {gravado ? (concluidas.size > 0 ? 'Continue de onde parou' : 'Comece por aqui') : 'Próxima aula'}
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
            <Link
              href={`/ensino/turma/${chave}/aula/${proximaAula.numero}`}
              className="flex items-center gap-3 min-w-0 flex-1 group"
            >
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="text-[9px] font-bold uppercase leading-none">Aula</span>
                <span className="text-base font-bold leading-none mt-0.5">{proximaAula.numero}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
                  {proximaAula.titulo ?? `Aula ${proximaAula.numero}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {gravado ? (
                    `Aula ${proximaAula.numero} de ${aulas.length}`
                  ) : (
                    <>
                      {dataBr(proximaAula.data)}
                      {proximaAula.hora_inicio && ` · ${proximaAula.hora_inicio.slice(0, 5)}`}
                      {proximaAula.local && ` · ${proximaAula.local}`}
                    </>
                  )}
                </p>
              </div>
            </Link>
            {leciona && !gravado && (
              <Link
                href={`/ensino/chamada/${proximaAula.id}`}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Fazer chamada
              </Link>
            )}
            </div>
            {/* O botão de entrar fica aqui e não só na página da aula: na hora
                do encontro, a turma é a tela em que a pessoa já está. */}
            {linkDaVideoChamada(turma, proximaAula) && (
              <BotaoVideoChamada url={linkDaVideoChamada(turma, proximaAula)!} />
            )}
          </div>
        </section>
      )}

      {/* Atividades da turma. Antes do registro porque é o que tem prazo —
          o aluno que abre a turma quer saber o que deve fazer. */}
      {(inscrito || leciona) && atividades.length > 0 && (
        <section className={SECAO}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Atividades
            </p>
            {leciona && (
              <Link
                href={`/ensino/turma/${chave}/atividades`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Gerenciar
              </Link>
            )}
          </div>
          <div className={`${CARTAO_ANINHADO} divide-y overflow-hidden p-0`}>
            {atividades.map((a) => (
              <Link
                key={a.id}
                href={`/ensino/atividade/${a.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {a.tipo === 'leitura' ? (
                    <BookOpen className="h-4 w-4" />
                  ) : a.tipo === 'quiz' ? (
                    <ClipboardList className="h-4 w-4" />
                  ) : (
                    <ListChecks className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {a.titulo}
                    {!a.publicada && (
                      <span className="ml-1.5 align-middle text-[10px] text-muted-foreground">
                        rascunho
                      </span>
                    )}
                  </p>
                  {a.prazo && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarClock className="h-2.5 w-2.5" />
                      até {dataBr(a.prazo)}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Registro — as fotos do que aconteceu. Antes dos materiais porque é
          memória da turma, não conteúdo de estudo. */}
      {(inscrito || leciona) && (fotosRegistro.length > 0 || leciona) && (
        <RegistroAulas
          turmaId={turma.id}
          turmaNome={turma.nome}
          cursoNome={turma.ensino_cursos?.nome ?? 'Ensino'}
          fotos={fotosRegistro}
          aulas={aulas.map((a) => ({
            id: a.id,
            numero: a.numero,
            titulo: a.titulo ?? `Aula ${a.numero}`,
            data: a.data,
          }))}
          canEdit={leciona}
        />
      )}

      {/* Materiais */}
      {(inscrito || leciona || materiais.length > 0) && (
        <section className={SECAO}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Materiais
            </p>
            {leciona && (
              <Link
                href={`/ensino/turma/${chave}/materiais`}
                className="text-xs text-primary hover:underline font-medium"
              >
                Gerenciar
              </Link>
            )}
          </div>
          <MateriaisLista
            materiais={materiais}
            vazio={
              inscrito || leciona
                ? 'Nenhum material publicado ainda.'
                : 'Os materiais aparecem depois que sua inscrição for aprovada.'
            }
          />
        </section>
      )}

      {/* Calendário de aulas — visível só para inscritos e professores */}
      {(inscrito || leciona) && aulas.length > 0 && (
        <section className={SECAO}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Aulas
          </p>
          <div className="rounded-2xl border border-border divide-y overflow-hidden">
            {aulas.map((a) => (
              <Link
                key={a.id}
                href={`/ensino/turma/${chave}/aula/${a.numero}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    concluidas.has(a.id)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {concluidas.has(a.id) ? <Check className="h-4 w-4" /> : a.numero}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug truncate">{a.titulo ?? `Aula ${a.numero}`}</p>
                  {!gravado && (
                    <p className="text-xs text-muted-foreground">
                      {dataBr(a.data)}
                      {a.hora_inicio && ` · ${a.hora_inicio.slice(0, 5)}`}
                    </p>
                  )}
                </div>
                {!gravado && (
                  <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_AULA[a.status].classe}`}>
                    {STATUS_AULA[a.status].label}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AtalhoGestao({
  href, icone, titulo, descricao, destaque = false,
}: {
  href: string
  icone: React.ReactNode
  titulo: string
  descricao: string
  destaque?: boolean
}) {
  // Fica dentro da seção, e cartão branco sobre cartão branco some: o tom
  // suave devolve o contorno.
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-colors hover:bg-accent ${
        destaque ? 'border-amber-300 bg-amber-50' : `border-border ${CARTAO_ANINHADO}`
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icone}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{titulo}</p>
        <p className={`truncate text-xs ${destaque ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>
          {descricao}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
