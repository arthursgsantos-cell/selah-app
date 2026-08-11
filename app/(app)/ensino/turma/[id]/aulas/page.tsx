import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { AulasGestao, type AulaGestao } from '@/components/ensino/aulas-gestao'
import { porSlugOuId } from '@/lib/slug-ou-id'
import type { ModoTurma, ModoVideoChamada, StatusAula } from '@/lib/supabase/types'

export const metadata = { title: 'Aulas da turma · Ensino IBZS' }

export default async function AulasTurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/aulas`))

  const admin = createAdminClient()

  const { data: turmaRaw } = await porSlugOuId(
    admin
      .from('ensino_turmas')
      .select('id, nome, modo, total_aulas, data_inicio, dias_semana, video_chamada_modo, ensino_cursos(nome)'),
    params.id
  ).maybeSingle()

  if (!turmaRaw) notFound()
  if (!(await podeLecionar(acesso, (turmaRaw as { id: string }).id))) {
    redirect(`/ensino/turma/${params.id}`)
  }

  const turma = turmaRaw as unknown as {
    id: string; nome: string; modo: ModoTurma; total_aulas: number | null
    data_inicio: string | null; dias_semana: number[]
    video_chamada_modo: ModoVideoChamada
    ensino_cursos: { nome: string } | null
  }

  const gravado = turma.modo === 'gravado'

  const [aulasRes, alunosRes] = await Promise.all([
    admin
      .from('ensino_aulas')
      .select('id, numero, titulo, data, hora_inicio, local, status, video_chamada_url')
      .eq('turma_id', turma.id)
      .order('numero'),
    admin
      .from('ensino_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', turma.id)
      .in('status', ['aprovada', 'concluida']),
  ])

  const aulasBase = (aulasRes.data ?? []) as {
    id: string; numero: number; titulo: string | null; data: string
    hora_inicio: string | null; local: string | null; status: StatusAula
    video_chamada_url: string | null
  }[]

  // Quantos já foram marcados em cada aula, para a lista mostrar de relance
  // onde a chamada ainda não foi feita.
  const { data: presencas } = await admin
    .from('ensino_presencas')
    .select('aula_id, presente')
    .in('aula_id', aulasBase.map((a) => a.id).length > 0 ? aulasBase.map((a) => a.id) : ['-'])

  const resumo = new Map<string, { marcados: number; presentes: number }>()
  for (const p of presencas ?? []) {
    const atual = resumo.get(p.aula_id) ?? { marcados: 0, presentes: 0 }
    atual.marcados += 1
    if (p.presente) atual.presentes += 1
    resumo.set(p.aula_id, atual)
  }

  const aulas: AulaGestao[] = aulasBase.map((a) => ({
    id: a.id,
    numero: a.numero,
    titulo: a.titulo,
    data: a.data,
    horaInicio: a.hora_inicio,
    local: a.local,
    status: a.status,
    videoChamadaUrl: a.video_chamada_url,
    marcados: resumo.get(a.id)?.marcados ?? 0,
    presentes: resumo.get(a.id)?.presentes ?? 0,
  }))

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
        <h1 className="text-xl font-bold leading-tight">
          {gravado ? 'Aulas do curso' : 'Aulas e chamada'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {turma.ensino_cursos?.nome} · {turma.nome}
        </p>
      </div>

      <AulasGestao
        turmaId={turma.id}
        aulas={aulas}
        totalAlunos={alunosRes.count ?? 0}
        gravado={gravado}
        totalAulas={turma.total_aulas}
        linkPorAula={turma.video_chamada_modo === 'aula'}
        podeGerar={
          gravado
            ? (turma.total_aulas ?? 0) > 0
            : Boolean(turma.data_inicio) && (turma.dias_semana?.length ?? 0) > 0
        }
      />
    </div>
  )
}
