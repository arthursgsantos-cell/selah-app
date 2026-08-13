import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft, CalendarDays, MapPin, ClipboardList, ChevronLeft, ChevronRight,
  Check, X, PlayCircle, FolderOpen, Pencil, Lock, Video,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { resolverVideo } from '@/lib/video-embed'
import { dataBr, STATUS_AULA } from '@/lib/ensino/turma'
import { nomeDoDia, dataLocalIso } from '@/lib/dia-semana'
import { textoRicoEmTextoPuro } from '@/lib/texto-rico'
import { MateriaisAula, type MaterialAula } from '@/components/ensino/materiais-aula'
import { AulaConcluidaBtn } from '@/components/ensino/aula-concluida-btn'
import { AulaDescricao } from '@/components/ensino/aula-descricao'
import { BotaoVideoChamada } from '@/components/ensino/botao-videochamada'
import { linkDaVideoChamada } from '@/lib/ensino/videochamada'
import { idDaTurma } from '@/lib/ensino/consultas'
import type {
  ModoTurma, ModoVideoChamada, StatusAula, TipoMaterial,
} from '@/lib/supabase/types'

export async function generateMetadata({
  params,
}: {
  params: { id: string; numero: string }
}): Promise<Metadata> {
  const turmaId = await idDaTurma(params.id)
  if (!turmaId) return { title: 'Aula não encontrada' }

  const { data } = await createAdminClient()
    .from('ensino_aulas')
    .select('numero, titulo, descricao, ensino_turmas(nome)')
    .eq('turma_id', turmaId)
    .eq('numero', Number(params.numero))
    .maybeSingle()

  if (!data) return { title: 'Aula não encontrada' }

  const aula = data as unknown as {
    numero: number; titulo: string | null; descricao: string | null
    ensino_turmas: { nome: string } | null
  }

  // A prévia do link no WhatsApp mostra o começo da aula, sem os asteriscos
  // da marcação.
  const resumo = aula.descricao ? textoRicoEmTextoPuro(aula.descricao) : ''

  return {
    title: `${aula.titulo ?? `Aula ${aula.numero}`} · ${aula.ensino_turmas?.nome ?? 'Turma'} · IBZS`,
    ...(resumo ? { description: resumo.slice(0, 200) } : {}),
  }
}

/**
 * A página de uma aula.
 *
 * O endereço é `/ensino/turma/[id]/aula/[numero]`, e não o UUID da aula: o
 * número é único dentro da turma (`unique (turma_id, numero)`), sobrevive a
 * recadastro e diz na barra de endereço qual aula é. O caminho também deixa
 * claro de que turma se trata, que é como a pessoa pensa ao mandar o link.
 *
 * A ordem da página é a de quem vai assistir: vídeo, o que a aula é, e só
 * depois o material. É a mesma disposição que serve a uma turma presencial
 * (onde o vídeo pode não existir) e a um curso inteiramente gravado.
 *
 * Tudo pelo cliente do usuário: `ensino_aulas_select` já libera só a inscrito
 * ou a quem leciona, e `ensino_materiais_select` faz o mesmo pelo material.
 */
export default async function AulaPage({
  params,
}: {
  params: { id: string; numero: string }
}) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/aula/${params.numero}`))

  const numero = Number(params.numero)
  if (!Number.isInteger(numero)) notFound()

  // A URL pode trazer o slug da turma; daqui para baixo tudo consulta por UUID.
  const turmaId = await idDaTurma(params.id)
  if (!turmaId) notFound()

  const supabase = await createClient()

  const [turmaRes, aulasRes] = await Promise.all([
    supabase
      .from('ensino_turmas')
      .select('id, nome, modo, sequencial, video_chamada_modo, video_chamada_url, ensino_cursos(nome)')
      .eq('id', turmaId)
      .maybeSingle(),
    supabase
      .from('ensino_aulas')
      .select('id, numero, titulo, descricao, data, hora_inicio, local, status, video_chamada_url')
      .eq('turma_id', turmaId)
      .order('numero'),
  ])

  const turma = turmaRes.data as unknown as {
    id: string; nome: string; modo: ModoTurma; sequencial: boolean
    video_chamada_modo: ModoVideoChamada; video_chamada_url: string | null
    ensino_cursos: { nome: string } | null
  } | null
  if (!turma) notFound()

  const gravado = turma.modo === 'gravado'

  const aulas = (aulasRes.data ?? []) as {
    id: string; numero: number; titulo: string | null; descricao: string | null
    data: string; hora_inicio: string | null; local: string | null; status: StatusAula
    video_chamada_url: string | null
  }[]

  const indice = aulas.findIndex((a) => a.numero === numero)
  // Sem a aula na lista pode ser aula inexistente ou inscrição ainda não
  // aprovada — a RLS não distingue as duas, e a página também não precisa.
  if (indice === -1) notFound()

  const aula = aulas[indice]
  const anterior = aulas[indice - 1] ?? null
  const proxima = aulas[indice + 1] ?? null
  const leciona = await podeLecionar(acesso, turma.id)

  const [materiaisRes, minhasPresencasRes, progressoRes, inscricaoRes] = await Promise.all([
    supabase
      .from('ensino_materiais')
      .select('id, titulo, descricao, tipo, url, arquivo_nome, arquivo_tamanho, criado_em')
      .eq('aula_id', aula.id)
      .order('ordem')
      .order('criado_em'),
    supabase
      .from('ensino_presencas')
      .select('aula_id, presente')
      .eq('user_id', acesso.userId),
    supabase
      .from('ensino_progresso')
      .select('aula_id')
      .eq('turma_id', turma.id)
      .eq('user_id', acesso.userId),
    supabase
      .from('ensino_inscricoes')
      .select('status')
      .eq('turma_id', turma.id)
      .eq('user_id', acesso.userId)
      .maybeSingle(),
  ])

  const materiais = (materiaisRes.data ?? []) as {
    id: string; titulo: string; descricao: string | null; tipo: TipoMaterial
    url: string | null; arquivo_nome: string | null; arquivo_tamanho: number | null
    criado_em: string
  }[]

  /**
   * O que toca no topo da página.
   *
   * Vale tanto o material cadastrado como `video` quanto o `link` que aponta
   * para um: quem cola o endereço de uma aula do YouTube no campo de link não
   * quis um item na lista de downloads, quis a aula. `resolverVideo` é quem
   * decide — Drive, Dropbox e site qualquer devolvem `null` e continuam
   * descendo para a lista de materiais como link.
   *
   * O endereço do vídeo aparece no HTML — é o preço de tocar dentro da página,
   * e só chega aqui quem a policy já deixou ver o material.
   */
  const players = materiais
    .filter((m) => m.tipo === 'video' || m.tipo === 'link')
    .map((m) => ({ material: m, embed: resolverVideo(m.url) }))
    .filter((v) => v.embed !== null)

  const idsNoPlayer = new Set(players.map((p) => p.material.id))
  const outros: MaterialAula[] = materiais
    .filter((m) => !idsNoPlayer.has(m.id))
    .map((m) => ({
      id: m.id,
      titulo: m.titulo,
      descricao: m.descricao,
      tipo: m.tipo,
      arquivoNome: m.arquivo_nome,
      arquivoTamanho: m.arquivo_tamanho,
    }))

  const presencas = new Map(
    ((minhasPresencasRes.data ?? []) as { aula_id: string; presente: boolean }[]).map((p) => [
      p.aula_id,
      p.presente,
    ])
  )
  const minhaPresenca = presencas.has(aula.id) ? presencas.get(aula.id)! : null

  const concluidas = new Set(
    ((progressoRes.data ?? []) as { aula_id: string }[]).map((p) => p.aula_id)
  )
  const inscrito = ['aprovada', 'concluida'].includes(
    (inscricaoRes.data as { status: string } | null)?.status ?? ''
  )

  /**
   * Numa turma sequencial, o progresso é sempre um prefixo da lista: só fecha a
   * aula N quem fechou as N-1 anteriores. Então comparar a posição com o total
   * de concluídas basta — é a mesma conta que a action faz antes de gravar, e
   * as duas precisam concordar.
   */
  const trancada = gravado && turma.sequencial && !leciona && concluidas.size < indice

  const [ano, mes, dia] = aula.data.split('-').map(Number)
  const diaSemana = nomeDoDia(new Date(ano, mes - 1, dia).getDay())

  /**
   * Quando o vídeo entrou no ar.
   *
   * É a data em que o material foi cadastrado aqui, não a que o YouTube exibe:
   * a data de publicação do canal só sai pela API do YouTube, que pede chave e
   * uma chamada externa a cada aula aberta. O que interessa ao aluno — desde
   * quando esta aula está disponível — é justamente esta.
   */
  const videoEm = players[0]?.material.criado_em ?? null

  // A sala do encontro: a fixa do curso, ou a desta aula. Só para quem está na
  // turma — link de chamada é endereço de porta aberta.
  const linkChamada = linkDaVideoChamada(turma, aula)
  const esperandoLink = turma.video_chamada_modo === 'aula' && !aula.video_chamada_url

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-6">
      <Link
        href={`/ensino/turma/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        {turma.nome}
      </Link>

      {/* Progresso do curso gravado, logo abaixo do caminho de volta. */}
      {gravado && inscrito && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Seu progresso
            </span>
            <span className="text-xs font-medium">
              {concluidas.size} de {aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${aulas.length > 0 ? Math.round((concluidas.size / aulas.length) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Identificação da aula */}
      <div>
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
          {turma.ensino_cursos?.nome} · Aula {aula.numero} de {aulas.length}
        </p>
        <h1 className="text-xl font-bold leading-tight mt-0.5">
          {aula.titulo ?? `Aula ${aula.numero}`}
        </h1>
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {/* Numa turma gravada, data e chamada não existem: a aula não
              acontece num dia, ela fica disponível. */}
          {!gravado && (
            <>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {diaSemana?.slice(0, 3)}, {dataBr(aula.data)}
                {aula.hora_inicio && ` · ${aula.hora_inicio.slice(0, 5)}`}
              </span>
              {aula.local && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {aula.local}
                </span>
              )}
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_AULA[aula.status].classe}`}
              >
                {STATUS_AULA[aula.status].label}
              </span>
              {minhaPresenca !== null && (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    minhaPresenca ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {minhaPresenca ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {minhaPresenca ? 'Você esteve presente' : 'Falta registrada'}
                </span>
              )}
            </>
          )}
          {/* Sem data de encontro, o que situa a aula no tempo é quando ela
              entrou no ar e quando foi cadastrada. */}
          {gravado && (
            <>
              {videoEm && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Video className="h-3.5 w-3.5" />
                  Vídeo de {dataBr(dataLocalIso(videoEm))}
                </span>
              )}
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Aula criada em {dataBr(aula.data)}
              </span>
            </>
          )}
          {gravado && concluidas.has(aula.id) && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1">
              <Check className="h-3 w-3" />
              Concluída
            </span>
          )}
        </div>
      </div>

      {/* Entrar na videochamada, logo abaixo do cabeçalho: quem abre a aula na
          hora do encontro veio para isso, e não deve ter de procurar. */}
      {(inscrito || leciona) && linkChamada && <BotaoVideoChamada url={linkChamada} />}
      {(inscrito || leciona) && esperandoLink && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
          <Video className="h-4 w-4 shrink-0" />
          O link desta videochamada ainda não foi publicado.
        </p>
      )}

      {/* Aula trancada: numa turma sequencial, a próxima só abre depois. */}
      {trancada ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Lock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Esta aula ainda não foi liberada</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            O curso é sequencial: conclua as aulas anteriores para abrir esta.
          </p>
          {aulas[concluidas.size] && (
            <Link
              href={`/ensino/turma/${params.id}/aula/${aulas[concluidas.size].numero}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity mt-4"
            >
              Ir para a aula {aulas[concluidas.size].numero}
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      ) : (
        <>
      {/* Vídeo primeiro: numa aula gravada, é a aula. */}
      {players.map(({ material, embed }) => (
        <div
          key={material.id}
          className="rounded-2xl overflow-hidden bg-black shadow-sm aspect-video"
        >
          {embed!.tipo === 'iframe' ? (
            <iframe
              src={embed!.src}
              title={material.titulo}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full"
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={embed!.src} controls playsInline className="h-full w-full" />
          )}
        </div>
      ))}

      <AulaDescricao aulaId={aula.id} descricao={aula.descricao} podeEditar={leciona} />

      {leciona && (
        <div className="flex flex-wrap gap-2">
          {/* Curso gravado não tem chamada: ninguém está na sala para ser
              chamado. O que se acompanha ali é o progresso. */}
          {!gravado && (
            <Link
              href={`/ensino/chamada/${aula.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ClipboardList className="h-4 w-4" />
              Fazer chamada
            </Link>
          )}
          <Link
            href={`/ensino/turma/${params.id}/aulas`}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl border border-border hover:bg-accent transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Editar aula
          </Link>
          <Link
            href={`/ensino/turma/${params.id}/materiais`}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl border border-border hover:bg-accent transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            Materiais
          </Link>
        </div>
      )}

      {/* Materiais da aula */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Materiais desta aula
        </p>
        <MateriaisAula materiais={outros} />
      </section>

      {gravado && inscrito && (
        <AulaConcluidaBtn aulaId={aula.id} concluida={concluidas.has(aula.id)} />
      )}
        </>
      )}

      {/* Navegação entre aulas */}
      <div className="flex items-center justify-between gap-2">
        {anterior ? (
          <Link
            href={`/ensino/turma/${params.id}/aula/${anterior.numero}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors min-w-0"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="truncate max-w-[9rem]">
              {anterior.titulo ?? `Aula ${anterior.numero}`}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {proxima && (
          <Link
            href={`/ensino/turma/${params.id}/aula/${proxima.numero}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity min-w-0"
          >
            <span className="truncate max-w-[9rem]">
              {proxima.titulo ?? `Aula ${proxima.numero}`}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        )}
      </div>

      {/* Índice do curso — a lista de aulas, com a atual destacada */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Aulas do curso
        </p>
        <div className="rounded-2xl border border-border bg-card divide-y overflow-hidden">
          {aulas.map((a, i) => {
            const atual = a.numero === aula.numero
            const presente = presencas.has(a.id) ? presencas.get(a.id)! : null
            const concluida = concluidas.has(a.id)
            // Mesma conta da trava da página: o progresso é um prefixo.
            const fechada = gravado && turma.sequencial && !leciona && concluidas.size < i

            return (
              <Link
                key={a.id}
                href={`/ensino/turma/${params.id}/aula/${a.numero}`}
                aria-current={atual ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                  atual ? 'bg-primary/5' : 'hover:bg-accent'
                } ${fechada ? 'opacity-50' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    atual
                      ? 'bg-primary text-primary-foreground'
                      : concluida
                        ? 'bg-green-100 text-green-700'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {atual ? (
                    <PlayCircle className="h-4 w-4" />
                  ) : concluida ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    a.numero
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug truncate ${atual ? 'font-semibold' : ''}`}>
                    {a.titulo ?? `Aula ${a.numero}`}
                  </p>
                  {!gravado && (
                    <p className="text-xs text-muted-foreground">
                      {dataBr(a.data)}
                      {a.hora_inicio && ` · ${a.hora_inicio.slice(0, 5)}`}
                    </p>
                  )}
                </div>
                {fechada && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                {!gravado && presente !== null && (
                  <span
                    className={`shrink-0 h-5 w-5 rounded-md flex items-center justify-center ${
                      presente ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}
                    title={presente ? 'Presente' : 'Faltou'}
                  >
                    {presente ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
