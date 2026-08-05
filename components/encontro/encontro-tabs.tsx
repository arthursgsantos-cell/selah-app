'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Props {
  /** Informações + presença — o que se olha antes do encontro. */
  encontro: ReactNode
  /** Escala e lista de lanche — quem faz o quê. */
  programacao: ReactNode
  /** Fotos e compartilhamento — depois que aconteceu. */
  registro: ReactNode
  /** Contadores discretos ajudam a ver onde há coisa pendente. */
  totalEscalados: number
  totalLanches: number
  totalFotos: number
}

const triggerCls =
  'rounded-none border-b-2 border-transparent px-3 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[selected]:border-primary data-[selected]:text-foreground transition-colors'

export function EncontroTabs({
  encontro,
  programacao,
  registro,
  totalEscalados,
  totalLanches,
  totalFotos,
}: Props) {
  return (
    <Tabs defaultValue="encontro" className="flex-col">
      <div className="border-b border-border overflow-x-auto no-scrollbar">
        <TabsList variant="line" className="h-auto pb-0 gap-0 border-b-0 min-w-max">
          <TabsTrigger value="encontro" className={triggerCls}>
            Encontro
          </TabsTrigger>
          <TabsTrigger value="programacao" className={triggerCls}>
            Programação
            {totalEscalados + totalLanches > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                {totalEscalados + totalLanches}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="registro" className={triggerCls}>
            Registro
            {totalFotos > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                {totalFotos}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="encontro" className="mt-4 space-y-4">
        {encontro}
      </TabsContent>
      <TabsContent value="programacao" className="mt-4 space-y-4">
        {programacao}
      </TabsContent>
      <TabsContent value="registro" className="mt-4 space-y-4">
        {registro}
      </TabsContent>
    </Tabs>
  )
}
