import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { contarAprovados } from '@/app/actions/ensino/turmas'
import { inscricoesDisponiveis, encontrosTexto, periodoTexto } from '@/lib/ensino/turma'
import { FormularioInscricaoTurma } from '@/components/ensino/formulario-inscricao-turma'
import type { CampoFormulario, StatusTurma } from '@/lib/supabase/types'

export const metadata = { title: 'Inscrição · Ensino IBZS' }

export default async function InscricaoTurmaPage({
  params,
}: {
  params: { turmaId: string }
}) {
  const acesso = await acessoEnsino()
  // O destino viaja no `?next=`, então quem chega pelo link de um convite volta
  // para cá depois do login com Google em vez de cair na home.
  if (!acesso) redirect(loginCom(`/ensino/inscricao/${params.turmaId}`))

  const supabase = await createClient()

  const { data: turmaRaw } = await supabase
    .from('ensino_turmas')
    .select(
      'id, nome, vagas, status, inscricoes_abertas, aprovacao_automatica, data_inicio, data_fim, dias_semana, horario_inicio, horario_fim, local, formulario_id, ensino_cursos(nome)'
    )
    .eq('id', params.turmaId)
    .maybeSingle()

  if (!turmaRaw) notFound()

  const turma = turmaRaw as unknown as {
    id: string; nome: string; vagas: number | null; status: StatusTurma
    inscricoes_abertas: boolean; aprovacao_automatica: boolean
    data_inicio: string | null; data_fim: string | null
    dias_semana: number[]; horario_inicio: string | null; horario_fim: string | null
    local: string | null; formulario_id: string | null
    ensino_cursos: { nome: string } | null
  }

  const [aprovadosMapa, inscricaoRes, formularioRes] = await Promise.all([
    contarAprovados([turma.id]),
    supabase
      .from('ensino_inscricoes')
      .select('id, status')
      .eq('turma_id', turma.id)
      .eq('user_id', acesso.userId)
      .maybeSingle(),
    turma.formulario_id
      ? supabase.from('formularios').select('campos').eq('id', turma.formulario_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const aprovados = aprovadosMapa[turma.id] ?? 0
  const jaInscrito =
    inscricaoRes.data &&
    ['pendente', 'aprovada', 'concluida'].includes(inscricaoRes.data.status)

  // Quem já tem inscrição ativa não precisa deste formulário: a página da turma
  // já mostra o status e o botão de cancelar.
  if (jaInscrito) redirect(`/ensino/turma/${turma.id}`)

  if (!inscricoesDisponiveis(turma, aprovados)) redirect(`/ensino/turma/${turma.id}`)

  const campos = ((formularioRes.data as { campos?: CampoFormulario[] } | null)?.campos ??
    []) as CampoFormulario[]

  const encontros = encontrosTexto(turma.dias_semana, turma.horario_inicio, turma.horario_fim)
  const periodo = periodoTexto(turma.data_inicio, turma.data_fim)

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-6">
      <Link
        href={`/ensino/turma/${turma.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para a turma
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Inscrição</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {turma.ensino_cursos?.nome} · {turma.nome}
          </p>
          {(encontros || periodo || turma.local) && (
            <p className="text-xs text-muted-foreground mt-1">
              {[encontros, periodo, turma.local].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <FormularioInscricaoTurma
        turmaId={turma.id}
        turmaNome={turma.nome}
        cursoNome={turma.ensino_cursos?.nome ?? 'Curso'}
        perfil={{ nome: acesso.nome, telefone: acesso.telefone, email: acesso.email }}
        campos={campos}
        aprovacaoAutomatica={turma.aprovacao_automatica}
      />
    </div>
  )
}
