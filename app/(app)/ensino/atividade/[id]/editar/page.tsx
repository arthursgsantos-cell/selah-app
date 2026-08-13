import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import {
  atividadeCompleta, livrosDaBiblia, perguntasDaAtividade,
} from '@/lib/ensino/atividades-consultas'
import { AtividadeEditor } from '@/components/ensino/atividade-editor'

export const metadata = { title: 'Montar atividade · Ensino IBZS' }

/**
 * A montagem da atividade — só para quem leciona a turma.
 *
 * Os livros da Bíblia descem sempre, e não só no desafio de leitura: o
 * professor pode trocar o tipo depois, e uma segunda ida ao banco por causa
 * disso custaria mais que as 66 linhas.
 */
export default async function EditarAtividadePage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/atividade/${params.id}/editar`))

  const atividade = await atividadeCompleta(params.id)
  if (!atividade) notFound()

  if (!(await podeLecionar(acesso, atividade.turmaId))) {
    redirect(`/ensino/atividade/${params.id}`)
  }

  const [perguntas, livros] = await Promise.all([
    perguntasDaAtividade(atividade.id),
    livrosDaBiblia(),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <Link
        href={`/ensino/turma/${atividade.turmaId}/atividades`}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Atividades da turma
      </Link>

      <div>
        <h1 className="text-xl font-bold leading-tight">Montar atividade</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {atividade.cursoNome} · {atividade.turmaNome}
        </p>
      </div>

      <AtividadeEditor atividade={atividade} perguntas={perguntas} livros={livros} />
    </div>
  )
}
