import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { porSlugOuId } from '@/lib/slug-ou-id'
import { atividadesDaTurma } from '@/lib/ensino/atividades-consultas'
import { somarNota } from '@/lib/ensino/atividades'
import { AtividadesGestao } from '@/components/ensino/atividades-gestao'
import type { StatusEntrega } from '@/lib/supabase/types'

export const metadata = { title: 'Atividades da turma · Ensino IBZS' }

/**
 * As atividades de uma turma, para quem leciona.
 *
 * A contagem de entregues e a fila de correção são calculadas aqui, e não no
 * componente: são duas consultas para a turma inteira, e fazê-las por linha
 * daria uma ida ao banco por atividade.
 */
export default async function AtividadesTurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/atividades`))

  const admin = createAdminClient()

  const { data: turmaRaw } = await porSlugOuId(
    admin.from('ensino_turmas').select('id, nome, ensino_cursos(nome)'),
    params.id
  ).maybeSingle()

  if (!turmaRaw) notFound()

  const turma = turmaRaw as unknown as {
    id: string; nome: string; ensino_cursos: { nome: string } | null
  }

  if (!(await podeLecionar(acesso, turma.id))) redirect(`/ensino/turma/${params.id}`)

  const atividades = await atividadesDaTurma(turma.id)

  const { count: totalAlunos } = await admin
    .from('ensino_inscricoes')
    .select('id', { count: 'exact', head: true })
    .eq('turma_id', turma.id)
    .in('status', ['aprovada', 'concluida'])

  const ids = atividades.map((a) => a.id)

  const [entregasRes, respostasRes] = await Promise.all([
    ids.length > 0
      ? admin
          .from('ensino_atividade_entregas')
          .select('id, atividade_id, concluida, status')
          .in('atividade_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length > 0
      ? admin
          .from('ensino_atividade_respostas')
          .select('entrega_id, correta, pontos, ensino_atividade_entregas!inner(atividade_id)')
          .in('ensino_atividade_entregas.atividade_id', ids)
      : Promise.resolve({ data: [] }),
  ])

  const entregas = (entregasRes.data ?? []) as {
    id: string; atividade_id: string; concluida: boolean; status: StatusEntrega
  }[]

  const entreguesPorAtividade = new Map<string, number>()
  for (const e of entregas) {
    if (!e.concluida) continue
    entreguesPorAtividade.set(e.atividade_id, (entreguesPorAtividade.get(e.atividade_id) ?? 0) + 1)
  }

  // Uma entrega entra na fila de correção quando tem ao menos uma dissertativa
  // sem nota — é o `pontos is null` que `somarNota` conta como pendente.
  const respostasPorEntrega = new Map<string, { correta: boolean | null; pontos: number | null }[]>()
  for (const r of (respostasRes.data ?? []) as {
    entrega_id: string; correta: boolean | null; pontos: number | null
  }[]) {
    const lista = respostasPorEntrega.get(r.entrega_id) ?? []
    lista.push({ correta: r.correta, pontos: r.pontos })
    respostasPorEntrega.set(r.entrega_id, lista)
  }

  const corrigirPorAtividade = new Map<string, number>()
  for (const e of entregas) {
    const respostas = respostasPorEntrega.get(e.id)
    if (!respostas) continue
    if (somarNota(respostas).pendentes > 0) {
      corrigirPorAtividade.set(e.atividade_id, (corrigirPorAtividade.get(e.atividade_id) ?? 0) + 1)
    }
  }

  const linhas = atividades.map((a) => ({
    ...a,
    entregues: entreguesPorAtividade.get(a.id) ?? 0,
    total: totalAlunos ?? 0,
    aguardandoCorrecao: corrigirPorAtividade.get(a.id) ?? 0,
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <Link
        href={`/ensino/turma/${params.id}`}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {turma.nome}
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Atividades</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {turma.ensino_cursos?.nome} · {turma.nome}
          </p>
        </div>
      </div>

      <AtividadesGestao turmaId={turma.id} atividades={linhas} />
    </div>
  )
}
