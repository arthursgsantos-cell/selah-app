'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { uploadFotoCelulaAction, deleteFotoCelulaAction } from '@/app/actions/fotos-comunidade'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Heart, ImagePlus, Images, Loader2, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type UploadedPhoto = { id: string; url: string }
type EncontroPhoto = { id: string; url: string; data_hora: string }

type GalleryItem =
  | { kind: 'upload'; id: string; url: string; label?: undefined }
  | { kind: 'encontro'; id: string; url: string; label: string }

interface Props {
  celulaId: string
  fotosInit: UploadedPhoto[]
  encontroFotos: EncontroPhoto[]
  canUpload?: boolean
}

async function comprimirImagem(file: File, maxPx = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objUrl)
          if (!blob) { reject(new Error('Compressão falhou')); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Erro ao ler imagem')) }
    img.src = objUrl
  })
}

export function GaleriaCelulaTab({ celulaId, fotosInit, encontroFotos, canUpload = false }: Props) {
  const [fotosUpload, setFotosUpload] = useState<UploadedPhoto[]>(fotosInit)
  const [previews, setPreviews] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const allItems: GalleryItem[] = [
    ...fotosUpload.map((f): GalleryItem => ({ kind: 'upload', id: f.id, url: f.url })),
    ...encontroFotos.map((e): GalleryItem => ({
      kind: 'encontro',
      id: e.id,
      url: e.url,
      label: format(new Date(e.data_hora), "d 'de' MMM", { locale: ptBR }),
    })),
  ]

  const isEmpty = allItems.length === 0 && previews.length === 0
  const current = lightboxIdx !== null ? allItems[lightboxIdx] : null

  const closeLightbox = useCallback(() => setLightboxIdx(null), [])
  const gotoPrev = useCallback(() => setLightboxIdx((i) => (i === null ? null : (i - 1 + allItems.length) % allItems.length)), [allItems.length])
  const gotoNext = useCallback(() => setLightboxIdx((i) => (i === null ? null : (i + 1) % allItems.length)), [allItems.length])

  useEffect(() => {
    if (lightboxIdx === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') gotoPrev()
      if (e.key === 'ArrowRight') gotoNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIdx, closeLightbox, gotoPrev, gotoNext])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (lightboxIdx !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [lightboxIdx])

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    const objUrls = files.map((f) => URL.createObjectURL(f))
    setPreviews(objUrls)
    setIsUploading(true)
    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await comprimirImagem(files[i])
        const fd = new FormData()
        fd.append('file', compressed)
        const { id, url } = await uploadFotoCelulaAction(celulaId, fd)
        setFotosUpload((prev) => [{ id, url }, ...prev])
      } catch (err) {
        console.error(err)
      }
    }
    objUrls.forEach((u) => URL.revokeObjectURL(u))
    setPreviews([])
    setIsUploading(false)
  }

  async function handleDelete(id: string, url: string) {
    setFotosUpload((prev) => prev.filter((f) => f.id !== id))
    try { await deleteFotoCelulaAction(id, url) } catch { /* best-effort */ }
  }

  function toggleLike() {
    if (!current) return
    setLiked((prev) => {
      const next = new Set(prev)
      next.has(current.url) ? next.delete(current.url) : next.add(current.url)
      return next
    })
  }

  return (
    <>
      {/* Header with add button */}
      {canUpload && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {allItems.length > 0 ? `${allItems.length} foto${allItems.length !== 1 ? 's' : ''}` : 'Galeria'}
          </p>
          <Button size="sm" variant="outline" disabled={isUploading} onClick={() => fileRef.current?.click()}>
            {isUploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ImagePlus className="h-4 w-4" />}
            {isUploading ? 'Enviando...' : 'Adicionar'}
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
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="py-10 text-center">
          <Images className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma foto ainda</p>
          <p className="text-xs text-muted-foreground mt-1">As capas dos encontros e fotos adicionadas aparecem aqui</p>
          {canUpload && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-3 text-xs font-medium text-primary hover:underline"
            >
              Adicionar primeira foto
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {!isEmpty && (
        <div className="grid grid-cols-3 gap-1.5">
          {/* Upload previews */}
          {previews.map((src, i) => (
            <div key={`prev-${i}`} className="aspect-square rounded-xl overflow-hidden bg-muted relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover opacity-40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            </div>
          ))}

          {/* Gallery items */}
          {allItems.map((item, idx) => (
            <div key={item.kind + item.id} className="relative aspect-square rounded-xl overflow-hidden group">
              <button
                type="button"
                className="block w-full h-full"
                onClick={() => setLightboxIdx(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors rounded-xl" />
                {item.kind === 'encontro' && (
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white font-medium capitalize">{item.label}</p>
                  </div>
                )}
              </button>

              {/* Delete button (upload only) */}
              {item.kind === 'upload' && canUpload && (
                <button
                  type="button"
                  onClick={() => handleDelete(item.id, item.url)}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Liked indicator */}
              {liked.has(item.url) && (
                <div className="absolute bottom-1.5 left-1.5 pointer-events-none">
                  <Heart className="h-4 w-4 text-rose-500 fill-rose-500 drop-shadow" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && current && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none"
          onClick={closeLightbox}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-white/40 font-medium">
              {lightboxIdx + 1} / {allItems.length}
            </span>
            <button
              type="button"
              onClick={closeLightbox}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Image area */}
          <div
            className="flex-1 flex items-center justify-center px-12 min-h-0 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {allItems.length > 1 && (
              <button
                type="button"
                onClick={gotoPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.url}
              src={current.url}
              alt=""
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
              style={{ maxHeight: 'calc(100dvh - 148px)' }}
            />
            {allItems.length > 1 && (
              <button
                type="button"
                onClick={gotoNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Bottom bar */}
          <div
            className="shrink-0 flex items-center justify-center gap-3 px-4 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            {current.kind === 'encontro' && current.label && (
              <span className="text-xs text-white/50 capitalize">{current.label}</span>
            )}
            <button
              type="button"
              onClick={toggleLike}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-colors ${
                liked.has(current.url)
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Heart
                className={`h-5 w-5 transition-all ${liked.has(current.url) ? 'fill-rose-500 text-rose-500 scale-110' : ''}`}
              />
              <span className="text-sm font-medium">
                {liked.has(current.url) ? 'Curtido' : 'Curtir'}
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
