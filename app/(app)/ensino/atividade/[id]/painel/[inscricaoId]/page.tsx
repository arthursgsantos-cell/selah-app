import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Check, Clock, BookOpen, AlertTriangle, MessageSquare } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { atividadeCompleta, perguntasDaAtividade } from '@/lib/ensino/atividades-consultas'
import { hojeIso, STATUS_ENTREGA, TIPO_ATIVIDADE } from '@/lib/ensino/atividades'
import { progressoLeitura } from '@/lib/ensino/leitura'
import {
  AtividadeCorrecao, type RespostaParaCorrigir,
} from '@/components/ensino/atividade-correcao'
import type { StatusEntrega } from '@/lib/supabase/types'

export const metadata = { title: 'Entrega do aluno · Ensino IBZS' }

/** "13/08" a partir de `yyyy-mm-dd`, sem passar por Date. */
function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

/**
 * A entrega de um aluno específico.
 *
 * Do painel geral se chega aqui para o detalhe: o que ele respondeu, o
 * comentário que deixou, e — no desafio de leitura — quais dias ficaram para
 * trás. É também onde a correção acontece.
 */
export default async function EntregaAlunoPage({
  params,
}: {
  params: { id: string; inscricaoId: string }
}) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/atividade/${params.id}/painel/${params.inscricaoId}`))

  const atividade = await atividadeCompleta(params.id)
  if (!atividade) notFound()

  if (!(await podeLecionar(acesso, atividade.turmaId))) {
    redirect(`/ensino/atividade/${params.id}`)
  }

  const admin = createAdminClient()

  const { data: inscricao } = await admin
    .from('ensino_inscricoes')
    .select('id, nome, turma_id')
    .eq('id', params.inscricaoId)
    .maybeSingle()

  // A inscrição tem de ser da turma desta atividade — senão o painel de uma
  // turma abriria a entrega de outra.
  if (!inscricao || inscricao.turma_id !== atividade.turmaId) notFound()

  const { data: entregaData } = await admin
    .from('ensino_atividade_entregas')
    .select('id, status, concluida, comentario, nota, observacao, entregue_em')
    .eq('atividade_id', atividade.id)
    .eq('inscricao_id', inscricao.id)
    .maybeSingle()

  const entrega = entregaData as {
    id: string; status: StatusEntrega; concluida: boolean; comentario: string | null
    nota: number | null; observacao: string | null; entregue_em: string | null
  } | null

  const perguntas = atividade.tipo === 'quiz' ? await perguntasDaAtividade(atividade.id) : []

  let respostas: RespostaParaCorrigir[] = []
  if (entrega && atividade.tipo === 'quiz') {
    const { data } = await admin
      .from('ensino_atividade_respostas')
      .select('id, pergunta_id, opcoes, texto, correta, pontos')
      .eq('entrega_id', entrega.id)

    respostas = ((data ?? []) as {
      id: string; pergunta_id: string; opcoes: string[]; texto: string | null
      correta: boolean | null; pontos: number | null
    }[]).map((r) => ({
      id: r.id,
      perguntaId: r.pergunta_id,
      opcoes: r.opcoes ?? [],
      texto: r.texto,
      correta: r.correta,
      pontos: r.pontos === null ? null : Number(r.pontos),
    }))
  }

  // O cronograma deste aluno, para o desafio de leitura.
  const { data: itensData } = atividade.tipo === 'leitura'
    ? await admin
        .from('ensino_leitura_itens')
        .select('id, rotulo, rodada, data_prevista, feito, feito_em')
        .eq('atividade_id', atividade.id)
        .eq('inscricao_id', inscricao.id)
        .order('ordem')
    : { data: null }

  const itens = ((itensData ?? []) as {
    id: string; rotulo: string; rodada: number; data_prevista: string | null
    feito: boolean; feito_em: string | null
  }[])

  const hoje = hojeIso()
  const progresso = progressoLeitura(
    itens.map((i) => ({ feito: i.feito, dataPrevista: i.data_prevista })),
    hoje
  )
  const atrasadas = itens.filter(
    (i) => !i.feito && i.data_prevista !== null && i.data_prevista < hoje
  )

  const status = STATUS_ENTREGA[entrega?.status ?? 'pendente']

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <Link
        href={`/ensino/atividade/${atividade.id}/painel`}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Acompanhamento
      </Link>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
          {TIPO_ATIVIDADE[atividade.tipo].label} · {atividade.titulo}
        </p>
        <h1 className="mt-0.5 text-xl font-bold leading-tight">{inscricao.nome}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.classe}`}>
            {status.label}
          </span>
          {entrega?.nota !== null && entrega?.nota !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
              {Number(entrega.nota)} pontos
            </span>
          )}
          {entrega?.entregue_em && (
            <span className="text-[11px] text-muted-foreground">
              entregue em {dataCurta(entrega.entregue_em.slice(0, 10))}
            </span>
          )}
        </div>
      </div>

      {/* O comentário do aluno vem antes de tudo: é o que ele quis dizer. */}
      {entrega?.comentario && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            Comentário do aluno
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{entrega.comentario}</p>
        </div>
      )}

      {/* Desafio de leitura: o progresso e o que ficou para trás. */}
      {atividade.tipo === 'leitura' && itens.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Cronograma</h2>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {progresso.feitos} de {progresso.total} · {progresso.percentual}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${progresso.atrasados > 0 ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${progresso.percentual}%` }}
            />
          </div>

          {atrasadas.length > 0 ? (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                {atrasadas.length} {atrasadas.length === 1 ? 'leitura atrasada' : 'leituras atrasadas'}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {atrasadas.slice(0, 12).map((i) => (
                  <li
                    key={i.id}
                    className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
                  >
                    {i.rotulo}
                    {i.data_prevista && ` · ${dataCurta(i.data_prevista)}`}
                  </li>
                ))}
                {atrasadas.length > 12 && (
                  <li className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    e mais {atrasadas.length - 12}
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
              <Check className="h-3.5 w-3.5" />
              Em dia com o cronograma.
            </p>
          )}
        </section>
      )}

      {/* Tarefa: só o feito/não feito e a devolutiva. */}
      {atividade.tipo === 'tarefa' && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              entrega?.concluida ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
            }`}
          >
            {entrega?.concluida ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </span>
          <p className="text-sm font-medium">
            {entrega?.concluida ? 'Marcou como feito' : 'Ainda não marcou como feito'}
          </p>
        </div>
      )}

      <AtividadeCorrecao
        atividadeId={atividade.id}
        entregaId={entrega?.id ?? null}
        perguntas={perguntas}
        respostas={respostas}
        observacao={entrega?.observacao ?? null}
        soDevolutiva={atividade.tipo !== 'quiz'}
      />
    </div>
  )
}
