import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BarChart3, Pencil } from 'lucide-react'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { atividadeCompleta, painelDaAtividade } from '@/lib/ensino/atividades-consultas'
import { textoPrazo, TIPO_ATIVIDADE } from '@/lib/ensino/atividades'
import { AtividadePainel } from '@/components/ensino/atividade-painel'

export const metadata = { title: 'Acompanhamento · Ensino IBZS' }

/**
 * O painel geral da atividade.
 *
 * Responde "como vai a turma" numa tela, e leva ao individual num toque. É a
 * contrapartida do painel de frequência: ali se acompanha a presença, aqui o
 * que foi pedido para fazer em casa.
 */
export default async function PainelAtividadePage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/atividade/${params.id}/painel`))

  const atividade = await atividadeCompleta(params.id)
  if (!atividade) notFound()

  if (!(await podeLecionar(acesso, atividade.turmaId))) {
    redirect(`/ensino/atividade/${params.id}`)
  }

  const entregas = await painelDaAtividade(atividade.id, atividade.turmaId, atividade.tipo)
  const prazo = textoPrazo(atividade.prazo)

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <Link
        href={`/ensino/turma/${atividade.turmaId}/atividades`}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Atividades da turma
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight">{atividade.titulo}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {TIPO_ATIVIDADE[atividade.tipo].label} · {atividade.turmaNome}
            {prazo && ` · ${prazo.texto}`}
          </p>
        </div>
        <Link
          href={`/ensino/atividade/${atividade.id}/editar`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Link>
      </div>

      {!atividade.publicada && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Esta atividade ainda é um rascunho — a turma não a vê.
        </p>
      )}

      <AtividadePainel
        atividadeId={atividade.id}
        tipo={atividade.tipo}
        entregas={entregas}
      />
    </div>
  )
}
