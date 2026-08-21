'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { consumirEntrada, ID_PALCO } from '@/lib/home-morph'
import type { HomeLayout } from '@/lib/supabase/types'

/**
 * O palco da home — o que a troca de layout anima.
 *
 * Existe por dois motivos, os dois de animação. O `key` no modo obriga o React
 * a jogar fora a árvore antiga quando o layout muda: sem isso ele reaproveita
 * os mesmos nós, e uma animação de entrada declarada em CSS não recomeça.
 * E o `data-entrada` liga a cascata só quando a pessoa acabou de trocar —
 * numa visita comum a home aparece de uma vez, como sempre apareceu.
 *
 * Fora da troca é uma `div` e nada mais: quem chega em `/home` normalmente não
 * paga nada por isto existir.
 */
export function HomePalco({
  modo,
  className,
  children,
}: {
  modo: HomeLayout
  className?: string
  children: React.ReactNode
}) {
  return (
    <Conteudo key={modo} modo={modo} className={className}>
      {children}
    </Conteudo>
  )
}

function Conteudo({
  modo,
  className,
  children,
}: {
  modo: HomeLayout
  className?: string
  children: React.ReactNode
}) {
  const [entrada, setEntrada] = useState<HomeLayout | null>(null)
  const jaLeu = useRef(false)

  // `useLayoutEffect` e não `useEffect`: a classe precisa estar no elemento
  // antes da primeira pintura, senão a página aparece inteira e só depois
  // começa a animar — que é pior do que não animar.
  useLayoutEffect(() => {
    if (jaLeu.current) return
    jaLeu.current = true
    const marca = consumirEntrada()
    if (marca === modo) setEntrada(marca)
  }, [modo])

  return (
    <div id={ID_PALCO} className={`home-palco ${className ?? ''}`} data-entrada={entrada ?? undefined}>
      {children}
    </div>
  )
}
