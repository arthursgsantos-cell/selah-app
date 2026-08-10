import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { vagasRestantes } from '@/lib/ensino/turma'
import { AlunosGestao, type AlunoInscrito } from '@/components/ensino/alunos-gestao'
import type { OrigemInscricaoEnsino, StatusInscricaoEnsino } from '@/lib/supabase/types'

export const metadata = { title: 'Alunos da turma · Ensino IBZS' }

export default async function AlunosTurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/alunos`))

  const admin = createAdminClient()

  const { data: turmaRaw } = await admin
    .from('ensino_turmas')
    .select('id, nome, vagas, ensino_cursos(nome)')
    .eq('id', params.id)
    .maybeSingle()

  if (!turmaRaw) notFound()
  if (!(await podeLecionar(acesso, params.id))) redirect(`/ensino/turma/${params.id}`)

  const turma = turmaRaw as unknown as {
    id: string; nome: string; vagas: number | null
    ensino_cursos: { nome: string } | null
  }

  const [inscricoesRes, aulasRes] = await Promise.all([
    admin
      .from('ensino_inscricoes')
      // A FK precisa ser nomeada: a tabela tem dois caminhos para `profiles`
      // (`user_id` e `decidido_por`), e o embed ambíguo faz o PostgREST recusar
      // a consulta inteira — a tela mostrava "nenhuma inscrição" com pedidos no
      // banco.
      // Dois embeds para a mesma tabela, cada um com a FK nomeada e um apelido:
      // `aluno` é quem se inscreveu, `decisor` é quem aprovou ou recusou.
      .select(
        'id, user_id, nome, telefone, email, status, origem, observacao, dados, criado_em, decidido_em, aluno:profiles!ensino_inscricoes_user_id_fkey(avatar_url), decisor:profiles!ensino_inscricoes_decidido_por_fkey(nome)'
      )
      .eq('turma_id', turma.id)
      .order('criado_em'),
    admin
      .from('ensino_aulas')
      .select('id')
      .eq('turma_id', turma.id)
      .eq('status', 'realizada'),
  ])

  const inscricoes = (inscricoesRes.data ?? []) as unknown as {
    id: string; user_id: string | null; nome: string
    telefone: string | null; email: string | null
    status: StatusInscricaoEnsino; origem: OrigemInscricaoEnsino
    observacao: string | null
    dados: Record<string, string>; criado_em: string; decidido_em: string | null
    aluno: { avatar_url: string | null } | null
    decisor: { nome: string } | null
  }[]

  const aulasRealizadas = (aulasRes.data ?? []).map((a) => a.id)

  const { data: presencas } = await admin
    .from('ensino_presencas')
    .select('inscricao_id, presente')
    .in('aula_id', aulasRealizadas.length > 0 ? aulasRealizadas : ['-'])

  const frequencia = new Map<string, { presentes: number; total: number }>()
  for (const p of presencas ?? []) {
    const atual = frequencia.get(p.inscricao_id) ?? { presentes: 0, total: 0 }
    atual.total += 1
    if (p.presente) atual.presentes += 1
    frequencia.set(p.inscricao_id, atual)
  }

  const alunos: AlunoInscrito[] = inscricoes.map((i) => {
    const f = frequencia.get(i.id)
    return {
      id: i.id,
      nome: i.nome,
      telefone: i.telefone,
      email: i.email,
      avatarUrl: i.aluno?.avatar_url ?? null,
      status: i.status,
      origem: i.origem ?? 'app',
      temConta: i.user_id !== null,
      observacao: i.observacao,
      criadoEm: i.criado_em,
      decididoPor: i.decisor?.nome ?? null,
      decididoEm: i.decidido_em,
      dados: i.dados ?? {},
      percentual: f && f.total > 0 ? Math.round((f.presentes / f.total) * 100) : null,
      presentes: f?.presentes ?? 0,
      totalAulas: f?.total ?? 0,
    }
  })

  const aprovados = alunos.filter((a) => a.status === 'aprovada' || a.status === 'concluida').length

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      <Link
        href={`/ensino/turma/${turma.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        {turma.nome}
      </Link>

      <div>
        <h1 className="text-xl font-bold leading-tight">Alunos e inscrições</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {turma.ensino_cursos?.nome} · {turma.nome}
        </p>
      </div>

      <AlunosGestao
        turmaId={turma.id}
        alunos={alunos}
        vagasRestantes={vagasRestantes(turma.vagas, aprovados)}
      />
    </div>
  )
}
