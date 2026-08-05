import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Settings, Users, GraduationCap, ClipboardCheck, ChevronRight } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { listarEquipe } from '@/app/actions/ensino/equipe'
import { EquipeGestao } from '@/components/ensino/equipe-gestao'
import { CursosGestao, type CursoGestao } from '@/components/ensino/cursos-gestao'
import { PAINEL } from '@/lib/estilos'
import { STATUS_TURMA, corFrequencia } from '@/lib/ensino/turma'
import type { StatusTurma } from '@/lib/supabase/types'

export const metadata = { title: 'Administração do Ensino · IBZS' }

export default async function AdminEnsinoPage() {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom('/ensino/admin'))
  if (!acesso.coordenador) redirect('/ensino')

  const admin = createAdminClient()

  const [cursosRes, turmasRes, equipe] = await Promise.all([
    admin
      .from('ensino_cursos')
      .select('id, nome, descricao, ativo')
      .eq('igreja_id', acesso.igrejaId)
      .order('nome'),
    admin
      .from('ensino_turmas')
      .select('id, curso_id, nome, status, ensino_cursos(nome)')
      .eq('igreja_id', acesso.igrejaId)
      .order('criado_em', { ascending: false }),
    listarEquipe(),
  ])

  const turmas = (turmasRes.data ?? []) as unknown as {
    id: string; curso_id: string; nome: string; status: StatusTurma
    ensino_cursos: { nome: string } | null
  }[]

  const cursos: CursoGestao[] = ((cursosRes.data ?? []) as {
    id: string; nome: string; descricao: string | null; ativo: boolean
  }[]).map((c) => ({
    ...c,
    turmas: turmas.filter((t) => t.curso_id === c.id).length,
  }))

  const ids = turmas.map((t) => t.id)

  const [inscricoesRes, presencasRes] = await Promise.all([
    admin
      .from('ensino_inscricoes')
      .select('turma_id, status')
      .in('turma_id', ids.length > 0 ? ids : ['-']),
    admin
      .from('ensino_presencas')
      .select('presente, ensino_aulas!inner(turma_id)')
      .in('ensino_aulas.turma_id', ids.length > 0 ? ids : ['-']),
  ])

  const inscricoes = (inscricoesRes.data ?? []) as { turma_id: string; status: string }[]
  const presencas = (presencasRes.data ?? []) as unknown as {
    presente: boolean
    ensino_aulas: { turma_id: string } | null
  }[]

  const porTurma = new Map<
    string,
    { aprovados: number; pendentes: number; presentes: number; registros: number }
  >()
  for (const t of turmas) {
    porTurma.set(t.id, { aprovados: 0, pendentes: 0, presentes: 0, registros: 0 })
  }
  for (const i of inscricoes) {
    const r = porTurma.get(i.turma_id)
    if (!r) continue
    if (i.status === 'aprovada' || i.status === 'concluida') r.aprovados += 1
    if (i.status === 'pendente') r.pendentes += 1
  }
  for (const p of presencas) {
    const turmaId = p.ensino_aulas?.turma_id
    if (!turmaId) continue
    const r = porTurma.get(turmaId)
    if (!r) continue
    r.registros += 1
    if (p.presente) r.presentes += 1
  }

  const totalAlunos = inscricoes.filter(
    (i) => i.status === 'aprovada' || i.status === 'concluida'
  ).length
  const totalPendentes = inscricoes.filter((i) => i.status === 'pendente').length
  const totalRegistros = presencas.length
  const totalPresentes = presencas.filter((p) => p.presente).length
  const mediaGeral =
    totalRegistros > 0 ? Math.round((totalPresentes / totalRegistros) * 100) : null

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-6">
      <Link
        href="/ensino"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Ensino
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Administração do Ensino</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cursos, professores e acompanhamento geral
          </p>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Indicador icone={<GraduationCap className="h-4 w-4" />} valor={turmas.length} rotulo="turmas" />
        <Indicador icone={<Users className="h-4 w-4" />} valor={totalAlunos} rotulo="alunos" />
        <Indicador
          icone={<ClipboardCheck className="h-4 w-4" />}
          valor={mediaGeral === null ? '—' : `${mediaGeral}%`}
          rotulo="presença média"
          classe={corFrequencia(mediaGeral)}
        />
        <Indicador
          icone={<Users className="h-4 w-4" />}
          valor={totalPendentes}
          rotulo="pedidos pendentes"
          classe={totalPendentes > 0 ? 'text-amber-600' : undefined}
        />
      </div>

      {/* Cursos */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Cursos
        </p>
        <CursosGestao cursos={cursos} podeExcluir />
      </section>

      {/* Equipe */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Professores
        </p>
        <EquipeGestao equipe={equipe} meuId={acesso.userId} />
      </section>

      {/* Relatório por turma */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Turmas
        </p>
        {turmas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma turma criada ainda.</p>
          </div>
        ) : (
          <div className={`${PAINEL} p-0 overflow-hidden`}>
            <div className="divide-y">
              {turmas.map((t) => {
                const r = porTurma.get(t.id)!
                const media = r.registros > 0 ? Math.round((r.presentes / r.registros) * 100) : null
                return (
                  <Link
                    key={t.id}
                    href={`/ensino/turma/${t.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">{t.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.ensino_cursos?.nome} · {r.aprovados}{' '}
                        {r.aprovados === 1 ? 'aluno' : 'alunos'}
                        {r.pendentes > 0 && (
                          <span className="text-amber-600 font-medium"> · {r.pendentes} pendentes</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${corFrequencia(media)}`}>
                        {media === null ? '—' : `${media}%`}
                      </p>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_TURMA[t.status].classe}`}
                      >
                        {STATUS_TURMA[t.status].label}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Indicador({
  icone, valor, rotulo, classe,
}: {
  icone: React.ReactNode
  valor: number | string
  rotulo: string
  classe?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-muted-foreground">{icone}</div>
      <p className={`text-xl font-bold leading-none mt-1.5 ${classe ?? ''}`}>{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{rotulo}</p>
    </div>
  )
}
