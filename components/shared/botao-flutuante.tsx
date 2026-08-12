'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** Chave para lembrar a posição escolhida. Uma por botão. */
  id: string
  children: ReactNode
}

type Posicao = { x: number; y: number }

/** Distância a partir da qual o gesto vira arrasto e não clique. */
const LIMIAR_ARRASTO = 6

/** Margem mínima até a borda, para o botão nunca sair da tela. */
const MARGEM = 8

/**
 * Botão que fica preso à TELA e pode ser arrastado para fora do caminho.
 *
 * Vai para `document.body` por portal porque `position: fixed` deixa de ser
 * relativo à janela quando qualquer ancestral tem `transform`, `filter` ou
 * `backdrop-filter` — e a página da célula tem. Sem o portal o botão rola
 * junto com o conteúdo e some no rodapé.
 *
 * A posição escolhida fica no `localStorage`: quem afastou o botão de uma
 * informação não quer fazer isso de novo a cada visita.
 */
export function BotaoFlutuante({ id, children }: Props) {
  const chave = `botao-flutuante:${id}`
  const [montado, setMontado] = useState(false)
  const [pos, setPos] = useState<Posicao | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ ponteiroX: number; ponteiroY: number; x: number; y: number } | null>(null)
  const moveu = useRef(false)

  /** Traz a posição de volta para dentro da tela atual. */
  function reencaixar(p: Posicao, el: HTMLDivElement) {
    const { width, height } = el.getBoundingClientRect()
    return {
      x: Math.min(Math.max(MARGEM, p.x), window.innerWidth - width - MARGEM),
      y: Math.min(Math.max(MARGEM, p.y), window.innerHeight - height - MARGEM),
    }
  }

  useEffect(() => {
    setMontado(true)
    try {
      const salvo = localStorage.getItem(chave)
      if (salvo) setPos(JSON.parse(salvo) as Posicao)
    } catch {
      /* localStorage bloqueado: fica na posição padrão */
    }
  }, [chave])

  // A posição salva pode ter vindo de uma tela maior (o celular de outra vez,
  // a janela redimensionada entre visitas) e apontar para fora da área
  // visível de hoje — o botão "some" porque está renderizado a 400px da
  // borda direita numa tela que só tem 380px. Reencaixa assim que o elemento
  // existe para medir, e de novo se a janela mudar de tamanho depois.
  useEffect(() => {
    if (!pos) return
    const el = ref.current
    if (!el) return
    const ajustada = reencaixar(pos, el)
    if (ajustada.x !== pos.x || ajustada.y !== pos.y) setPos(ajustada)
  }, [pos, montado])

  useEffect(() => {
    function aoRedimensionar() {
      const el = ref.current
      if (!el) return
      setPos((p) => (p ? reencaixar(p, el) : p))
    }
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [])

  function aoPressionar(e: React.PointerEvent) {
    const el = ref.current
    if (!el) return
    const caixa = el.getBoundingClientRect()
    inicio.current = { ponteiroX: e.clientX, ponteiroY: e.clientY, x: caixa.left, y: caixa.top }
    moveu.current = false
    el.setPointerCapture(e.pointerId)
  }

  function aoMover(e: React.PointerEvent) {
    const i = inicio.current
    const el = ref.current
    if (!i || !el) return

    const dx = e.clientX - i.ponteiroX
    const dy = e.clientY - i.ponteiroY

    // Só vira arrasto depois de um movimento mínimo — senão um toque trêmulo
    // no celular engoliria o clique.
    if (!moveu.current && Math.hypot(dx, dy) < LIMIAR_ARRASTO) return
    moveu.current = true
    setArrastando(true)

    const { width, height } = el.getBoundingClientRect()
    setPos({
      x: Math.max(MARGEM, Math.min(i.x + dx, window.innerWidth - width - MARGEM)),
      y: Math.max(MARGEM, Math.min(i.y + dy, window.innerHeight - height - MARGEM)),
    })
  }

  function aoSoltar(e: React.PointerEvent) {
    ref.current?.releasePointerCapture(e.pointerId)
    inicio.current = null
    setArrastando(false)

    if (moveu.current && pos) {
      try {
        localStorage.setItem(chave, JSON.stringify(pos))
      } catch {
        /* sem localStorage a posição vale só nesta sessão */
      }
    }
  }

  if (!montado) return null

  return createPortal(
    <div
      ref={ref}
      onPointerDown={aoPressionar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      // Um arrasto que terminou não pode virar clique no botão de dentro.
      onClickCapture={(e) => {
        if (moveu.current) {
          e.preventDefault()
          e.stopPropagation()
          moveu.current = false
        }
      }}
      style={
        pos
          ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
          : { right: 16, bottom: 88 }
      }
      className={`fixed z-40 touch-none ${arrastando ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      {children}
    </div>,
    document.body
  )
}
