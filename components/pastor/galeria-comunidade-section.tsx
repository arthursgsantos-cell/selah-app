'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Lightbox } from '@/components/shared/lightbox'
import { uploadFotoComunidadeAction, deleteFotoComunidadeAction } from '@/app/actions/fotos-comunidade'
import { Button } from '@/components/ui/button'
import { ChevronRight, ImagePlus, Images, X, Loader2 } from 'lucide-react'

type FotoGaleria = { id: string; url: string; criado_em: string; celula?: string | null; rede?: string | null }
interface Props {
  fotosInit: FotoGaleria[]
}

/**
 * Só foto que alguém subiu.
 *
 * O card do encontro entrava aqui junto com as fotos. É arte de divulgação, e
 * no mural da comunidade lia como cartaz no meio do álbum — além de não poder
 * ser apagado por este painel, o que fazia metade das imagens não ter o botão
 * de excluir. Ver `components/celula/galeria-celula-tab.tsx`.
 */
type ItemGrid = { id: string; url: string; criado_em: string; celula?: string | null; rede?: string | null }

async function comprimirImagem(file: File, maxPx = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objUrl)
        if (!blob) { reject(new Error('Compressão falhou')); return }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Erro ao ler imagem')) }
    img.src = objUrl
  })
}

export function GaleriaComunidadeSection({ fotosInit }: Props) {
  const [fotos, setFotos] = useState<FotoGaleria[]>(fotosInit)
  const [uploading, setUploading] = useState(false)
  const [progresso, setProgresso] = useState<{ preview: string; done: boolean }[]>([])
  const [ampliada, setAmpliada] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    e.target.value = ''

    const previews = files.map((f) => ({ preview: URL.createObjectURL(f), done: false }))
    setProgresso(previews)
    setUploading(true)

    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await comprimirImagem(files[i])
        const fd = new FormData()
        fd.append('file', compressed)
        const { id, url } = await uploadFotoComunidadeAction(fd)
        const criado_em = new Date().toISOString()
        setFotos((prev) => [{ id, url, criado_em }, ...prev])
      } catch (err) {
        console.error('Erro ao enviar foto:', err)
      } finally {
        setProgresso((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, done: true } : p))
        )
      }
    }

    previews.forEach((p) => URL.revokeObjectURL(p.preview))
    setProgresso([])
    setUploading(false)
  }

  async function handleDelete(foto: FotoGaleria) {
    setFotos((prev) => prev.filter((f) => f.id !== foto.id))
    try {
      await deleteFotoComunidadeAction(foto.id, foto.url)
    } catch {
      setFotos((prev) => [...prev, foto].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()))
    }
  }

  // Mais recentes primeiro.
  const grid: ItemGrid[] = [...fotos].sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
  )

  // O painel é um resumo: seis fotos dão o pulso da semana sem virar um mural
  // de rolagem infinita. O acervo inteiro, separado por rede e célula, fica em
  // /galeria.
  const visiveis = grid.slice(0, 6)

  const semFotos = grid.length === 0 && progresso.length === 0

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Fotos da comunidade
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? 'Enviando...' : 'Adicionar'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>

      {semFotos ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-border p-8 text-center hover:bg-muted/40 transition-colors"
        >
          <ImagePlus className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma foto ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique para adicionar fotos — elas aparecem na página inicial
          </p>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {progresso.map((p, i) => (
            <div key={`prog-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className={`h-full w-full object-cover transition-opacity ${p.done ? 'opacity-100' : 'opacity-40'}`} />
              {!p.done && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          ))}
          {visiveis.map((item, i) => (
            <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden group">
              <button
                type="button"
                onClick={() => setAmpliada(i)}
                aria-label="Ver foto ampliada"
                className="block h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </button>
              <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
            </div>
          ))}
        </div>
      )}

      {grid.length > visiveis.length && (
        <Link
          href="/galeria"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Images className="h-4 w-4 text-muted-foreground" />
          Ver todas as {grid.length} fotos
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <p className="text-[10px] text-muted-foreground mt-2 px-0.5">
        Imagens são comprimidas automaticamente. Máximo 1200px, formato JPEG.
      </p>

      <Lightbox
        fotos={visiveis.map((item) => ({
          url: item.url,
          celula: item.celula ?? null,
          rede: item.rede ?? null,
          data: item.criado_em,
        }))}
        indice={ampliada}
        onFechar={() => setAmpliada(null)}
      />
    </section>
  )
}
