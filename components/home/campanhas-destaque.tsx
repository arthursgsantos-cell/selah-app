'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Play } from 'lucide-react'
import { centavosTexto } from '@/lib/campanhas'

export interface CampanhaDestaque {
  id: string
  nome: string
  descricao: string | null
  centavos: number
  imagem_url: string | null
  video_url: string | null
}

/**
 * As campanhas em destaque na tela inicial.
 *
 * O card usa 16:9 fixo: a imagem que a igreja produz para divulgar já nasce
 * nessa proporção (é a do banner, do story em paisagem, do slide do telão), e
 * deixar a altura livre fazia cada campanha aparecer de um tamanho, com corte
 * diferente do que o designer enquadrou.
 *
 * Com mais de uma campanha vira carrossel em vez de empilhar: a home não pode
 * virar mural de arrecadação, e a segunda campanha empurraria célula e eventos
 * para fora da primeira tela.
 */
export function CampanhasDestaque({ campanhas }: { campanhas: CampanhaDestaque[] }) {
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [atual, setAtual] = useState(0)

  if (campanhas.length === 0) return null
  if (campanhas.length === 1) return <Card campanha={campanhas[0]} />

  /** Qual card está no centro da janela agora — alimenta as bolinhas. */
  function aoRolar() {
    const trilho = trilhoRef.current
    if (!trilho) return
    const largura = trilho.clientWidth
    if (largura === 0) return
    setAtual(Math.round(trilho.scrollLeft / largura))
  }

  function irPara(i: number) {
    const trilho = trilhoRef.current
    if (!trilho) return
    // Salto seco, sem `behavior: 'smooth'`: com encaixe obrigatório o Chrome
    // cancela a rolagem suave no meio e o carrossel não sai do lugar. Testado
    // — o encaixe já dá a sensação de gesto intencional.
    trilho.scrollTo({ left: i * trilho.clientWidth })
    // A bolinha muda aqui, e não só no `onScroll`: a rolagem por código nem
    // sempre dispara o evento, e o ponteiro ficava marcando o card errado.
    setAtual(i)
  }

  return (
    <div className="space-y-2">
      <div
        ref={trilhoRef}
        onScroll={aoRolar}
        // Sem `scroll-smooth` no CSS: combinado com o encaixe obrigatório, o
        // Chrome cancelava a rolagem que as bolinhas pedem e o carrossel ficava
        // parado. A suavidade vem do `scrollTo` abaixo, que funciona.
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {campanhas.map((c) => (
          <div key={c.id} className="w-full shrink-0 snap-center px-0.5">
            <Card campanha={c} />
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-1.5">
        {campanhas.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => irPara(i)}
            aria-label={`Ver ${c.nome}`}
            className={`h-1.5 rounded-full transition-all ${
              i === atual ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function Card({ campanha }: { campanha: CampanhaDestaque }) {
  return (
    <Link
      href="/contribuir"
      className="block overflow-hidden rounded-2xl bg-card shadow-sm transition-opacity hover:opacity-95"
    >
      {campanha.imagem_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={campanha.imagem_url}
          alt=""
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
            Campanha
          </p>
          <h2 className="mt-0.5 text-sm font-semibold leading-snug">{campanha.nome}</h2>
          {campanha.descricao && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {campanha.descricao}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 tabular-nums">
              termina em {centavosTexto(campanha.centavos)}
            </span>
            {campanha.video_url && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Play className="h-2.5 w-2.5" /> vídeo
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  )
}
