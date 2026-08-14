import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft, Settings, Users, GraduationCap, ClipboardCheck, ChevronRight, Banknote,
  BookOpen,
} from 'lucide-react'
import { PainelAbas } from '@/components/shared/painel-abas'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { listarEquipe } from '@/app/actions/ensino/equipe'
import { EquipeGestao } from '@/components/ensino/equipe-gestao'
import { CursosGestao, type CursoGestao } from '@/components/ensino/cursos-gestao'
import { PAINEL } from '@/lib/estilos'
import { STATUS_TURMA, corFrequencia } from '@/lib/ensino/turma'
import { formatarBRL, valorDevido } from '@/lib/ensino/cobranca'
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
      .select('id, slug, curso_id, nome, status, valor, ensino_cursos(nome)')
      .eq('igreja_id', acesso.igrejaId)
      .order('criado_em', { ascending: false }),
    listarEquipe(),
  ])

  const turmas = (turmasRes.data ?? []) as unknown as {
    id: string; slug: string | null; curso_id: string; nome: string; status: StatusTurma
    valor: number | null
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
      .select('id, turma_id, user_id, pre_cadastro_id, status, valor_combinado')
      .in('turma_id', ids.length > 0 ? ids : ['-']),
    admin
      .from('ensino_presencas')
      .select('presente, ensino_aulas!inner(turma_id)')
      .in('ensino_aulas.turma_id', ids.length > 0 ? ids : ['-']),
  ])

  const inscricoes = (inscricoesRes.data ?? []) as {
    id: string; turma_id: string; user_id: string | null
    pre_cadastro_id: string | null; status: string
    valor_combinado: number | null
  }[]
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
  // Pessoas, não inscrições: quem faz dois cursos conta uma vez no botão da
  // ficha, que é justamente a tela por pessoa. Quem não tem conta é
  // identificado pelo pré-cadastro — agrupar por `user_id` nulo fundiria a
  // turma manual inteira numa pessoa só.
  const totalPessoas = new Set(
    inscricoes.map((i) => i.user_id ?? (i.pre_cadastro_id ? `pre:${i.pre_cadastro_id}` : `insc:${i.id}`))
  ).size
  // ── Pagamentos ───────────────────────────────────────────────────────────
  // Só as turmas com valor entram: a maioria é gratuita, e uma lista cheia de
  // "R$ 0,00" esconderia justamente as duas que a secretaria precisa cobrar.
  const turmasPagas = turmas.filter((t) => t.valor != null && Number(t.valor) > 0)

  const inscricoesCobraveis = inscricoes.filter(
    (i) =>
      turmasPagas.some((t) => t.id === i.turma_id) &&
      ['aprovada', 'concluida', 'pendente'].includes(i.status)
  )

  const { data: pagamentosData } = inscricoesCobraveis.length > 0
    ? await admin
        .from('ensino_pagamentos')
        .select('inscricao_id, valor')
        .in('inscricao_id', inscricoesCobraveis.map((i) => i.id))
    : { data: [] }

  const pagoPorInscricao = new Map<string, number>()
  for (const p of (pagamentosData ?? []) as { inscricao_id: string; valor: number }[]) {
    pagoPorInscricao.set(p.inscricao_id, (pagoPorInscricao.get(p.inscricao_id) ?? 0) + Number(p.valor))
  }

  const financeiro = turmasPagas.map((t) => {
    const daTurma = inscricoesCobraveis.filter((i) => i.turma_id === t.id)
    const previsto = daTurma.reduce(
      (acc, i) => acc + valorDevido(Number(t.valor), i.valor_combinado != null ? Number(i.valor_combinado) : null),
      0
    )
    const recebido = daTurma.reduce((acc, i) => acc + (pagoPorInscricao.get(i.id) ?? 0), 0)
    return {
      id: t.id,
      chave: t.slug ?? t.id,
      nome: t.nome,
      curso: t.ensino_cursos?.nome ?? null,
      alunos: daTurma.length,
      previsto: Number(previsto.toFixed(2)),
      recebido: Number(recebido.toFixed(2)),
      falta: Number(Math.max(0, previsto - recebido).toFixed(2)),
    }
  })

  const totalRegistros = presencas.length
  const totalPresentes = presencas.filter((p) => p.presente).length
  const mediaGeral =
    totalRegistros > 0 ? Math.round((totalPresentes / totalRegistros) * 100) : null

  const conteudoTurmas =
    turmas.length === 0 ? (
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
                href={`/ensino/turma/${t.slug ?? t.id}`}
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
    )

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

      <PainelAbas
        abas={[
          {
            id: 'turmas',
            titulo: 'Turmas',
            descricao: 'Cada turma, com quantos alunos e como está a presença.',
            icone: <GraduationCap className="h-5 w-5" />,
            aviso: totalPendentes,
            conteudo: (
              <>
                {/* Ficha dos alunos — a visão por pessoa, que as telas de turma
                    não dão */}
                <Link
                  href="/ensino/alunos"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-colors hover:bg-accent"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">Ver alunos</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {totalPessoas === 0
                        ? 'Ninguém inscrito ainda'
                        : `${totalPessoas} ${totalPessoas === 1 ? 'pessoa' : 'pessoas'} · cursos, frequência e ficha completa`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
                {conteudoTurmas}
              </>
            ),
          },
          {
            id: 'cursos',
            titulo: 'Cursos',
            descricao: 'Os cursos que a igreja oferece.',
            icone: <BookOpen className="h-5 w-5" />,
            conteudo: <CursosGestao cursos={cursos} podeExcluir />,
          },
          {
            id: 'professores',
            titulo: 'Professores',
            descricao: 'Quem dá aula e quem coordena.',
            icone: <Users className="h-5 w-5" />,
            conteudo: <EquipeGestao equipe={equipe} meuId={acesso.userId} />,
          },
          {
            id: 'pagamentos',
            titulo: 'Pagamentos',
            descricao: 'Só as turmas que cobram — quanto entrou e quanto falta.',
            icone: <Banknote className="h-5 w-5" />,
            conteudo:
              financeiro.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma turma com valor definido.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O valor é definido dentro da turma, em &ldquo;Pagamentos&rdquo;.
                  </p>
                </div>
              ) : (
                <div className={`${PAINEL} p-0 overflow-hidden`}>
                  <div className="divide-y">
                    {financeiro.map((f) => (
                      <Link
                        key={f.id}
                        href={`/ensino/turma/${f.chave}/financeiro`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Banknote className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight truncate">{f.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {f.alunos} {f.alunos === 1 ? 'aluno' : 'alunos'} · recebido{' '}
                            {formatarBRL(f.recebido)} de {formatarBRL(f.previsto)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-semibold tabular-nums ${f.falta > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {f.falta > 0 ? formatarBRL(f.falta) : 'em dia'}
                          </p>
                          {f.falta > 0 && <p className="text-[10px] text-muted-foreground">a receber</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
              ),
          },
        ]}
      />
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
