import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft, BarChart3, CalendarClock, Eye, Pencil, BookOpen, ClipboardList,
  FileQuestion, AlertTriangle,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { atividadeCompleta, inscricaoNaTurma, perguntasDaAtividade } from '@/lib/ensino/atividades-consultas'
import { disponivel, semGabarito, textoPrazo, TIPO_ATIVIDADE } from '@/lib/ensino/atividades'
import { garantirCronogramaAction } from '@/app/actions/ensino/atividades'
import { textoRicoParaHtml, textoRicoEmTextoPuro } from '@/lib/texto-rico'
import { resolverVideo } from '@/lib/video-embed'
import { LinkPreviewLayer } from '@/components/shared/link-preview-layer'
import { AtividadeTarefa } from '@/components/ensino/atividade-tarefa'
import { AtividadeLeitura, type ItemCronograma } from '@/components/ensino/atividade-leitura'
import { AtividadeQuiz, type RespostaDada } from '@/components/ensino/atividade-quiz'
import type { StatusEntrega } from '@/lib/supabase/types'

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const atividade = await atividadeCompleta(params.id)
  if (!atividade) return { title: 'Atividade não encontrada' }

  const resumo = atividade.descricao ? textoRicoEmTextoPuro(atividade.descricao) : ''
  return {
    title: `${atividade.titulo} · ${atividade.turmaNome} · IBZS`,
    ...(resumo ? { description: resumo.slice(0, 200) } : {}),
  }
}

/**
 * A página de uma atividade.
 *
 * Serve ao aluno e ao professor com a mesma composição: capa, vídeo de
 * abertura, os blocos que o professor arrastou e, no fim, o miolo do tipo —
 * o botão de feito, o cronograma ou a prova. O professor vê por cima uma
 * barra com os atalhos de editar e acompanhar, e vê também o rascunho.
 *
 * A prova nunca é montada a partir da tabela direto: `semGabarito` tira
 * `correta` e `resposta_esperada` antes de qualquer coisa descer para o
 * navegador. Ver a policy em `supabase/migrations/ensino_atividades.sql`.
 */
export default async function AtividadePage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/atividade/${params.id}`))

  const atividade = await atividadeCompleta(params.id)
  if (!atividade) notFound()

  const leciona = await podeLecionar(acesso, atividade.turmaId)
  const inscricao = await inscricaoNaTurma(atividade.turmaId, acesso.userId)

  // Nem da turma nem da equipe: a atividade não existe para esta pessoa.
  if (!leciona && !inscricao) notFound()

  const aberta = disponivel({ publicada: atividade.publicada, abre_em: atividade.abreEm })
  if (!leciona && !aberta) notFound()

  const admin = createAdminClient()
  const prazo = textoPrazo(atividade.prazo)
  const meta = TIPO_ATIVIDADE[atividade.tipo]

  // A entrega do aluno. O professor abre a página como prévia, sem entrega.
  const { data: entregaData } = inscricao
    ? await admin
        .from('ensino_atividade_entregas')
        .select('id, status, concluida, comentario, nota, observacao')
        .eq('atividade_id', atividade.id)
        .eq('inscricao_id', inscricao.id)
        .maybeSingle()
    : { data: null }

  const entrega = entregaData as {
    id: string; status: StatusEntrega; concluida: boolean; comentario: string | null
    nota: number | null; observacao: string | null
  } | null

  // Cronograma do desafio de leitura.
  let itensLeitura: ItemCronograma[] = []
  if (atividade.tipo === 'leitura' && inscricao) {
    // Quem entrou na turma depois da publicação ainda não tem cronograma.
    await garantirCronogramaAction(atividade.id, inscricao.id)

    const { data } = await admin
      .from('ensino_leitura_itens')
      .select('id, ordem, rotulo, capitulo_inicio, rodada, data_prevista, feito, biblia_livros(sigla)')
      .eq('atividade_id', atividade.id)
      .eq('inscricao_id', inscricao.id)
      .order('ordem')

    itensLeitura = ((data ?? []) as unknown as {
      id: string; ordem: number; rotulo: string; capitulo_inicio: number | null
      rodada: number; data_prevista: string | null; feito: boolean
      biblia_livros: { sigla: string } | null
    }[]).map((i) => ({
      id: i.id,
      ordem: i.ordem,
      rotulo: i.rotulo,
      livroSigla: i.biblia_livros?.sigla ?? null,
      capituloInicio: i.capitulo_inicio,
      rodada: i.rodada,
      dataPrevista: i.data_prevista,
      feito: i.feito,
    }))
  }

  // Perguntas do quiz, sem gabarito.
  const perguntas = atividade.tipo === 'quiz' ? await perguntasDaAtividade(atividade.id) : []
  const paraResponder = perguntas.map((p) =>
    semGabarito({
      id: p.id,
      secao_id: p.secaoId,
      ordem: p.ordem,
      enunciado: p.enunciado,
      tipo: p.tipo,
      opcoes: p.opcoes,
      pontos: p.pontos,
      obrigatoria: p.obrigatoria,
      midia_url: p.midiaUrl,
      midia_tipo: p.midiaTipo,
    })
  )

  let respostas: RespostaDada[] = []
  if (atividade.tipo === 'quiz' && entrega) {
    const { data } = await admin
      .from('ensino_atividade_respostas')
      .select('pergunta_id, opcoes, texto, correta, pontos')
      .eq('entrega_id', entrega.id)

    respostas = ((data ?? []) as {
      pergunta_id: string; opcoes: string[]; texto: string | null
      correta: boolean | null; pontos: number | null
    }[]).map((r) => ({
      perguntaId: r.pergunta_id,
      opcoes: r.opcoes ?? [],
      texto: r.texto,
      correta: r.correta,
      pontos: r.pontos === null ? null : Number(r.pontos),
    }))
  }

  const embedAbertura = resolverVideo(atividade.videoUrl)

  return (
    <div className="relative mx-auto max-w-3xl space-y-5 pb-6">
      {/* O fundo escolhido pelo professor, atrás de tudo e sem capturar toque. */}
      {atividade.fundoUrl && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage: `url(${atividade.fundoUrl})`,
            opacity: atividade.fundoOpacidade,
          }}
        />
      )}

      <Link
        href={leciona ? `/ensino/turma/${atividade.turmaId}/atividades` : '/ensino/atividades'}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {leciona ? atividade.turmaNome : 'Minhas atividades'}
      </Link>

      {leciona && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-card/80 p-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            {atividade.publicada ? 'Como o aluno vê' : 'Rascunho — a turma ainda não vê'}
          </span>
          <div className="ml-auto flex gap-2">
            <Link
              href={`/ensino/atividade/${atividade.id}/painel`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Acompanhar
            </Link>
            <Link
              href={`/ensino/atividade/${atividade.id}/editar`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          </div>
        </div>
      )}

      {atividade.capaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={atividade.capaUrl}
          alt=""
          className="max-h-64 w-full rounded-2xl object-cover"
        />
      )}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
          {meta.label} · {atividade.cursoNome}
        </p>
        <h1 className="mt-0.5 text-xl font-bold leading-tight">{atividade.titulo}</h1>
        {prazo && (
          <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              prazo.vencido
                ? 'bg-red-100 text-red-700'
                : prazo.urgente
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            <CalendarClock className="h-3 w-3" />
            {prazo.texto}
          </span>
        )}
      </div>

      {embedAbertura && (
        <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-sm">
          {embedAbertura.tipo === 'iframe' ? (
            <iframe
              src={embedAbertura.src}
              title={`Vídeo de ${atividade.titulo}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full"
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={embedAbertura.src} controls playsInline className="h-full w-full" />
          )}
        </div>
      )}

      {atividade.descricao && (
        <LinkPreviewLayer className="texto-rico" html={textoRicoParaHtml(atividade.descricao)} />
      )}

      {/* Os blocos que o professor montou, na ordem em que os arrastou. */}
      {atividade.secoes
        .filter((s) => s.tipo !== 'perguntas')
        .map((secao) => {
          const embed = resolverVideo(secao.videoUrl)
          return (
            <section key={secao.id} className="space-y-2">
              {secao.titulo && (
                <h2 className="text-sm font-semibold">{secao.titulo}</h2>
              )}
              {secao.conteudo && (
                <LinkPreviewLayer className="texto-rico" html={textoRicoParaHtml(secao.conteudo)} />
              )}
              {secao.midiaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={secao.midiaUrl} alt="" className="w-full rounded-2xl object-contain" />
              )}
              {embed && (
                <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                  {embed.tipo === 'iframe' ? (
                    <iframe
                      src={embed.src}
                      title={secao.titulo ?? 'Vídeo'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      className="h-full w-full"
                    />
                  ) : (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={embed.src} controls playsInline className="h-full w-full" />
                  )}
                </div>
              )}
            </section>
          )
        })}

      {/* O miolo. Só o aluno interage; o professor está de prévia. */}
      {inscricao ? (
        <>
          {atividade.tipo === 'tarefa' && (
            <AtividadeTarefa
              atividadeId={atividade.id}
              concluida={entrega?.concluida ?? false}
              comentario={entrega?.comentario ?? null}
              observacao={entrega?.observacao ?? null}
            />
          )}
          {atividade.tipo === 'leitura' &&
            (itensLeitura.length > 0 ? (
              <AtividadeLeitura
                atividadeId={atividade.id}
                itens={itensLeitura}
                repeticoes={atividade.leitura?.repeticoes ?? 1}
              />
            ) : (
              <Vazio icone={<BookOpen className="h-8 w-8" />}>
                O cronograma ainda não foi gerado. Fale com o professor.
              </Vazio>
            ))}
          {atividade.tipo === 'quiz' &&
            (paraResponder.length > 0 ? (
              <AtividadeQuiz
                atividadeId={atividade.id}
                perguntas={paraResponder}
                respostas={respostas}
                entregue={entrega ? entrega.status !== 'pendente' : false}
                nota={entrega?.nota === null || entrega?.nota === undefined ? null : Number(entrega.nota)}
                observacao={entrega?.observacao ?? null}
              />
            ) : (
              <Vazio icone={<FileQuestion className="h-8 w-8" />}>
                Esta prova ainda não tem perguntas.
              </Vazio>
            ))}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-4 text-center">
          <ClipboardList className="mx-auto mb-2 h-7 w-7 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {atividade.tipo === 'quiz'
              ? `${perguntas.length} ${perguntas.length === 1 ? 'pergunta' : 'perguntas'} nesta prova.`
              : meta.descricao}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Você está vendo como professor — quem responde é o aluno.
          </p>
        </div>
      )}

      {leciona && !atividade.publicada && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Esta atividade é um rascunho. Publique em &ldquo;Editar&rdquo; para a turma vê-la.
        </p>
      )}
    </div>
  )
}

function Vazio({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-10 text-center">
      <div className="mx-auto mb-2 flex justify-center text-muted-foreground/30">{icone}</div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
