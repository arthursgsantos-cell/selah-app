import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { porSlugOuId } from '@/lib/slug-ou-id'
import { situacaoAluno, type ParcelaTurma, type PagamentoEnsino } from '@/lib/ensino/cobranca'
import { FinanceiroTurma, type LinhaAluno } from '@/components/ensino/financeiro-turma'
import type { StatusInscricaoEnsino } from '@/lib/supabase/types'

export const metadata = { title: 'Pagamentos da turma · Ensino IBZS' }

/**
 * Painel de pagamentos de uma turma.
 *
 * É da coordenação, não do professor: quem dá aula não precisa saber quem está
 * devendo, e transformar o professor em cobrador estraga a relação com a
 * classe. A mesma regra está na RLS de `ensino_pagamentos`.
 */
export default async function FinanceiroTurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/financeiro`))
  if (!acesso.coordenador) redirect(`/ensino/turma/${params.id}`)

  const admin = createAdminClient()

  const { data: turmaRaw } = await porSlugOuId(
    admin
      .from('ensino_turmas')
      .select('id, nome, valor, pagamento_instrucoes, igreja_id, ensino_cursos(nome)'),
    params.id
  ).maybeSingle()

  if (!turmaRaw) notFound()

  const turma = turmaRaw as unknown as {
    id: string; nome: string; valor: number | null
    pagamento_instrucoes: string | null; igreja_id: string
    ensino_cursos: { nome: string } | null
  }

  if (turma.igreja_id !== acesso.igrejaId) notFound()

  const [inscricoesRes, parcelasRes] = await Promise.all([
    admin
      .from('ensino_inscricoes')
      .select('id, nome, telefone, status, valor_combinado')
      .eq('turma_id', turma.id)
      // Quem foi recusado ou cancelou não deve nada: a lista de cobrança é de
      // quem está estudando.
      .in('status', ['aprovada', 'concluida', 'pendente'])
      .order('nome'),
    admin
      .from('ensino_turma_parcelas')
      .select('id, numero, vencimento, percentual')
      .eq('turma_id', turma.id)
      .order('numero'),
  ])

  const inscricoes = (inscricoesRes.data ?? []) as {
    id: string; nome: string; telefone: string | null
    status: StatusInscricaoEnsino; valor_combinado: number | null
  }[]

  const parcelas = ((parcelasRes.data ?? []) as ParcelaTurma[]).map((p) => ({
    ...p,
    percentual: p.percentual != null ? Number(p.percentual) : null,
  }))

  const { data: pagamentosData } = await admin
    .from('ensino_pagamentos')
    .select('id, inscricao_id, valor, pago_em, metodo, observacao')
    .in('inscricao_id', inscricoes.length > 0 ? inscricoes.map((i) => i.id) : ['-'])
    .order('pago_em')

  const porInscricao = new Map<string, PagamentoEnsino[]>()
  for (const p of (pagamentosData ?? []) as (PagamentoEnsino & { inscricao_id: string })[]) {
    const lista = porInscricao.get(p.inscricao_id) ?? []
    lista.push({
      id: p.id,
      valor: Number(p.valor),
      pago_em: p.pago_em,
      metodo: p.metodo,
      observacao: p.observacao,
    })
    porInscricao.set(p.inscricao_id, lista)
  }

  const valorTurma = turma.valor != null ? Number(turma.valor) : null

  const linhas: LinhaAluno[] = inscricoes.map((i) => {
    const pagamentos = porInscricao.get(i.id) ?? []
    return {
      ...situacaoAluno({
        inscricaoId: i.id,
        nome: i.nome,
        valorTurma,
        valorCombinado: i.valor_combinado != null ? Number(i.valor_combinado) : null,
        parcelas,
        pagamentos,
      }),
      telefone: i.telefone,
      statusInscricao: i.status,
      pagamentos,
    }
  })

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      <Link
        href={`/ensino/turma/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        {turma.nome}
      </Link>

      <div>
        <h1 className="text-xl font-bold leading-tight">Pagamentos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {turma.ensino_cursos?.nome} · {turma.nome}
        </p>
      </div>

      <FinanceiroTurma
        turmaId={turma.id}
        valorTurma={valorTurma}
        instrucoes={turma.pagamento_instrucoes}
        parcelas={parcelas}
        alunos={linhas}
      />
    </div>
  )
}
