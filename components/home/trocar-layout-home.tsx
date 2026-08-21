'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { LayoutGrid, LayoutTemplate, Loader2 } from 'lucide-react'
import { definirHomeLayoutAction } from '@/app/actions/home-layout'
import { animarSaidaHome } from '@/lib/home-morph'
import { MiniaturaLayout } from '@/components/home/miniatura-layout'
import type { HomeLayout } from '@/lib/supabase/types'

export const NOME_LAYOUT: Record<HomeLayout, string> = {
  landing: 'Home completa',
  icones: 'Modo Ícones',
}

export const RESUMO_LAYOUT: Record<HomeLayout, string> = {
  landing: 'A página da igreja por inteiro: destaques, eventos, ensino, células, aniversariantes e fotos.',
  icones: 'Uma grade de atalhos, direto ao ponto. Bom para quem abre o app para chegar a algum lugar.',
}

/**
 * Trocar de layout, com o gesto junto.
 *
 * Salvar é uma linha; o resto daqui é a coreografia: anima a saída da home
 * atual, grava, e cobre com um véu o vão entre a página velha e a nova. O véu
 * some sozinho — ele mora dentro do palco, e o palco é jogado fora quando a
 * home nova chega.
 *
 * `comVeu: false` é para quem troca de fora da home (Meu perfil): lá não há
 * palco para animar nem página nova chegando, então o botão só mostra que
 * salvou. `animar: false` é para confirmar o layout que já está na tela — o
 * convite gravando "Home completa" para quem está justamente olhando a Home
 * completa não tem por que sumir e voltar.
 */
export function useTrocaLayout() {
  const router = useRouter()
  const [trocandoPara, setTrocandoPara] = useState<HomeLayout | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const trocar = useCallback(
    async (destino: HomeLayout, opcoes?: { comVeu?: boolean; animar?: boolean }) => {
      const comVeu = opcoes?.comVeu ?? true
      const animar = opcoes?.animar ?? true
      setErro(null)
      setTrocandoPara(destino)
      try {
        if (animar) await animarSaidaHome(destino)
        await definirHomeLayoutAction(destino)
        router.refresh()
        if (!comVeu) setTrocandoPara(null)
      } catch {
        setErro('Não deu para salvar agora. Tente de novo.')
        setTrocandoPara(null)
        // A home já tinha começado a sair de cena; sem a página nova para
        // ocupar o lugar, o jeito honesto de desfazer é recarregar.
        router.refresh()
      }
    },
    [router]
  )

  return { trocar, trocandoPara, erro }
}

/**
 * O botão que leva de um layout ao outro.
 *
 * Na primeira versão era um `⚙️ Layout` flutuando no canto inferior direito de
 * toda a home, por cima do conteúdo. Aqui ele fecha a grade de ícones, que é
 * onde a pergunta "e se eu quiser ver a página completa?" aparece; o caminho
 * permanente da troca é Meu perfil → Aparência.
 */
export function TrocarLayoutHome({ destino }: { destino: HomeLayout }) {
  const { trocar, trocandoPara, erro } = useTrocaLayout()
  const Icone = destino === 'landing' ? LayoutTemplate : LayoutGrid

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => trocar(destino)}
        disabled={trocandoPara !== null}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
      >
        {trocandoPara ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icone className="h-4 w-4" />}
        Ver a {NOME_LAYOUT[destino]}
      </button>
      <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground/70">
        Dá para mudar quando quiser em Meu perfil → Aparência.
      </p>
      {erro && <p className="mt-2 text-center text-xs text-destructive">{erro}</p>}
      {trocandoPara && <VeuTroca destino={trocandoPara} />}
    </div>
  )
}

/**
 * O véu da troca.
 *
 * Entre a saída da home velha e a chegada da nova existe uma ida ao servidor.
 * Sem nada ali, a tela fica em branco por meio segundo e a animação vira um
 * defeito. O véu mostra para onde a pessoa está indo — a mesma miniatura do
 * convite e da tela de Aparência.
 *
 * Vai por portal para não ser arrastado pela animação de saída: ele é
 * justamente o que precisa ficar parado enquanto tudo se mexe.
 */
export function VeuTroca({ destino }: { destino: HomeLayout }) {
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  if (!montado) return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="home-veu fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="w-48 text-center">
        <div className="home-veu-miniatura">
          <MiniaturaLayout modo={destino} />
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm font-medium">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Montando sua home
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{NOME_LAYOUT[destino]}</p>
      </div>
    </div>,
    document.body
  )
}
