import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft, BookOpen, CalendarDays, Check, X, Minus, ChevronRight, GraduationCap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { PAINEL } from '@/lib/estilos'
import {
  STATUS_INSCRICAO, corFrequencia, dataBr, encontrosTexto,
} from '@/lib/ensino/turma'
import { MateriaisLista, type MaterialItem } from '@/components/ensino/materiais-lista'
import type { StatusAula, StatusInscricaoEnsino, StatusTurma } from '@/lib/supabase/types'

export const metadata = { title: 'Meus cursos · Ensino IBZS' }

/**
 * Área do aluno.
 *
 * Tudo aqui sai das consultas com o cliente do próprio usuário, então a RLS já
 * garante o que o pedido exige: ninguém vê a lista dos colegas nem a presença
 * de outra pessoa. Não existe consulta com o cliente admin nesta página.
 */
export default async function AreaAlunoPage() {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom('/ensino/aluno'))

  const supabase = await createClient()

  const { data: inscricoesRaw } = await supabase
    .from('ensino_inscricoes')
    .select(
      'id, status, observacao, criado_em, turma_id, ensino_turmas(id, nome, capa_url, local, status, dias_semana, horario_inicio, horario_fim, whatsapp_url, ensino_cursos(nome))'
    )
    .eq('user_id', acesso.userId)
    .order('criado_em', { ascending: false })

  const inscricoes = (inscricoesRaw ?? []) as unknown as {
    id: string
    status: StatusInscricaoEnsino
    observacao: string | null
    criado_em: string
    turma_id: string
    ensino_turmas: {
      id: string; nome: string; capa_url: string | null; local: string | null
      status: StatusTurma; dias_semana: number[]
      horario_inicio: string | null; horario_fim: string | null
      whatsapp_url: string | null
      ensino_cursos: { nome: string } | null
    } | null
  }[]

  const ativas = inscricoes.filter((i) => i.status === 'aprovada' || i.status === 'concluida')
  const pendentes = inscricoes.filter((i) => i.status === 'pendente')
  const outras = inscricoes.filter((i) => i.status === 'recusada' || i.status === 'cancelada')

  const turmasAtivas = ativas.map((i) => i.turma_id)

  const [aulasRes, presencasRes, materiaisRes] = await Promise.all([
    turmasAtivas.length > 0
      ? supabase
          .from('ensino_aulas')
          .select('id, turma_id, numero, titulo, data, hora_inicio, local, status')
          .in('turma_id', turmasAtivas)
          .order('data')
      : Promise.resolve({ data: [] }),
    supabase
      .from('ensino_presencas')
      .select('aula_id, presente')
      .eq('user_id', acesso.userId),
    turmasAtivas.length > 0
      ? supabase
          .from('ensino_materiais')
          .select('id, turma_id, titulo, descricao, tipo, arquivo_nome, arquivo_tamanho, publico, criado_em, ensino_aulas(numero)')
          .in('turma_id', turmasAtivas)
          .order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const aulas = (aulasRes.data ?? []) as {
    id: string; turma_id: string; numero: number; titulo: string | null
    data: string; hora_inicio: string | null; local: string | null; status: StatusAula
  }[]

  const minhasPresencas = new Map(
    ((presencasRes.data ?? []) as { aula_id: string; presente: boolean }[]).map((p) => [
      p.aula_id,
      p.presente,
    ])
  )

  const materiais = ((materiaisRes.data ?? []) as unknown as {
    id: string; turma_id: string; titulo: string; descricao: string | null
    tipo: MaterialItem['tipo']; arquivo_nome: string | null; arquivo_tamanho: number | null
    publico: boolean; criado_em: string; ensino_aulas: { numero: number } | null
  }[]).map((m) => ({
    ...m,
    item: {
      id: m.id,
      titulo: m.titulo,
      descricao: m.descricao,
      tipo: m.tipo,
      arquivoNome: m.arquivo_nome,
      arquivoTamanho: m.arquivo_tamanho,
      publico: m.publico,
      criadoEm: m.criado_em,
      aulaNumero: m.ensino_aulas?.numero ?? null,
    } as MaterialItem,
  }))

  const hoje = new Date().toISOString().slice(0, 10)
  const proximas = aulas
    .filter((a) => a.data >= hoje && a.status !== 'cancelada')
    .slice(0, 4)

  const nomeDaTurma = (turmaId: string) =>
    ativas.find((i) => i.turma_id === turmaId)?.ensino_turmas?.nome ?? 'Turma'

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
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Meus cursos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suas turmas, frequência e materiais
          </p>
        </div>
      </div>

      {inscricoes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <GraduationCap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Você ainda não se inscreveu em nenhum curso</p>
          <Link href="/ensino" className="text-sm text-primary hover:underline font-medium mt-2 inline-block">
            Ver turmas abertas
          </Link>
        </div>
      )}

      {/* Pedidos aguardando decisão */}
      {pendentes.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-3">
            Aguardando aprovação
          </p>
          <div className="space-y-2">
            {pendentes.map((i) => (
              <Link
                key={i.id}
                href={`/ensino/turma/${i.turma_id}`}
                className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 transition-colors hover:bg-amber-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{i.ensino_turmas?.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.ensino_turmas?.ensino_cursos?.nome} · pedido em {dataBr(i.criado_em.slice(0, 10))}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
            {proximas.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-[8px] font-bold uppercase leading-none">Aula</span>
                  <span className="text-sm font-bold leading-none">{a.numero}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug truncate">{a.titulo ?? `Aula ${a.numero}`}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {nomeDaTurma(a.turma_id)} · {dataBr(a.data)}
                    {a.hora_inicio && ` · ${a.hora_inicio.slice(0, 5)}`}
                  </p>
                </div>
                {a.local && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {a.local}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Turmas em que estou */}
      {ativas.map((inscricao) => {
        const turma = inscricao.ensino_turmas
        if (!turma) return null

        const aulasDaTurma = aulas.filter((a) => a.turma_id === turma.id)
        const realizadas = aulasDaTurma.filter((a) => a.status === 'realizada')
        const comRegistro = realizadas.filter((a) => minhasPresencas.has(a.id))
        const presentes = comRegistro.filter((a) => minhasPresencas.get(a.id) === true).length
        const percentual =
          comRegistro.length > 0 ? Math.round((presentes / comRegistro.length) * 100) : null

        const materiaisDaTurma = materiais
          .filter((m) => m.turma_id === turma.id)
          .map((m) => m.item)

        return (
          <section key={inscricao.id} className={`${PAINEL} space-y-4`}>
            <div className="flex items-start justify-between gap-3">
              <Link href={`/ensino/turma/${turma.id}`} className="min-w-0 group">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  {turma.ensino_cursos?.nome}
                </p>
                <p className="font-semibold leading-tight mt-0.5 group-hover:text-primary transition-colors">
                  {turma.nome}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {encontrosTexto(turma.dias_semana, turma.horario_inicio, turma.horario_fim)}
                  {turma.local && ` · ${turma.local}`}
                </p>
              </Link>
              <span
                className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_INSCRICAO[inscricao.status].classe}`}
              >
                {STATUS_INSCRICAO[inscricao.status].label}
              </span>
            </div>

            {/* Frequência */}
            <div className="rounded-xl bg-muted p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Minha frequência
                </span>
                <span className={`text-lg font-bold leading-none ${corFrequencia(percentual)}`}>
                  {percentual === null ? '—' : `${percentual}%`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {comRegistro.length === 0
                  ? 'Nenhuma chamada registrada ainda.'
                  : `${presentes} presenças em ${comRegistro.length} ${comRegistro.length === 1 ? 'aula' : 'aulas'}.`}
              </p>

              {aulasDaTurma.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {aulasDaTurma.map((a) => {
                    const valor = minhasPresencas.get(a.id)
                    return (
                      <span
                        key={a.id}
                        title={`Aula ${a.numero} · ${dataBr(a.data)}`}
                        className={`h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          valor === true
                            ? 'bg-green-100 text-green-700'
                            : valor === false
                              ? 'bg-red-100 text-red-600'
                              : 'bg-background text-muted-foreground/40 border border-border'
                        }`}
                      >
                        {valor === true ? (
                          <Check className="h-3 w-3" />
                        ) : valor === false ? (
                          <X className="h-3 w-3" />
                        ) : (
                          <Minus className="h-2.5 w-2.5" />
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Materiais da turma */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                Materiais
              </p>
              <MateriaisLista
                materiais={materiaisDaTurma}
                vazio="O professor ainda não publicou materiais nesta turma."
              />
            </div>

            {/* Calendário completo */}
            {aulasDaTurma.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Todas as aulas ({aulasDaTurma.length})
                </summary>
                <div className="rounded-xl border border-border divide-y overflow-hidden mt-2">
                  {aulasDaTurma.map((a) => {
                    const valor = minhasPresencas.get(a.id)
                    return (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                          {a.numero}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{a.titulo ?? `Aula ${a.numero}`}</p>
                          <p className="text-xs text-muted-foreground">{dataBr(a.data)}</p>
                        </div>
                        <span className="shrink-0 text-xs">
                          {valor === true ? (
                            <span className="text-green-600 font-medium">Presente</span>
                          ) : valor === false ? (
                            <span className="text-red-600 font-medium">Faltou</span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </details>
            )}

            {turma.whatsapp_url && (
              <a
                href={turma.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 hover:text-green-800 transition-colors"
              >
                Grupo da turma no WhatsApp
              </a>
            )}
          </section>
        )
      })}

      {outras.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Histórico
          </p>
          <div className="rounded-2xl border border-border divide-y overflow-hidden opacity-70">
            {outras.map((i) => (
              <Link
                key={i.id}
                href={`/ensino/turma/${i.turma_id}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{i.ensino_turmas?.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.ensino_turmas?.ensino_cursos?.nome}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_INSCRICAO[i.status].classe}`}
                >
                  {STATUS_INSCRICAO[i.status].label}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
