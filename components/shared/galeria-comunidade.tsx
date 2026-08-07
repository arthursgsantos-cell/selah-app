'use client'

import { useMemo, useState } from 'react'
import { Images, Search, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Lightbox } from '@/components/shared/lightbox'

export type FotoComunidade = {
  id: string
  url: string
  criado_em: string
  celula: string | null
  rede: string | null
  /** Cor da rede, usada só como acento visual do agrupamento. */
  cor: string | null
}

/** Fotos avulsas da igreja (sem célula) caem aqui. */
const SEM_REDE = 'Igreja'

type GrupoCelula = { celula: string; fotos: FotoComunidade[] }
type GrupoRede = { rede: string; cor: string | null; total: number; celulas: GrupoCelula[] }

/**
 * Agrupa por rede e, dentro dela, por célula.
 *
 * A ordem de dentro é a que chegou (mais recente primeiro); a de fora é por
 * volume de fotos, para a rede mais ativa abrir a página. `Igreja` fica sempre
 * no fim: é o resto que não pertence a nenhuma célula.
 */
function agrupar(fotos: FotoComunidade[]): GrupoRede[] {
  const porRede = new Map<string, { cor: string | null; celulas: Map<string, FotoComunidade[]> }>()

  for (const foto of fotos) {
    const rede = foto.rede ?? SEM_REDE
    const celula = foto.celula ?? 'Sem célula'

    const grupo = porRede.get(rede) ?? { cor: foto.cor, celulas: new Map() }
    if (!grupo.cor && foto.cor) grupo.cor = foto.cor
    const lista = grupo.celulas.get(celula) ?? []
    lista.push(foto)
    grupo.celulas.set(celula, lista)
    porRede.set(rede, grupo)
  }

  return [...porRede.entries()]
    .map(([rede, grupo]) => ({
      rede,
      cor: grupo.cor,
      total: [...grupo.celulas.values()].reduce((acc, l) => acc + l.length, 0),
      celulas: [...grupo.celulas.entries()]
        .map(([celula, fotosCelula]) => ({ celula, fotos: fotosCelula }))
        .sort((a, b) => b.fotos.length - a.fotos.length),
    }))
    .sort((a, b) => {
      if (a.rede === SEM_REDE) return 1
      if (b.rede === SEM_REDE) return -1
      return b.total - a.total
    })
}

/**
 * Galeria completa da igreja, agrupada por rede e por célula.
 *
 * O lightbox recebe a lista já achatada na mesma ordem em que as fotos são
 * desenhadas — assim as setas passam de uma célula para a seguinte sem
 * saltos, em vez de recomeçar a contagem a cada grupo.
 */
export function GaleriaComunidade({ fotos }: { fotos: FotoComunidade[] }) {
  const [redeAtiva, setRedeAtiva] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [ampliada, setAmpliada] = useState<number | null>(null)

  const grupos = useMemo(() => agrupar(fotos), [fotos])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return grupos
      .filter((g) => !redeAtiva || g.rede === redeAtiva)
      .map((g) => ({
        ...g,
        celulas: termo
          ? g.celulas.filter(
              (c) => c.celula.toLowerCase().includes(termo) || g.rede.toLowerCase().includes(termo)
            )
          : g.celulas,
      }))
      .filter((g) => g.celulas.length > 0)
  }, [grupos, redeAtiva, busca])

  // Mesma ordem da tela: o índice do clique vale direto no lightbox.
  const achatadas = useMemo(
    () => visiveis.flatMap((g) => g.celulas.flatMap((c) => c.fotos)),
    [visiveis]
  )

  const totalVisivel = achatadas.length

  if (fotos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center">
        <Images className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhuma foto publicada ainda.</p>
      </div>
    )
  }

  let indiceGlobal = -1

  return (
    <div className="space-y-6">
      {/* Filtros: chip por rede + busca por célula */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          <Chip ativo={redeAtiva === null} onClick={() => setRedeAtiva(null)}>
            Todas · {fotos.length}
          </Chip>
          {grupos.map((g) => (
            <Chip
              key={g.rede}
              ativo={redeAtiva === g.rede}
              cor={g.cor}
              onClick={() => setRedeAtiva(redeAtiva === g.rede ? null : g.rede)}
            >
              {g.rede} · {g.total}
            </Chip>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar célula ou rede..."
            className="h-9 w-full rounded-xl border border-input bg-background pl-8 pr-8 text-sm outline-none focus-visible:border-ring"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {totalVisivel === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma foto para esse filtro.
        </p>
      ) : (
        visiveis.map((grupo) => (
          <section key={grupo.rede} className="space-y-3">
            {/* Cabeçalho da rede: a faixa de cor é o que separa um bloco do
                outro numa rolagem longa de fotos. */}
            <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-background/85 px-1 py-2 backdrop-blur-sm">
              <span
                className="h-4 w-1 shrink-0 rounded-full"
                style={{ background: grupo.cor ?? 'var(--color-primary, #0F52BA)' }}
              />
              <h2 className="text-sm font-bold">
                {grupo.rede === SEM_REDE ? 'Igreja' : `Rede ${grupo.rede}`}
              </h2>
              <span className="text-xs text-muted-foreground">
                {grupo.total} {grupo.total === 1 ? 'foto' : 'fotos'}
              </span>
            </div>

            <div className="space-y-4">
              {grupo.celulas.map((celula) => (
                <div key={`${grupo.rede}-${celula.celula}`} className="space-y-1.5">
                  <div className="flex items-baseline gap-2 px-0.5">
                    <p className="text-xs font-semibold text-foreground/80">{celula.celula}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {celula.fotos.length} {celula.fotos.length === 1 ? 'foto' : 'fotos'}
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {format(parseISO(celula.fotos[0].criado_em), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                    {celula.fotos.map((foto) => {
                      indiceGlobal += 1
                      const indice = indiceGlobal
                      return (
                        <button
                          key={foto.id}
                          type="button"
                          onClick={() => setAmpliada(indice)}
                          aria-label={`Ver foto de ${celula.celula}`}
                          className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={foto.url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <Lightbox
        fotos={achatadas.map((f) => ({
          url: f.url,
          celula: f.celula,
          rede: f.rede,
          data: f.criado_em,
        }))}
        indice={ampliada}
        onFechar={() => setAmpliada(null)}
        animado
      />
    </div>
  )
}

function Chip({
  children, ativo, cor, onClick,
}: {
  children: React.ReactNode
  ativo: boolean
  cor?: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        ativo
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-accent'
      }`}
    >
      {cor && !ativo && (
        <span className="h-2 w-2 rounded-full" style={{ background: cor }} />
      )}
      {children}
    </button>
  )
}
