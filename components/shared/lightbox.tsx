'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type FotoLightbox = {
  url: string
  legenda?: string | null
  /** Nome da célula, para a marca d'água. */
  celula?: string | null
  /** Nome da rede a que a célula pertence. */
  rede?: string | null
  /** ISO da data em que a foto foi publicada. */
  data?: string | null
}

interface Props {
  fotos: FotoLightbox[]
  /** Índice da foto clicada. `null` mantém o visualizador fechado. */
  indice: number | null
  onFechar: () => void
  /** Entrada e trocas com movimento. Usado na galeria da comunidade. */
  animado?: boolean
  /** Controle extra na barra de baixo — ex.: o "Curtir" da galeria da célula. */
  acao?: (foto: FotoLightbox, indice: number) => ReactNode
}

/** Distância mínima, em px, para um arrasto contar como troca de foto. */
const ARRASTO_MINIMO = 50

/** Retângulo da imagem renderizada, relativo à área que a contém. */
type CaixaFoto = { left: number; width: number; bottom: number }

/**
 * Assinatura da foto: célula, rede e data, sobre a própria imagem.
 *
 * A posição vem medida da imagem, não da área: com `object-contain`, uma foto
 * em retrato numa tela larga deixa faixas vazias dos lados, e uma marca presa
 * à área flutuaria fora da foto.
 *
 * O gradiente é o que garante leitura — sem ele, texto branco sobre foto clara
 * desaparece.
 */
function MarcaDagua({ foto, caixa }: { foto: FotoLightbox; caixa: CaixaFoto | null }) {
  const temTexto = foto.celula || foto.rede || foto.data
  if (!temTexto || !caixa) return null

  return (
    <div
      style={{ left: caixa.left, width: caixa.width, bottom: caixa.bottom }}
      className="pointer-events-none absolute rounded-b-lg bg-gradient-to-t from-black/70 via-black/35 to-transparent px-4 pb-3 pt-10"
    >
      {foto.rede && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 drop-shadow">
          Rede {foto.rede}
        </p>
      )}
      {foto.celula && (
        <p className="text-lg font-bold leading-tight text-white drop-shadow-lg">
          {foto.celula}
        </p>
      )}
      {foto.data && (
        <p className="mt-0.5 text-xs text-white/75 drop-shadow">
          {format(new Date(foto.data), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      )}
    </div>
  )
}

/**
 * Visualizador de fotos em tela cheia.
 *
 * Abre na foto clicada e deixa percorrer as outras — por seta, clique, tira de
 * miniaturas ou arrasto no celular. O fundo escuro com desfoque tira a página
 * de cena e deixa a foto ser o assunto.
 */
export function Lightbox({ fotos, indice, onFechar, animado = false, acao }: Props) {
  const [atual, setAtual] = useState(0)
  const [montado, setMontado] = useState(false)
  /** Lado de onde a próxima foto entra: 1 = veio da direita, -1 = da esquerda. */
  const [direcao, setDirecao] = useState(0)
  const [caixaFoto, setCaixaFoto] = useState<CaixaFoto | null>(null)
  const toqueX = useRef<number | null>(null)
  const tiraRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  /** Mede onde a imagem caiu dentro da área, para ancorar a marca d'água. */
  const medirFoto = useCallback(() => {
    const img = imgRef.current
    const area = areaRef.current
    if (!img || !area) return
    const ri = img.getBoundingClientRect()
    const ra = area.getBoundingClientRect()
    setCaixaFoto({
      left: ri.left - ra.left,
      width: ri.width,
      bottom: ra.bottom - ri.bottom,
    })
  }, [])

  // A imagem muda de tamanho ao trocar de foto e ao girar o celular.
  useEffect(() => {
    window.addEventListener('resize', medirFoto)
    return () => window.removeEventListener('resize', medirFoto)
  }, [medirFoto])

  useEffect(() => setMontado(true), [])
  useEffect(() => {
    if (indice !== null) {
      setAtual(indice)
      setDirecao(0)
    }
  }, [indice])

  const aberto = indice !== null && fotos.length > 0
  const total = fotos.length

  const irPara = useCallback(
    (passo: number) => {
      setDirecao(passo)
      // Circular: da última volta para a primeira, e vice-versa.
      setAtual((i) => (i + passo + total) % total)
    },
    [total]
  )

  // Teclado: Esc fecha, setas navegam.
  useEffect(() => {
    if (!aberto) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
      if (e.key === 'ArrowRight') irPara(1)
      if (e.key === 'ArrowLeft') irPara(-1)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto, irPara, onFechar])

  // Trava o scroll do fundo enquanto o visualizador está aberto.
  useEffect(() => {
    if (!aberto) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [aberto])

  // Mantém a miniatura atual visível ao navegar pelas setas.
  useEffect(() => {
    if (!aberto) return
    tiraRef.current
      ?.querySelector(`[data-indice="${atual}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [atual, aberto])

  if (!aberto || !montado) return null

  const foto = fotos[atual]

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de fotos"
      onTouchStart={(e) => { toqueX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (toqueX.current === null) return
        const dx = e.changedTouches[0].clientX - toqueX.current
        if (Math.abs(dx) > ARRASTO_MINIMO) irPara(dx > 0 ? -1 : 1)
        toqueX.current = null
      }}
    >
      {/* Barra superior */}
      <div className="flex shrink-0 items-center justify-between gap-3 p-4">
        <span className="text-xs font-medium text-white/70 tabular-nums">
          {total > 1 ? `${atual + 1} / ${total}` : ''}
        </span>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:bg-white/90 active:scale-95"
        >
          <X className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>

      {/* Foto — clicar fora dela fecha.
          `min-h-0` é essencial: sem ele o `flex-1` não encolhe abaixo da altura
          natural da imagem, o `max-h-full` não limita nada e a foto vaza para
          fora da caixa, por cima do resto da página. */}
      <div
        ref={areaRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4"
        onClick={onFechar}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          // A key muda a cada foto: remonta o elemento e reinicia a animação.
          key={`${foto.url}-${atual}`}
          ref={imgRef}
          src={foto.url}
          alt={foto.legenda ?? ''}
          onLoad={medirFoto}
          onClick={(e) => e.stopPropagation()}
          className={`max-h-full max-w-full rounded-lg object-contain shadow-2xl ${
            animado
              ? direcao === 0
                ? 'animate-[lightbox-entrada_.45s_cubic-bezier(.2,.9,.3,1.3)]'
                : direcao > 0
                  ? 'animate-[lightbox-da-direita_.4s_cubic-bezier(.2,.9,.3,1.2)]'
                  : 'animate-[lightbox-da-esquerda_.4s_cubic-bezier(.2,.9,.3,1.2)]'
              : ''
          }`}
        />

        <MarcaDagua foto={foto} caixa={caixaFoto} />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); irPara(-1) }}
              aria-label="Foto anterior"
              className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); irPara(1) }}
              aria-label="Próxima foto"
              className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {acao && (
        <div className="flex shrink-0 justify-center px-4 pb-1">{acao(foto, atual)}</div>
      )}

      {foto.legenda && (
        <p className="px-6 pb-2 text-center text-sm text-white/80">{foto.legenda}</p>
      )}

      {/* Tira de miniaturas */}
      {total > 1 && (
        <div ref={tiraRef} className="flex gap-2 overflow-x-auto px-4 pb-5 pt-2">
          {fotos.map((f, i) => (
            <button
              key={`${f.url}-${i}`}
              type="button"
              data-indice={i}
              onClick={() => setAtual(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === atual}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg transition ${
                i === atual
                  ? 'ring-2 ring-white'
                  : 'opacity-50 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
