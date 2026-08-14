'use client'

import { useState } from 'react'

export interface Aba {
  id: string
  /** Rótulo curto, em linguagem de quem usa: "Pedidos", não "Solicitações". */
  titulo: string
  /** Uma linha explicando o que tem dentro — some no mobile estreito. */
  descricao?: string
  icone: React.ReactNode
  /** Número em destaque, tipo "3 pedidos esperando". */
  aviso?: number
  conteudo: React.ReactNode
}

interface Props {
  abas: Aba[]
  /** Aba aberta ao chegar. Sem isso, abre a primeira. */
  inicial?: string
}

/**
 * Painel de administração em abas.
 *
 * As telas de administração cresceram como uma página só, rolando por vinte
 * seções: quem procurava "onde mudo o horário do culto" precisava reconhecer o
 * formulário certo no meio de gráficos, listas e galerias.
 *
 * O desenho é deliberadamente grande e óbvio — botões altos, ícone junto do
 * nome, nada de menu escondido —, porque quem administra a igreja não é
 * necessariamente quem tem intimidade com aplicativo. O conteúdo de cada aba
 * continua vindo pronto do servidor; aqui só se decide qual mostrar.
 */
export function PainelAbas({ abas, inicial }: Props) {
  const [ativa, setAtiva] = useState(inicial ?? abas[0]?.id)
  const atual = abas.find((a) => a.id === ativa) ?? abas[0]

  return (
    <div className="space-y-4">
      {/* Os botões rolam de lado no celular em vez de quebrarem em três
          linhas, que empurrava o conteúdo para fora da tela. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <div className="flex gap-2 min-w-max">
          {abas.map((aba) => {
            const selecionada = aba.id === atual?.id
            return (
              <button
                key={aba.id}
                type="button"
                onClick={() => setAtiva(aba.id)}
                aria-pressed={selecionada}
                className={`relative flex min-w-[6.5rem] flex-col items-center gap-1.5 rounded-2xl border px-4 py-3 transition-colors ${
                  selecionada
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span className={selecionada ? '' : 'text-primary'}>{aba.icone}</span>
                <span className="text-xs font-semibold leading-none">{aba.titulo}</span>
                {aba.aviso != null && aba.aviso > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950 shadow">
                    {aba.aviso > 9 ? '9+' : aba.aviso}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {atual?.descricao && (
        <p className="px-1 text-xs text-muted-foreground leading-relaxed">{atual.descricao}</p>
      )}

      {/* Só a aba escolhida é montada: as outras nem entram no DOM, e a página
          deixa de carregar vinte seções de uma vez. */}
      <div className="space-y-6">{atual?.conteudo}</div>
    </div>
  )
}
