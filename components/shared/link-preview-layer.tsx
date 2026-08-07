'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'

type Previa = {
  titulo: string | null
  descricao: string | null
  imagem: string | null
  site: string
}

type Alvo = { url: string; rect: DOMRect }

const ATRASO_ABRIR_MOUSE = 300
const ATRASO_FECHAR = 150
const ATRASO_SEGURAR_TOQUE = 450
/** Depois de soltar o dedo, a prévia some sozinha — não há "mouseleave" no toque. */
const ATRASO_FECHAR_TOQUE = 2500

/**
 * Envolve o texto da aula e liga os chips de link (`.link-chip`, ver
 * `lib/texto-rico.ts`) a um cartão de prévia — passar o mouse ou segurar o
 * dedo mostra ícone, título e resumo do destino, como o Google faz.
 *
 * Os links vêm de HTML injetado (`dangerouslySetInnerHTML`), não de
 * componentes React, então a escuta é por delegação: um listener no
 * container em vez de um por link. Isso também sobrevive a reabrir o modo
 * de edição, que troca o HTML de baixo.
 *
 * Recebe `html` pronto (e não `children`) porque o próprio container
 * precisa carregar `dangerouslySetInnerHTML` diretamente — um `<div>`
 * embrulhando o conteúdo quebraria as regras de espaçamento de
 * `.texto-rico > *:first-child` em `globals.css`. O cartão de prévia sai
 * por portal para `document.body`, então não conta como filho.
 */
export function LinkPreviewLayer({ html, className }: { html: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [alvo, setAlvo] = useState<Alvo | null>(null)
  const [dados, setDados] = useState<Previa | null>(null)
  const [carregando, setCarregando] = useState(false)

  const cache = useRef(new Map<string, Previa>())
  const abrirTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const segurarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suprimirClique = useRef(false)
  const pedidoAtual = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const linkDoEvento = (e: Event): HTMLAnchorElement | null => {
      const el = e.target as HTMLElement | null
      const a = el?.closest?.('a.link-chip') as HTMLAnchorElement | null
      return a && container.contains(a) ? a : null
    }

    const limparAbrirTimer = () => {
      if (abrirTimer.current) {
        clearTimeout(abrirTimer.current)
        abrirTimer.current = null
      }
    }
    const limparFecharTimer = () => {
      if (fecharTimer.current) {
        clearTimeout(fecharTimer.current)
        fecharTimer.current = null
      }
    }

    function abrirPara(a: HTMLAnchorElement) {
      limparFecharTimer()
      const url = a.href
      const pedido = ++pedidoAtual.current
      setAlvo({ url, rect: a.getBoundingClientRect() })

      const emCache = cache.current.get(url)
      if (emCache) {
        setDados(emCache)
        setCarregando(false)
        return
      }

      setDados(null)
      setCarregando(true)
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then((r) => (r.ok ? (r.json() as Promise<Previa>) : null))
        .then((json) => {
          if (!json || pedido !== pedidoAtual.current) return
          cache.current.set(url, json)
          setDados(json)
        })
        .catch(() => {})
        .finally(() => {
          if (pedido === pedidoAtual.current) setCarregando(false)
        })
    }

    function fechar() {
      pedidoAtual.current++
      setAlvo(null)
      setDados(null)
      setCarregando(false)
    }

    function onOver(e: MouseEvent) {
      const a = linkDoEvento(e)
      if (!a || a.contains(e.relatedTarget as Node)) return
      limparAbrirTimer()
      abrirTimer.current = setTimeout(() => abrirPara(a), ATRASO_ABRIR_MOUSE)
    }

    function onOut(e: MouseEvent) {
      const a = linkDoEvento(e)
      if (!a || a.contains(e.relatedTarget as Node)) return
      limparAbrirTimer()
      limparFecharTimer()
      fecharTimer.current = setTimeout(fechar, ATRASO_FECHAR)
    }

    function limparToque() {
      if (segurarTimer.current) {
        clearTimeout(segurarTimer.current)
        segurarTimer.current = null
      }
    }

    function onTouchStart(e: TouchEvent) {
      const a = linkDoEvento(e)
      if (!a) return
      limparToque()
      segurarTimer.current = setTimeout(() => {
        suprimirClique.current = true
        abrirPara(a)
      }, ATRASO_SEGURAR_TOQUE)
    }

    function onTouchEnd() {
      limparToque()
      if (!suprimirClique.current) return
      limparFecharTimer()
      fecharTimer.current = setTimeout(() => {
        fechar()
        suprimirClique.current = false
      }, ATRASO_FECHAR_TOQUE)
    }

    function onClickCapture(e: MouseEvent) {
      if (!suprimirClique.current) return
      e.preventDefault()
      suprimirClique.current = false
    }

    container.addEventListener('mouseover', onOver)
    container.addEventListener('mouseout', onOut)
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchend', onTouchEnd)
    container.addEventListener('touchmove', limparToque)
    container.addEventListener('click', onClickCapture, true)

    return () => {
      container.removeEventListener('mouseover', onOver)
      container.removeEventListener('mouseout', onOut)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchmove', limparToque)
      container.removeEventListener('click', onClickCapture, true)
      limparAbrirTimer()
      limparFecharTimer()
      limparToque()
    }
  }, [])

  function manterAberto() {
    if (fecharTimer.current) {
      clearTimeout(fecharTimer.current)
      fecharTimer.current = null
    }
  }
  function agendarFechar() {
    fecharTimer.current = setTimeout(() => {
      pedidoAtual.current++
      setAlvo(null)
      setDados(null)
    }, ATRASO_FECHAR)
  }

  return (
    <>
      <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />
      {alvo && (
        <PreviaCartao
          url={alvo.url}
          rect={alvo.rect}
          dados={dados}
          carregando={carregando}
          onMouseEnter={manterAberto}
          onMouseLeave={agendarFechar}
        />
      )}
    </>
  )
}

function calcularPosicao(rect: DOMRect) {
  const largura = 288
  const margem = 8
  let left = rect.left
  if (left + largura > window.innerWidth - margem) left = window.innerWidth - largura - margem
  if (left < margem) left = margem

  const espacoAbaixo = window.innerHeight - rect.bottom
  const acima = espacoAbaixo < 200 && rect.top > 200
  const top = acima ? rect.top - 8 : rect.bottom + 8
  return { top, left, acima, largura }
}

function PreviaCartao({
  url,
  rect,
  dados,
  carregando,
  onMouseEnter,
  onMouseLeave,
}: {
  url: string
  rect: DOMRect
  dados: Previa | null
  carregando: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  if (!montado) return null

  const pos = calcularPosicao(rect)
  const site = dados?.site ?? (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  })()

  return createPortal(
    <div
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.largura,
        transform: pos.acima ? 'translateY(-100%)' : undefined,
      }}
      className="z-[70] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 duration-100"
    >
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {carregando ? (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando prévia…
          </div>
        ) : (
          <>
            {dados?.imagem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dados.imagem} alt="" className="h-32 w-full object-cover" loading="lazy" />
            )}
            <div className="space-y-1 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?sz=32&domain=${site}`}
                  alt=""
                  className="h-3.5 w-3.5 rounded-sm"
                />
                {site}
              </div>
              <p className="line-clamp-2 text-sm font-medium leading-snug">{dados?.titulo || site}</p>
              {dados?.descricao && (
                <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{dados.descricao}</p>
              )}
            </div>
          </>
        )}
      </a>
    </div>,
    document.body
  )
}
