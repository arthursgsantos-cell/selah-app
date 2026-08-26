'use client'

import { useCallback, useMemo, useState } from 'react'
import { Check, X, Loader2, CloudOff, CheckCheck, RotateCcw, Heart, Plus, Trash2, UserPlus } from 'lucide-react'
import {
  marcarPresencaChamadaAction,
  marcarTodosChamadaAction,
  marcarConjugeChamadaAction,
  adicionarVisitanteAction,
  removerVisitanteAction,
  type LinhaChamada,
} from '@/app/actions/chamada'

type EstadoSalvamento = 'limpo' | 'salvando' | 'salvo' | 'erro'

interface Linha extends LinhaChamada {
  estado: EstadoSalvamento
}

/**
 * A chamada da célula, com salvamento a cada toque.
 *
 * Mesmo princípio da chamada do Ensino: nada de rascunho em memória e botão
 * "salvar" no fim. A lista é feita no celular, de pé, com a sala cheia — e a
 * aba que fecha sozinha não pode levar o encontro junto.
 *
 * O que falha fica visível e clicável de novo, em vez de sumir em silêncio.
 */
export function ChamadaEncontro({
  encontroId,
  linhasIniciais,
  visitantesIniciais,
}: {
  encontroId: string
  linhasIniciais: LinhaChamada[]
  visitantesIniciais: LinhaChamada[]
}) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    linhasIniciais.map((l) => ({ ...l, estado: 'limpo' as EstadoSalvamento })),
  )
  const [visitantes, setVisitantes] = useState<Linha[]>(() =>
    visitantesIniciais.map((l) => ({ ...l, estado: 'limpo' as EstadoSalvamento })),
  )
  const [novoVisitante, setNovoVisitante] = useState('')
  const [marcandoTodos, setMarcandoTodos] = useState(false)

  const atualizar = useCallback((chave: string, mudanca: Partial<Linha>) => {
    const aplicar = (atual: Linha[]) =>
      atual.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l))
    setLinhas(aplicar)
    setVisitantes(aplicar)
  }, [])

  const marcar = useCallback(
    async (linha: Linha, presente: boolean) => {
      // Otimista: a lista responde ao toque na hora e só volta atrás se o
      // servidor recusar. Numa sala com sinal ruim, é a diferença entre
      // conseguir e não conseguir fazer a chamada.
      const anterior = linha.presente
      atualizar(linha.chave, { presente, estado: 'salvando' })

      const r = await marcarPresencaChamadaAction({ encontroId, chave: linha.chave, presente })
      atualizar(linha.chave, r.ok ? { estado: 'salvo' } : { presente: anterior, estado: 'erro' })
    },
    [encontroId, atualizar],
  )

  const alternarConjuge = useCallback(
    async (linha: Linha) => {
      const valor = !linha.comConjuge
      atualizar(linha.chave, { comConjuge: valor, estado: 'salvando' })

      const r = await marcarConjugeChamadaAction({ encontroId, chave: linha.chave, comConjuge: valor })
      atualizar(linha.chave, r.ok ? { estado: 'salvo' } : { comConjuge: !valor, estado: 'erro' })
    },
    [encontroId, atualizar],
  )

  async function marcarTodos(presente: boolean) {
    setMarcandoTodos(true)
    setLinhas((atual) => atual.map((l) => ({ ...l, presente, estado: 'salvando' })))

    const r = await marcarTodosChamadaAction({ encontroId, presente })
    setLinhas((atual) =>
      atual.map((l) => ({
        ...l,
        presente: r.ok ? presente : l.presente,
        estado: r.ok ? 'salvo' : 'erro',
      })),
    )
    setMarcandoTodos(false)
  }

  async function tentarDeNovo() {
    for (const l of [...linhas, ...visitantes].filter((l) => l.estado === 'erro')) {
      await marcar(l, l.presente ?? false)
    }
  }

  async function adicionarVisitante() {
    const nome = novoVisitante.trim()
    if (!nome) return
    setNovoVisitante('')

    const r = await adicionarVisitanteAction({ encontroId, nome })
    if (!r.ok) {
      setNovoVisitante(nome)
      return
    }
    setVisitantes((atual) => [
      ...atual,
      {
        chave: r.chave, tipo: 'visitante', nome: r.nome, avatarUrl: null, lider: false,
        presente: true, rsvp: null, conjugeNome: null, comConjuge: false,
        visitantesDeclarados: 0, estado: 'salvo',
      },
    ])
  }

  async function removerVisitante(chave: string) {
    const antes = visitantes
    setVisitantes((atual) => atual.filter((v) => v.chave !== chave))
    const r = await removerVisitanteAction({ encontroId, chave })
    if (!r.ok) setVisitantes(antes)
  }

  const { presentes, ausentes, pendentes, comErro, salvando, totalPessoas } = useMemo(() => {
    const todas = [...linhas, ...visitantes]
    const presentesLista = linhas.filter((l) => l.presente === true)
    const visitantesPresentes = visitantes.filter((v) => v.presente === true)
    return {
      presentes: presentesLista.length,
      ausentes: linhas.filter((l) => l.presente === false).length,
      pendentes: linhas.filter((l) => l.presente === null).length,
      comErro: todas.filter((l) => l.estado === 'erro').length,
      salvando: todas.some((l) => l.estado === 'salvando'),
      totalPessoas:
        presentesLista.length
        + presentesLista.filter((l) => l.comConjuge).length
        + visitantesPresentes.length,
    }
  }, [linhas, visitantes])

  if (linhas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center">
        <p className="text-sm text-muted-foreground">Esta célula ainda não tem ninguém na lista.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Adicione os membros da célula para a chamada aparecer.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Atalhos */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => marcarTodos(true)}
          disabled={marcandoTodos}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Todos presentes
        </button>
        {comErro > 0 && (
          <button
            type="button"
            onClick={tentarDeNovo}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar de novo ({comErro})
          </button>
        )}
      </div>

      {/* A célula */}
      <div className="rounded-2xl border border-border divide-y overflow-hidden">
        {linhas.map((l) => (
          <LinhaPessoa
            key={l.chave}
            linha={l}
            desabilitado={marcandoTodos}
            onMarcar={(presente) => marcar(l, presente)}
            onConjuge={() => alternarConjuge(l)}
          />
        ))}
      </div>

      {/* Visitantes do dia */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UserPlus className="h-3.5 w-3.5 text-green-600" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Visitantes
          </p>
          <span className="text-[11px] text-muted-foreground/70 ml-auto">
            quem veio e não está na lista
          </span>
        </div>

        {visitantes.length > 0 && (
          <div className="rounded-2xl border border-border divide-y overflow-hidden">
            {visitantes.map((v) => (
              <div key={v.chave} className="flex items-center gap-3 px-3 py-2.5">
                <div className="h-9 w-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                  <UserPlus className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium flex-1 min-w-0 truncate">{v.nome}</p>
                <button
                  type="button"
                  aria-label={`Remover ${v.nome}`}
                  onClick={() => removerVisitante(v.chave)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={novoVisitante}
            onChange={(e) => setNovoVisitante(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                adicionarVisitante()
              }
            }}
            placeholder="Nome do visitante"
            className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
          />
          <button
            type="button"
            onClick={adicionarVisitante}
            disabled={!novoVisitante.trim()}
            className="flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Resumo fixo: no celular a lista é longa e o líder precisa da contagem
          sem rolar até o fim. */}
      <div className="sticky bottom-0 -mx-4 md:mx-0 border-t bg-background/95 backdrop-blur px-4 py-3 md:rounded-2xl md:border">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-green-600 font-semibold">{presentes} presentes</span>
            <span className="text-red-600 font-semibold">{ausentes} faltas</span>
            {pendentes > 0 && <span className="text-muted-foreground">{pendentes} sem marcar</span>}
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground font-semibold">{totalPessoas} pessoas na casa</span>
          </div>
          <span className="text-xs flex items-center gap-1 shrink-0">
            {salvando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">salvando…</span>
              </>
            ) : comErro > 0 ? (
              <>
                <CloudOff className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive">{comErro} não salvos</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                <span className="text-green-600">tudo salvo</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function LinhaPessoa({
  linha,
  desabilitado,
  onMarcar,
  onConjuge,
}: {
  linha: Linha
  desabilitado: boolean
  onMarcar: (presente: boolean) => void
  onConjuge: () => void
}) {
  const iniciais = linha.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
          {linha.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              referrerPolicy="no-referrer"
              src={linha.avatarUrl}
              alt={linha.nome}
              className="h-full w-full object-cover"
            />
          ) : (
            iniciais
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">
            {linha.nome}
            {linha.lider && (
              <span className="ml-1.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                líder
              </span>
            )}
          </p>
          <p className="text-[11px] h-4 flex items-center gap-1">
            {linha.estado === 'salvando' && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                salvando
              </span>
            )}
            {linha.estado === 'salvo' && <span className="text-green-600">salvo</span>}
            {linha.estado === 'erro' && (
              <span className="text-destructive flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                não salvou — toque de novo
              </span>
            )}
            {linha.estado === 'limpo' && (
              <MarcaDeContexto linha={linha} />
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label={`Marcar ${linha.nome} como presente`}
            aria-pressed={linha.presente === true}
            onClick={() => onMarcar(true)}
            disabled={desabilitado}
            className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
              linha.presente === true
                ? 'bg-green-500 text-white shadow-md'
                : 'border-2 border-green-300 text-green-500 hover:bg-green-50'
            }`}
          >
            <Check className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label={`Marcar ${linha.nome} como ausente`}
            aria-pressed={linha.presente === false}
            onClick={() => onMarcar(false)}
            disabled={desabilitado}
            className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
              linha.presente === false
                ? 'bg-red-500 text-white shadow-md'
                : 'border-2 border-red-300 text-red-500 hover:bg-red-50'
            }`}
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* O cônjuge sem cadastro próprio só aparece depois que a pessoa foi
          marcada presente — antes disso não há a quem somar. */}
      {linha.presente === true && linha.conjugeNome && (
        <button
          type="button"
          onClick={onConjuge}
          className={`mt-1.5 ml-12 flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors ${
            linha.comConjuge
              ? 'border-rose-300 bg-rose-50 text-rose-700'
              : 'border-dashed border-border text-muted-foreground hover:border-rose-300 hover:text-rose-600'
          }`}
        >
          <Heart className={`h-3 w-3 ${linha.comConjuge ? 'fill-rose-500 text-rose-500' : ''}`} />
          {linha.comConjuge ? `Com ${linha.conjugeNome}` : `Veio com ${linha.conjugeNome}?`}
        </button>
      )}
    </div>
  )
}

/**
 * A linha de baixo, quando não há nada a dizer sobre salvamento: o que a
 * própria pessoa avisou antes do encontro, e quem ainda não tem conta no app.
 */
function MarcaDeContexto({ linha }: { linha: Linha }) {
  if (linha.presente === null) {
    if (linha.rsvp === 'confirmado') return <span className="text-green-600/70">disse que viria</span>
    if (linha.rsvp === 'ausente') return <span className="text-red-500/70">avisou que não viria</span>
    if (linha.tipo === 'pre_cadastro') {
      return <span className="text-muted-foreground/60">ainda sem conta no app</span>
    }
    return <span className="text-muted-foreground/60">sem registro</span>
  }

  if (linha.presente && linha.visitantesDeclarados > 0) {
    return (
      <span className="text-green-700/70">
        avisou que traria {linha.visitantesDeclarados}{' '}
        {linha.visitantesDeclarados === 1 ? 'visitante' : 'visitantes'}
      </span>
    )
  }

  return <span />
}
