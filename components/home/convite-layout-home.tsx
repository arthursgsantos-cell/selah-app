'use client'

import { useState } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { MiniaturaLayout } from '@/components/home/miniatura-layout'
import {
  NOME_LAYOUT, RESUMO_LAYOUT, VeuTroca, useTrocaLayout,
} from '@/components/home/trocar-layout-home'
import type { HomeLayout } from '@/lib/supabase/types'

const OPCOES: HomeLayout[] = ['landing', 'icones']

/**
 * O convite que aparece uma vez, para quem ainda não escolheu como quer ver a
 * home.
 *
 * Aparece uma vez de verdade: fechar sem escolher grava a Home completa, que é
 * o que a pessoa já está vendo por baixo do convite. Deixar `home_layout` nulo
 * ao fechar faria o convite voltar em toda visita — que é o comportamento de
 * um anúncio, não de uma pergunta.
 *
 * A escolha continua reversível a qualquer momento em Meu perfil → Aparência;
 * o convite diz isso, porque é o que tira o peso de responder.
 */
export function ConviteLayoutHome({ primeiroNome }: { primeiroNome: string }) {
  const [aberto, setAberto] = useState(true)
  const [escolhido, setEscolhido] = useState<HomeLayout>('landing')
  const { trocar, trocandoPara, erro } = useTrocaLayout()

  const ocupado = trocandoPara !== null

  function confirmar(destino: HomeLayout) {
    setAberto(false)
    // O convite só nasce sobre a Home completa: escolher ela é confirmar o que
    // já está na tela, e aí não há transformação nenhuma para mostrar.
    const mudou = destino !== 'landing'
    void trocar(destino, { comVeu: mudou, animar: mudou })
  }

  return (
    <>
      <Dialog
        open={aberto}
        onOpenChange={(v) => {
          if (v || ocupado) return
          // Fechar é uma resposta: fica com a home que já está na tela.
          confirmar('landing')
        }}
      >
        <DialogContent className="max-w-[calc(100%-1.5rem)] p-5 sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg">
              {primeiroNome ? `${primeiroNome}, como você quer ver a Home?` : 'Como você quer ver a Home?'}
            </DialogTitle>
            <DialogDescription className="text-center leading-relaxed">
              Duas formas de abrir o app. Escolha uma — dá para trocar quando quiser.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2.5">
            {OPCOES.map((opcao) => {
              const ativo = escolhido === opcao
              return (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setEscolhido(opcao)}
                  aria-pressed={ativo}
                  className={`relative rounded-2xl border p-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    ativo
                      ? 'border-primary bg-primary/[0.04] shadow-md ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                  }`}
                >
                  <span
                    className={`absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200 ${
                      ativo ? 'scale-100 bg-primary text-primary-foreground' : 'scale-0 bg-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <MiniaturaLayout modo={opcao} />
                  <span className="mt-2 block text-sm font-semibold leading-tight">{NOME_LAYOUT[opcao]}</span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                    {RESUMO_LAYOUT[opcao]}
                  </span>
                </button>
              )
            })}
          </div>

          <Button size="lg" className="w-full" disabled={ocupado} onClick={() => confirmar(escolhido)}>
            {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Usar {NOME_LAYOUT[escolhido]}
          </Button>

          <p className="-mt-1 text-center text-[11px] leading-snug text-muted-foreground/80">
            Você muda depois em Meu perfil → Aparência.
          </p>
          {erro && <p className="text-center text-xs text-destructive">{erro}</p>}
        </DialogContent>
      </Dialog>

      {/* Fora do diálogo: quando o convite fecha, é o véu que segura a tela até
          a home escolhida chegar. */}
      {trocandoPara && <VeuTroca destino={trocandoPara} />}
    </>
  )
}
