'use client'

import { useState, useTransition } from 'react'
import { Wand2 } from 'lucide-react'

interface Props {
  ativoInicial: boolean
  /** Sem capa não há de onde tirar cor; o controle explica em vez de mentir. */
  temCapa: boolean
  alternar: (ativo: boolean) => Promise<void>
}

/**
 * Liga/desliga as cores tiradas da capa da página.
 *
 * Ligado, os seletores de cor abaixo ficam desabilitados: quem manda é a capa,
 * e deixar os botões clicáveis sugeriria que a escolha manual sobrevive à
 * próxima troca de capa — não sobrevive.
 */
export function AutoCorControle({ ativoInicial, temCapa, alternar }: Props) {
  const [ativo, setAtivo] = useState(ativoInicial)
  const [isPending, startTransition] = useTransition()

  function aplicar(novo: boolean) {
    setAtivo(novo)
    startTransition(async () => {
      try {
        await alternar(novo)
      } catch {
        setAtivo(!novo)
      }
    })
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={ativo}
          disabled={isPending}
          onChange={(e) => aplicar(e.target.checked)}
          className="h-3.5 w-3.5 accent-primary"
        />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
          Cores da capa
        </span>
      </label>
      <p className="text-[11px] text-muted-foreground">
        {!temCapa
          ? 'Adicione uma capa para o fundo tirar as cores dela.'
          : ativo
            ? 'O fundo usa nébula com as cores da capa e se atualiza quando a capa muda.'
            : 'Cores escolhidas à mão abaixo.'}
      </p>
    </div>
  )
}
