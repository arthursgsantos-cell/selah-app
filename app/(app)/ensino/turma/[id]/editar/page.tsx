import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { TurmaForm, type TurmaParaEditar } from '@/components/ensino/turma-form'
import { ExcluirTurmaBtn } from '@/components/ensino/excluir-turma-btn'
import type {
  ModoTurma, ModoVideoChamada, StatusTurma, TipoInscricaoTurma,
} from '@/lib/supabase/types'

export const metadata = { title: 'Editar turma · Ensino IBZS' }

export default async function EditarTurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/editar`))

  const admin = createAdminClient()
  const { data: turmaRaw } = await admin
    .from('ensino_turmas')
    .select(
      'id, curso_id, nome, descricao, capa_url, local, data_inicio, data_fim, dias_semana, horario_inicio, horario_fim, total_aulas, vagas, inscricoes_abertas, aprovacao_automatica, status, modo, sequencial, whatsapp_url, tipo_inscricao, link_inscricao_url, formulario_id, video_chamada_modo, video_chamada_url'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!turmaRaw) notFound()
  if (!(await podeLecionar(acesso, params.id))) redirect(`/ensino/turma/${params.id}`)

  const t = turmaRaw as unknown as {
    id: string; curso_id: string; nome: string; descricao: string | null
    capa_url: string | null; local: string | null
    data_inicio: string | null; data_fim: string | null
    dias_semana: number[]; horario_inicio: string | null; horario_fim: string | null
    total_aulas: number | null; vagas: number | null
    inscricoes_abertas: boolean; aprovacao_automatica: boolean
    status: StatusTurma; modo: ModoTurma; sequencial: boolean
    whatsapp_url: string | null
    tipo_inscricao: TipoInscricaoTurma
    link_inscricao_url: string | null
    formulario_id: string | null
    video_chamada_modo: ModoVideoChamada; video_chamada_url: string | null
  }

  const turma: TurmaParaEditar = {
    id: t.id,
    cursoId: t.curso_id,
    nome: t.nome,
    descricao: t.descricao,
    capaUrl: t.capa_url,
    local: t.local,
    dataInicio: t.data_inicio,
    dataFim: t.data_fim,
    diasSemana: t.dias_semana ?? [],
    horarioInicio: t.horario_inicio,
    horarioFim: t.horario_fim,
    totalAulas: t.total_aulas,
    vagas: t.vagas,
    inscricoesAbertas: t.inscricoes_abertas,
    aprovacaoAutomatica: t.aprovacao_automatica,
    status: t.status,
    modo: t.modo ?? 'presencial',
    sequencial: t.sequencial ?? false,
    whatsappUrl: t.whatsapp_url,
    tipoInscricao: t.tipo_inscricao ?? 'app',
    linkInscricaoUrl: t.link_inscricao_url,
    formularioId: t.formulario_id,
    videoChamadaModo: t.video_chamada_modo ?? 'nenhum',
    videoChamadaUrl: t.video_chamada_url,
  }

  const supabase = await createClient()
  const { data: cursos } = await supabase
    .from('ensino_cursos')
    .select('id, nome')
    .eq('igreja_id', acesso.igrejaId)
    .eq('ativo', true)
    .order('nome')

  // O que a exclusão levaria junto. Só a coordenação exclui, então só para ela
  // vale a contagem — e é ela que a confirmação mostra, em vez de um "tem
  // certeza?" que não informa nada.
  const [inscricoesRes, aulasRes, materiaisRes] = acesso.coordenador
    ? await Promise.all([
        admin.from('ensino_inscricoes').select('id', { count: 'exact', head: true }).eq('turma_id', turma.id),
        admin.from('ensino_aulas').select('id', { count: 'exact', head: true }).eq('turma_id', turma.id),
        admin.from('ensino_materiais').select('id', { count: 'exact', head: true }).eq('turma_id', turma.id),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }]

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
        <h1 className="text-xl font-bold leading-tight">Editar turma</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{turma.nome}</p>
      </div>

      <TurmaForm cursos={(cursos ?? []) as { id: string; nome: string }[]} turma={turma} />

      {acesso.coordenador && (
        <ExcluirTurmaBtn
          turmaId={turma.id}
          nome={turma.nome}
          alunos={inscricoesRes.count ?? 0}
          aulas={aulasRes.count ?? 0}
          materiais={materiaisRes.count ?? 0}
        />
      )}
    </div>
  )
}
