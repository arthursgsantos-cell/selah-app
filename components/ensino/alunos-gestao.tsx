'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, X, Loader2, Phone, Mail, Award, Users, Clock, Pencil, Trash2, UserPlus,
  ChevronLeft, ChevronRight, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STATUS_INSCRICAO, corFrequencia } from '@/lib/ensino/turma'
import {
  decidirInscricaoAction,
  concluirInscricaoAction,
} from '@/app/actions/ensino/inscricoes'
import {
  editarAlunoManualAction,
  removerAlunoManualAction,
} from '@/app/actions/ensino/alunos-manuais'
import { AdicionarAluno } from '@/components/ensino/adicionar-aluno'
import { ImportarAlunos } from '@/components/ensino/importar-alunos'
import type { OrigemInscricaoEnsino, StatusInscricaoEnsino } from '@/lib/supabase/types'

export interface AlunoInscrito {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  avatarUrl: string | null
  status: StatusInscricaoEnsino
  /** `manual` = o professor cadastrou pelo painel, não veio de inscrição. */
  origem: OrigemInscricaoEnsino
  /** Falso enquanto a pessoa não tem perfil no app. */
  temConta: boolean
  observacao: string | null
  criadoEm: string
  /** Quem aprovou ou recusou, e quando. Nulos enquanto o pedido está pendente. */
  decididoPor: string | null
  decididoEm: string | null
  dados: Record<string, string>
  /** Null quando ainda não houve aula realizada. */
  percentual: number | null
  presentes: number
  totalAulas: number
}

/**
 * "05/08/2026 às 14:32" no fuso da igreja.
 *
 * `criado_em` e `decidido_em` são `timestamptz`, então aqui é o navegador que
 * converte — e o membro em Natal vê a hora dele, não UTC.
 */
function dataHoraBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(', ', ' às ')
}

/**
 * Alunos por página.
 *
 * Vinte cabe numa rolagem e ainda deixa a turma inteira visível na maioria dos
 * casos — a paginação só aparece quando passa disso.
 */
const POR_PAGINA = 20

type FiltroAluno = 'todos' | 'cursando' | 'concluidos' | 'faltando' | 'sem_conta'

const FILTROS: { valor: FiltroAluno; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'cursando', label: 'Cursando' },
  { valor: 'concluidos', label: 'Concluídos' },
  { valor: 'faltando', label: 'Frequência baixa' },
  { valor: 'sem_conta', label: 'Sem conta no app' },
]

function rotuloDecisao(status: StatusInscricaoEnsino): string {
  if (status === 'recusada') return 'Recusada'
  if (status === 'cancelada') return 'Cancelada'
  if (status === 'concluida') return 'Concluída'
  return 'Aprovada'
}

export function AlunosGestao({
  turmaId,
  alunos,
  vagasRestantes,
}: {
  turmaId: string
  alunos: AlunoInscrito[]
  /** Null quando a turma não tem limite. */
  vagasRestantes: number | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [agindoEm, setAgindoEm] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroAluno>('todos')
  const [pagina, setPagina] = useState(0)

  const pendentes = alunos.filter((a) => a.status === 'pendente')
  const ativosTodos = alunos.filter((a) => a.status === 'aprovada' || a.status === 'concluida')
  const recusados = alunos.filter((a) => a.status === 'recusada' || a.status === 'cancelada')

  // Busca e filtro valem só sobre a lista da turma — pendentes e recusados são
  // filas curtas, e escondê-las atrás de um filtro faria a pessoa perder o
  // pedido que precisa responder.
  const ativos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return ativosTodos.filter((a) => {
      if (termo && !a.nome.toLowerCase().includes(termo)) return false
      if (filtro === 'concluidos') return a.status === 'concluida'
      if (filtro === 'cursando') return a.status === 'aprovada'
      if (filtro === 'sem_conta') return !a.temConta
      // "Faltando" só faz sentido depois de haver aula realizada: sem isso,
      // todo mundo teria 0% e a lista inteira apareceria como problema.
      if (filtro === 'faltando') return a.percentual !== null && a.percentual < 75
      return true
    })
  }, [ativosTodos, busca, filtro])

  const totalPaginas = Math.max(1, Math.ceil(ativos.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const ativosVisiveis = ativos.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)

  function decidir(id: string, decisao: 'aprovada' | 'recusada') {
    setErro(null)
    setAgindoEm(id)
    startTransition(async () => {
      const r = await decidirInscricaoAction(id, decisao)
      setAgindoEm(null)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  function concluir(id: string) {
    setErro(null)
    setAgindoEm(id)
    startTransition(async () => {
      const r = await concluirInscricaoAction(id)
      setAgindoEm(null)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  function remover(aluno: AlunoInscrito) {
    // Quem veio do link pode pedir de novo depois; quem foi digitado pelo
    // professor some de vez. A confirmação diz qual dos dois é o caso.
    const consequencia = aluno.origem === 'manual'
      ? 'O cadastro dele nesta turma e as presenças serão apagados.'
      : 'As presenças serão apagadas. Ele poderá se inscrever de novo pelo link.'
    if (!confirm(`Remover ${aluno.nome} da turma?\n\n${consequencia}`)) return
    setErro(null)
    setAgindoEm(aluno.id)
    startTransition(async () => {
      const r = await removerAlunoManualAction(aluno.id)
      setAgindoEm(null)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  if (alunos.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum aluno ainda</p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">
            Compartilhe o link da turma para que se inscrevam pelo app — ou cadastre você mesmo
            quem já está na sala.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <AdicionarAluno turmaId={turmaId} />
            <ImportarAlunos turmaId={turmaId} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {ativosTodos.length} {ativosTodos.length === 1 ? 'aluno na turma' : 'alunos na turma'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ImportarAlunos turmaId={turmaId} />
          <AdicionarAluno turmaId={turmaId} />
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {pendentes.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-3">
            Aguardando aprovação ({pendentes.length})
          </p>
          {vagasRestantes !== null && vagasRestantes < pendentes.length && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Restam {vagasRestantes} {vagasRestantes === 1 ? 'vaga' : 'vagas'} para{' '}
              {pendentes.length} pedidos.
            </p>
          )}
          <div className="space-y-2">
            {pendentes.map((a) => (
              <Cartao key={a.id} aluno={a}>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => decidir(a.id, 'aprovada')}
                    disabled={isPending}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {agindoEm === a.id && isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => decidir(a.id, 'recusada')}
                    disabled={isPending}
                    aria-label={`Recusar inscrição de ${a.nome}`}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Cartao>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Alunos da turma ({ativosTodos.length})
        </p>

        {/* Busca e filtros só aparecem quando há gente o bastante para se
            perder na lista — numa turma de oito nomes eles seriam ruído. */}
        {ativosTodos.length > 8 && (
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
                placeholder="Buscar aluno pelo nome..."
                className="pl-8 h-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => { setFiltro(f.valor); setPagina(0) }}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    filtro === f.valor
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {ativosTodos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum aluno aprovado ainda.</p>
        ) : ativos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum aluno com esse nome ou filtro.
          </p>
        ) : (
          <div className="space-y-2">
            {ativosVisiveis.map((a) => (
              <Cartao
                key={a.id}
                aluno={a}
                mostrarFrequencia
                emEdicao={editando === a.id}
                onFecharEdicao={() => setEditando(null)}
              >
                {/* Corrigir só vale para quem o professor digitou: onde há
                    perfil, o nome é da pessoa e quem edita é ela. Remover vale
                    para todos — a turma precisa de saída para quem desistiu ou
                    se inscreveu por engano. */}
                {a.origem === 'manual' && !a.temConta && (
                  <button
                    type="button"
                    onClick={() => setEditando(editando === a.id ? null : a.id)}
                    disabled={isPending}
                    aria-label={`Corrigir dados de ${a.nome}`}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remover(a)}
                  disabled={isPending}
                  aria-label={`Remover ${a.nome} da turma`}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
                >
                  {agindoEm === a.id && isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
                {a.status === 'aprovada' && (
                  <button
                    type="button"
                    onClick={() => concluir(a.id)}
                    disabled={isPending}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {agindoEm === a.id && isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Award className="h-3.5 w-3.5" />
                    )}
                    Concluir
                  </button>
                )}
              </Cartao>
            ))}

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  {paginaAtual * POR_PAGINA + 1}–
                  {Math.min((paginaAtual + 1) * POR_PAGINA, ativos.length)} de {ativos.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPagina(paginaAtual - 1)}
                    disabled={paginaAtual === 0}
                    aria-label="Página anterior"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {paginaAtual + 1}/{totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPagina(paginaAtual + 1)}
                    disabled={paginaAtual >= totalPaginas - 1}
                    aria-label="Próxima página"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {recusados.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Recusadas e canceladas ({recusados.length})
          </p>
          <div className="space-y-2 opacity-60">
            {recusados.map((a) => (
              <Cartao key={a.id} aluno={a}>
                {a.status === 'recusada' && (
                  <button
                    type="button"
                    onClick={() => decidir(a.id, 'aprovada')}
                    disabled={isPending}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    Aprovar mesmo assim
                  </button>
                )}
              </Cartao>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Cartao({
  aluno,
  mostrarFrequencia = false,
  emEdicao = false,
  onFecharEdicao,
  children,
}: {
  aluno: AlunoInscrito
  mostrarFrequencia?: boolean
  emEdicao?: boolean
  onFecharEdicao?: () => void
  children?: React.ReactNode
}) {
  const extras = Object.entries(aluno.dados).filter(([, v]) => v)

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
          {aluno.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              referrerPolicy="no-referrer"
              src={aluno.avatarUrl}
              alt={aluno.nome}
              className="h-full w-full object-cover"
            />
          ) : (
            aluno.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight">
              {aluno.nome}
              {/* Sem conta: a chamada funciona igual, mas ninguém vai receber
                  aviso nem ver a própria frequência. O professor precisa saber
                  disso ao olhar a lista, não ao estranhar o silêncio depois. */}
              {!aluno.temConta && (
                <span
                  title="Cadastrado pelo professor — ainda não tem conta no app"
                  className="ml-1.5 align-middle inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                >
                  <UserPlus className="h-2.5 w-2.5" />
                  sem conta
                </span>
              )}
            </p>
            <span
              className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_INSCRICAO[aluno.status].classe}`}
            >
              {STATUS_INSCRICAO[aluno.status].label}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap mt-1">
            {aluno.telefone && (
              <a
                href={`https://wa.me/55${aluno.telefone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-green-700 transition-colors flex items-center gap-1"
              >
                <Phone className="h-3 w-3" />
                {aluno.telefone}
              </a>
            )}
            {aluno.email && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[14rem]">
                <Mail className="h-3 w-3 shrink-0" />
                {aluno.email}
              </span>
            )}
          </div>

          {mostrarFrequencia && (
            <p className="text-xs mt-1">
              <span className={`font-semibold ${corFrequencia(aluno.percentual)}`}>
                {aluno.percentual === null ? 'sem aulas realizadas' : `${aluno.percentual}% de presença`}
              </span>
              {aluno.totalAulas > 0 && (
                <span className="text-muted-foreground">
                  {' '}· {aluno.presentes}/{aluno.totalAulas} aulas
                </span>
              )}
            </p>
          )}

          {extras.length > 0 && (
            <dl className="mt-2 space-y-0.5 border-t pt-2">
              {extras.map(([chave, valor]) => (
                <div key={chave} className="flex gap-2 text-xs">
                  <dt className="text-muted-foreground shrink-0">{chave}:</dt>
                  <dd className="min-w-0">{valor}</dd>
                </div>
              ))}
            </dl>
          )}

          {aluno.observacao && (
            <p className="text-xs text-muted-foreground mt-1.5 italic">{aluno.observacao}</p>
          )}

          {/* Trilha da decisão: quem resolveu e quando. Sem isso, uma recusa
              questionada depois não tem a quem perguntar. */}
          <p className="text-[11px] text-muted-foreground/70 mt-1.5 flex items-center gap-1 flex-wrap">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              {aluno.origem === 'manual' ? 'Cadastrado' : 'Pedido'} em{' '}
              {dataHoraBr(aluno.criadoEm)}
            </span>
            {aluno.decididoEm && aluno.origem === 'app' && (
              <span>
                · {rotuloDecisao(aluno.status)}
                {aluno.decididoPor ? ` por ${aluno.decididoPor}` : ''} em{' '}
                {dataHoraBr(aluno.decididoEm)}
              </span>
            )}
            {aluno.origem === 'manual' && aluno.decididoPor && (
              <span>· por {aluno.decididoPor}</span>
            )}
          </p>
        </div>
      </div>

      {emEdicao && <FormEdicao aluno={aluno} onFechar={onFecharEdicao} />}

      {children && <div className="flex justify-end gap-2 mt-2.5">{children}</div>}
    </div>
  )
}

/**
 * Correção do que foi digitado na pressa.
 *
 * Aparece dentro do próprio cartão, e não em diálogo: o professor está olhando
 * a lista para conferir com a folha na mão, e tirar a lista da frente para
 * arrumar uma letra atrapalharia justamente a conferência.
 */
function FormEdicao({
  aluno,
  onFechar,
}: {
  aluno: AlunoInscrito
  onFechar?: () => void
}) {
  const router = useRouter()
  const [nome, setNome] = useState(aluno.nome)
  const [telefone, setTelefone] = useState(aluno.telefone ?? '')
  const [email, setEmail] = useState(aluno.email ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, startSalvar] = useTransition()

  function salvar() {
    setErro(null)
    startSalvar(async () => {
      const r = await editarAlunoManualAction({ inscricaoId: aluno.id, nome, telefone, email })
      if (!r.ok) { setErro(r.erro); return }
      onFechar?.()
      router.refresh()
    })
  }

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="Telefone"
          inputMode="tel"
        />
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          inputMode="email"
          autoCapitalize="none"
        />
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button size="xs" onClick={salvar} disabled={salvando || nome.trim().length < 2}>
          {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  )
}
