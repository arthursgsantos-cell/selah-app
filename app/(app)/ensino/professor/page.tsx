import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft, UserCog, ClipboardList, Users, ChevronRight, AlertCircle, GraduationCap, Plus,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, turmasQueLeciono } from '@/lib/ensino/permissoes'
import { contarAprovados, contarPendentes } from '@/app/actions/ensino/turmas'
import { PAINEL } from '@/lib/estilos'
import { dataBr, encontrosTexto, STATUS_TURMA, corFrequencia } from '@/lib/ensino/turma'
import { nomeDoDia } from '@/lib/dia-semana'
import type { StatusAula, StatusTurma } from '@/lib/supabase/types'

export const metadata = { title: 'Painel do professor · Ensino IBZS' }

/**
 * Painel do professor.
 *
 * A ordem das seções segue a urgência real: a chamada de hoje vem antes de
 * tudo, porque é o que o professor abre no celular minutos antes da aula.
 */
export default async function PainelProfessorPage() {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom('/ensino/professor'))
  if (!acesso.professor) redirect('/ensino')

  const admin = createAdminClient()

  const meusIds = await turmasQueLeciono(acesso)

  let turmasQuery = admin
    .from('ensino_turmas')
    .select('id, slug, nome, capa_url, local, status, dias_semana, horario_inicio, horario_fim, vagas, ensino_cursos(nome)')
    .eq('igreja_id', acesso.igrejaId)
    .order('criado_em', { ascending: false })

  // `null` significa coordenador: vê todas as turmas da igreja.
  if (meusIds !== null) {
    if (meusIds.length === 0) turmasQuery = turmasQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    else turmasQuery = turmasQuery.in('id', meusIds)
  }

  const { data: turmasRaw } = await turmasQuery

  const turmas = (turmasRaw ?? []) as unknown as {
    id: string; slug: string | null; nome: string; capa_url: string | null; local: string | null
    status: StatusTurma; dias_semana: number[]
    horario_inicio: string | null; horario_fim: string | null; vagas: number | null
    ensino_cursos: { nome: string } | null
  }[]

  const ids = turmas.map((t) => t.id)

  const [aprovados, pendentes, aulasRes] = await Promise.all([
    contarAprovados(ids),
    contarPendentes(ids),
    ids.length > 0
      ? admin
          .from('ensino_aulas')
          .select('id, turma_id, numero, titulo, data, hora_inicio, local, status')
          .in('turma_id', ids)
          .order('data')
      : Promise.resolve({ data: [] }),
  ])

  const aulas = (aulasRes.data ?? []) as {
    id: string; turma_id: string; numero: number; titulo: string | null
    data: string; hora_inicio: string | null; local: string | null; status: StatusAula
  }[]

  const { data: presencas } = await admin
    .from('ensino_presencas')
    .select('aula_id, presente')
    .in('aula_id', aulas.length > 0 ? aulas.map((a) => a.id) : ['-'])

  const marcados = new Map<string, { total: number; presentes: number }>()
  for (const p of presencas ?? []) {
    const atual = marcados.get(p.aula_id) ?? { total: 0, presentes: 0 }
    atual.total += 1
    if (p.presente) atual.presentes += 1
    marcados.set(p.aula_id, atual)
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const nomeTurma = (id: string) => turmas.find((t) => t.id === id)?.nome ?? 'Turma'

  const aulasDeHoje = aulas.filter((a) => a.data === hoje && a.status !== 'cancelada')
  const proximas = aulas
    .filter((a) => a.data > hoje && a.status !== 'cancelada')
    .slice(0, 5)
  // Aula que já passou e ainda não teve chamada — o esquecimento mais comum.
  const semChamada = aulas
    .filter((a) => a.data < hoje && a.status !== 'cancelada' && !marcados.has(a.id))
    .slice(-5)
    .reverse()

  const totalPendentes = Object.values(pendentes).reduce((a, b) => a + b, 0)
  const totalAlunos = Object.values(aprovados).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-6">
      <Link
        href="/ensino"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Ensino
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserCog className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">Painel do professor</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {turmas.length} {turmas.length === 1 ? 'turma' : 'turmas'} · {totalAlunos}{' '}
              {totalAlunos === 1 ? 'aluno' : 'alunos'}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" render={<Link href="/ensino/turma/nova" />}>
          <Plus className="h-4 w-4" />
          Nova turma
        </Button>
      </div>

      {/* Chamada de hoje */}
      {aulasDeHoje.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
            Aula de hoje
          </p>
          <div className="space-y-2">
            {aulasDeHoje.map((a) => {
              const feita = marcados.get(a.id)
              return (
                <Link
                  key={a.id}
                  href={`/ensino/chamada/${a.id}`}
                  className="flex items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
                >
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <span className="text-[8px] font-bold uppercase leading-none">Aula</span>
                    <span className="text-base font-bold leading-none mt-0.5">{a.numero}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight truncate">
                      {a.titulo ?? `Aula ${a.numero}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {nomeTurma(a.turma_id)}
                      {a.hora_inicio && ` · ${a.hora_inicio.slice(0, 5)}`}
                      {a.local && ` · ${a.local}`}
                    </p>
                    <p className="text-xs font-medium mt-0.5">
                      {feita ? (
                        <span className="text-green-600">
                          chamada feita · {feita.presentes}/{feita.total} presentes
                        </span>
                      ) : (
                        <span className="text-primary">fazer chamada</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Inscrições pendentes */}
      {totalPendentes > 0 && (
        <section>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-3">
            Inscrições aguardando
          </p>
          <div className="space-y-2">
            {turmas
              .filter((t) => (pendentes[t.id] ?? 0) > 0)
              .map((t) => (
                <Link
                  key={t.id}
                  href={`/ensino/turma/${t.slug ?? t.id}/alunos`}
                  className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 transition-colors hover:bg-amber-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight truncate">{t.nome}</p>
                    <p className="text-xs text-amber-700 font-medium">
                      {pendentes[t.id]} {pendentes[t.id] === 1 ? 'pedido' : 'pedidos'} para avaliar
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* Chamadas esquecidas */}
      {semChamada.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Aulas sem chamada
          </p>
          <div className="rounded-2xl border border-border divide-y overflow-hidden">
            {semChamada.map((a) => (
              <Link
                key={a.id}
                href={`/ensino/chamada/${a.id}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors"
              >
                <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{a.numero}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{a.titulo ?? `Aula ${a.numero}`}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {nomeTurma(a.turma_id)} · {dataBr(a.data)}
                  </p>
                </div>
                <span className="text-xs text-primary font-medium shrink-0">Registrar</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Próximas aulas */}
      {proximas.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Próximas aulas
          </p>
          <div className="rounded-2xl border border-border divide-y overflow-hidden">
            {proximas.map((a) => {
              const [ano, mes, dia] = a.data.split('-').map(Number)
              return (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{a.numero}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{a.titulo ?? `Aula ${a.numero}`}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {nomeTurma(a.turma_id)} · {nomeDoDia(new Date(ano, mes - 1, dia).getDay())?.slice(0, 3)},{' '}
                      {dataBr(a.data)}
                      {a.hora_inicio && ` · ${a.hora_inicio.slice(0, 5)}`}
                    </p>
                  </div>
                  <Link
                    href={`/ensino/chamada/${a.id}`}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors shrink-0"
                  >
                    Chamada
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Minhas turmas */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          {acesso.coordenador ? 'Turmas da igreja' : 'Minhas turmas'}
        </p>

        {turmas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Você ainda não tem turmas</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Crie a primeira turma para começar a registrar presença.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {turmas.map((t) => {
              const aulasDaTurma = aulas.filter((a) => a.turma_id === t.id)
              const realizadas = aulasDaTurma.filter((a) => marcados.has(a.id))
              const somaTotal = realizadas.reduce((s, a) => s + (marcados.get(a.id)?.total ?? 0), 0)
              const somaPresentes = realizadas.reduce(
                (s, a) => s + (marcados.get(a.id)?.presentes ?? 0),
                0
              )
              const media = somaTotal > 0 ? Math.round((somaPresentes / somaTotal) * 100) : null

              return (
                <div key={t.id} className={`${PAINEL} space-y-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/ensino/turma/${t.slug ?? t.id}`} className="min-w-0 group">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest truncate">
                        {t.ensino_cursos?.nome}
                      </p>
                      <p className="font-semibold leading-tight mt-0.5 group-hover:text-primary transition-colors">
                        {t.nome}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {encontrosTexto(t.dias_semana, t.horario_inicio, t.horario_fim)}
                        {t.local && ` · ${t.local}`}
                      </p>
                    </Link>
                    <span
                      className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_TURMA[t.status].classe}`}
                    >
                      {STATUS_TURMA[t.status].label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{aprovados[t.id] ?? 0}</span> alunos
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{realizadas.length}</span>/
                      {aulasDaTurma.length} aulas
                    </span>
                    <span className={`font-semibold ${corFrequencia(media)}`}>
                      {media === null ? 'sem chamadas' : `${media}% de presença`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 border-t pt-3">
                    <AtalhoTurma href={`/ensino/turma/${t.slug ?? t.id}/aulas`} icone={<ClipboardList className="h-3.5 w-3.5" />} label="Aulas" />
                    <AtalhoTurma
                      href={`/ensino/turma/${t.slug ?? t.id}/alunos`}
                      icone={<Users className="h-3.5 w-3.5" />}
                      label="Alunos"
                      selo={pendentes[t.id] || undefined}
                    />
                    <AtalhoTurma href={`/ensino/turma/${t.slug ?? t.id}/materiais`} icone={null} label="Materiais" />
                    <AtalhoTurma href={`/ensino/turma/${t.slug ?? t.id}/presencas`} icone={null} label="Frequência" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function AtalhoTurma({
  href, icone, label, selo,
}: {
  href: string
  icone: React.ReactNode
  label: string
  selo?: number
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
    >
      {icone}
      {label}
      {selo ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
          {selo}
        </span>
      ) : null}
    </Link>
  )
}
