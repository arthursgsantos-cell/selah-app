'use client'

import { useState, useTransition } from 'react'
import { Images } from 'lucide-react'

interface Props {
  ativoInicial: boolean
  opacidadeInicial: number
  /** Quantas fotos existem — sem nenhuma, o controle explica em vez de mentir. */
  totalFotos: number
  salvar: (ativo: boolean, opacidade: number) => Promise<void>
}

/**
 * Liga/desliga a galeria no fundo e ajusta só a transparência dela.
 *
 * Fica separado dos controles de cor porque a galeria é uma camada a mais: ela
 * convive com a cor, o degradê ou a nébula escolhidos ali em cima.
 */
export function FundoGaleriaControle({
  ativoInicial,
  opacidadeInicial,
  totalFotos,
  salvar,
}: Props) {
  const [ativo, setAtivo] = useState(ativoInicial)
  const [opacidade, setOpacidade] = useState(opacidadeInicial)
  const [isPending, startTransition] = useTransition()

  function aplicar(novoAtivo: boolean, novaOpacidade: number) {
    setAtivo(novoAtivo)
    setOpacidade(novaOpacidade)
    startTransition(async () => {
      try {
        await salvar(novoAtivo, novaOpacidade)
      } catch {
        /* estado otimista; recarregar restaura o valor real */
      }
    })
  }

  return (
    <div className="space-y-1.5 border-t border-border pt-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={ativo}
          disabled={isPending}
          onChange={(e) => aplicar(e.target.checked, opacidade)}
          className="h-3.5 w-3.5 accent-primary"
        />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <Images className="h-3.5 w-3.5 text-muted-foreground" />
          Fotos no fundo
        </span>
      </label>

      {totalFotos === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Ainda não há fotos aqui. Quando houver, elas aparecem em cascata no fundo.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {totalFotos} {totalFotos === 1 ? 'foto' : 'fotos'} em cascata, da mais recente para a mais antiga.
        </p>
      )}

      {ativo && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Transparência das fotos</p>
            <span className="text-xs text-muted-foreground tabular-nums">{opacidade}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={opacidade}
            onChange={(e) => setOpacidade(Number(e.target.value))}
            onMouseUp={(e) => aplicar(ativo, Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => aplicar(ativo, Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => aplicar(ativo, Number((e.target as HTMLInputElement).value))}
            disabled={isPending}
            className="w-full accent-primary"
          />
        </div>
      )}
    </div>
  )
}
