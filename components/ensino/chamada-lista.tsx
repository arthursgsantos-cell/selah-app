'use client'

import { useState, useCallback, useMemo } from 'react'
import { Check, X, Loader2, CloudOff, CheckCheck, RotateCcw } from 'lucide-react'
import { marcarPresencaAction, marcarTodosAction, type LinhaChamada } from '@/app/actions/ensino/presenca'

type EstadoSalvamento = 'limpo' | 'salvando' | 'salvo' | 'erro'

interface Linha extends LinhaChamada {
  estado: EstadoSalvamento
}

/**
 * Lista de chamada com salvamento automático.
 *
 * Cada toque grava na hora, um aluno por vez — não existe botão "salvar" nem
 * rascunho em memória. É o ponto do pedido: a chamada é feita no celular, em
 * pé, e fechar a aba sem querer no meio da lista não pode apagar o que já foi
 * marcado.
 *
 * O que falha fica visível e clicável de novo: a linha ganha o ícone de nuvem
 * cortada e entra na contagem do rodapé, em vez de sumir em silêncio.
 */
export function ChamadaLista({
  aulaId,
  inicial,
}: {
  aulaId: string
  inicial: LinhaChamada[]
}) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    inicial.map((l) => ({ ...l, estado: 'limpo' as EstadoSalvamento }))
  )
  const [marcandoTodos, setMarcandoTodos] = useState(false)

  const atualizar = useCallback(
    (inscricaoId: string, mudanca: Partial<Linha>) => {
      setLinhas((atual) =>
        atual.map((l) => (l.inscricaoId === inscricaoId ? { ...l, ...mudanca } : l))
      )
    },
    []
  )

  const marcar = useCallback(
    async (linha: Linha, presente: boolean) => {
      // Otimista: a lista responde ao toque na hora, e só volta atrás se o
      // servidor recusar. Numa sala com sinal ruim isso é a diferença entre
      // conseguir e não conseguir fazer a chamada.
      const anterior = linha.presente
      atualizar(linha.inscricaoId, { presente, estado: 'salvando' })

      const r = await marcarPresencaAction({
        aulaId,
        inscricaoId: linha.inscricaoId,
        presente,
      })

      if (r.ok) {
        atualizar(linha.inscricaoId, { estado: 'salvo', registradoEm: r.registradoEm })
      } else {
        atualizar(linha.inscricaoId, { presente: anterior, estado: 'erro' })
      }
    },
    [aulaId, atualizar]
  )

  async function marcarTodos(presente: boolean) {
    setMarcandoTodos(true)
    setLinhas((atual) => atual.map((l) => ({ ...l, presente, estado: 'salvando' })))

    const r = await marcarTodosAction({ aulaId, presente })

    setLinhas((atual) =>
      atual.map((l) => ({
        ...l,
        presente: r.ok ? presente : l.presente,
        estado: r.ok ? 'salvo' : 'erro',
      }))
    )
    setMarcandoTodos(false)
  }

  async function tentarDeNovo() {
    const comErro = linhas.filter((l) => l.estado === 'erro')
    for (const linha of comErro) {
      await marcar(linha, linha.presente ?? false)
    }
  }

  const { presentes, ausentes, pendentes, comErro, salvando } = useMemo(() => ({
    presentes: linhas.filter((l) => l.presente === true).length,
    ausentes: linhas.filter((l) => l.presente === false).length,
    pendentes: linhas.filter((l) => l.presente === null).length,
    comErro: linhas.filter((l) => l.estado === 'erro').length,
    salvando: linhas.some((l) => l.estado === 'salvando'),
  }), [linhas])

  if (linhas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center">
        <p className="text-sm text-muted-foreground">Nenhum aluno aprovado nesta turma ainda.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Aprove as inscrições pendentes para a lista de chamada aparecer.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Atalhos */}
      <div className="flex items-center gap-2">
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

      {/* Lista */}
      <div className="rounded-2xl border border-border divide-y overflow-hidden">
        {linhas.map((l) => (
          <div key={l.inscricaoId} className="flex items-center gap-3 px-3 py-2.5">
            <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
              {l.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  referrerPolicy="no-referrer"
                  src={l.avatarUrl}
                  alt={l.nome}
                  className="h-full w-full object-cover"
                />
              ) : (
                l.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight truncate">{l.nome}</p>
              <p className="text-[11px] h-4 flex items-center gap-1">
                {l.estado === 'salvando' && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    salvando
                  </span>
                )}
                {l.estado === 'salvo' && <span className="text-green-600">salvo</span>}
                {l.estado === 'erro' && (
                  <span className="text-destructive flex items-center gap-1">
                    <CloudOff className="h-3 w-3" />
                    não salvou — toque de novo
                  </span>
                )}
                {l.estado === 'limpo' && l.presente === null && (
                  <span className="text-muted-foreground/60">sem registro</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-label={`Marcar ${l.nome} como presente`}
                aria-pressed={l.presente === true}
                onClick={() => marcar(l, true)}
                disabled={marcandoTodos}
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                  l.presente === true
                    ? 'bg-green-500 text-white shadow-md'
                    : 'border-2 border-green-300 text-green-500 hover:bg-green-50'
                }`}
              >
                <Check className="h-5 w-5" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label={`Marcar ${l.nome} como ausente`}
                aria-pressed={l.presente === false}
                onClick={() => marcar(l, false)}
                disabled={marcandoTodos}
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                  l.presente === false
                    ? 'bg-red-500 text-white shadow-md'
                    : 'border-2 border-red-300 text-red-500 hover:bg-red-50'
                }`}
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Resumo fixo no rodapé: no celular a lista é longa e o professor precisa
          da contagem sem rolar até o fim. */}
      <div className="sticky bottom-0 -mx-4 md:mx-0 border-t bg-background/95 backdrop-blur px-4 py-3 md:rounded-2xl md:border">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-green-600 font-semibold">{presentes} presentes</span>
            <span className="text-red-600 font-semibold">{ausentes} faltas</span>
            {pendentes > 0 && (
              <span className="text-muted-foreground">{pendentes} sem marcar</span>
            )}
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
