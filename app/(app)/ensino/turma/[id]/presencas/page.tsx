import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { porSlugOuId } from '@/lib/slug-ou-id'
import { PresencasTabela } from '@/components/ensino/presencas-tabela'
import type { StatusAula } from '@/lib/supabase/types'

export const metadata = { title: 'Frequência da turma · Ensino IBZS' }

/**
 * Histórico de presença da turma inteira.
 *
 * É a tela que substitui a aba de frequência da planilha: uma linha por aluno,
 * uma coluna por aula realizada, e o percentual calculado só sobre as aulas
 * que já aconteceram.
 */
export default async function PresencasTurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/presencas`))

  const admin = createAdminClient()

  const { data: turmaRaw } = await porSlugOuId(
    admin.from('ensino_turmas').select('id, nome, ensino_cursos(nome)'),
    params.id
  ).maybeSingle()

  if (!turmaRaw) notFound()
  if (!(await podeLecionar(acesso, (turmaRaw as { id: string }).id))) {
    redirect(`/ensino/turma/${params.id}`)
  }

  const turma = turmaRaw as unknown as {
    id: string; nome: string; ensino_cursos: { nome: string } | null
  }

  const [aulasRes, inscricoesRes] = await Promise.all([
    admin
      .from('ensino_aulas')
      .select('id, numero, data, status')
      .eq('turma_id', turma.id)
      .neq('status', 'cancelada')
      .order('numero'),
    admin
      .from('ensino_inscricoes')
      .select('id, nome')
      .eq('turma_id', turma.id)
      .in('status', ['aprovada', 'concluida'])
      .order('nome'),
  ])

  const aulas = (aulasRes.data ?? []) as {
    id: string; numero: number; data: string; status: StatusAula
  }[]
  const alunos = (inscricoesRes.data ?? []) as { id: string; nome: string }[]

  const { data: presencas } = await admin
    .from('ensino_presencas')
    .select('aula_id, inscricao_id, presente')
    .in('aula_id', aulas.length > 0 ? aulas.map((a) => a.id) : ['-'])

  // Chave "aula|inscrição" → presente. Um objeto plano evita um aninhado que a
  // tabela teria de navegar a cada célula, e atravessa para o cliente — um Map
  // não sobrevive à serialização do componente de servidor.
  const marcacoes: Record<string, boolean> = {}
  for (const p of presencas ?? []) {
    marcacoes[`${p.aula_id}|${p.inscricao_id}`] = p.presente
  }

  // Só as realizadas contam: incluir aulas futuras faria todo mundo aparecer
  // com frequência baixa desde o primeiro dia.
  const realizadas = aulas.filter((a) => a.status === 'realizada')

  const linhas = alunos.map((aluno) => {
    const marcadas = realizadas.filter((a) => `${a.id}|${aluno.id}` in marcacoes)
    const presentes = marcadas.filter((a) => marcacoes[`${a.id}|${aluno.id}`] === true).length
    const percentual = marcadas.length > 0 ? Math.round((presentes / marcadas.length) * 100) : null
    return { ...aluno, presentes, total: marcadas.length, percentual }
  })

  if (alunos.length === 0 || aulas.length === 0) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto pb-6">
        <Voltar turmaId={params.id} nome={turma.nome} />
        <Cabecalho turma={turma} />
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {alunos.length === 0
              ? 'Nenhum aluno aprovado nesta turma ainda.'
              : 'Nenhuma aula cadastrada ainda.'}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {alunos.length === 0 ? (
              <Link href={`/ensino/turma/${params.id}/alunos`} className="text-primary hover:underline">
                Ver inscrições
              </Link>
            ) : (
              <Link href={`/ensino/turma/${params.id}/aulas`} className="text-primary hover:underline">
                Cadastrar aulas
              </Link>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      <Voltar turmaId={params.id} nome={turma.nome} />
      <Cabecalho turma={turma} />

      <PresencasTabela
        aulas={aulas.map((a) => ({ id: a.id, numero: a.numero, data: a.data, status: a.status }))}
        linhas={linhas.map((l) => ({
          id: l.id,
          nome: l.nome,
          presentes: l.presentes,
          total: l.total,
          percentual: l.percentual,
        }))}
        marcacoes={marcacoes}
      />
    </div>
  )
}

function Voltar({ turmaId, nome }: { turmaId: string; nome: string }) {
  return (
    <Link
      href={`/ensino/turma/${turmaId}`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
    >
      <ArrowLeft className="h-4 w-4" />
      {nome}
    </Link>
  )
}

function Cabecalho({ turma }: { turma: { nome: string; ensino_cursos: { nome: string } | null } }) {
  return (
    <div>
      <h1 className="text-xl font-bold leading-tight">Frequência</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        {turma.ensino_cursos?.nome} · {turma.nome}
      </p>
    </div>
  )
}
