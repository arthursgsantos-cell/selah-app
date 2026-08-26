'use client'

import { ImagePlus, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { comprimirImagem } from '@/lib/comprimir-imagem'

/**
 * Os dois retratos de um evento, lado a lado no formulário:
 *
 * - o **card** (`imagem_url`) é o vertical que circula no WhatsApp e ilustra as
 *   listagens;
 * - a **capa** (`capa_pagina_url`) é o horizontal do topo da página do evento.
 *
 * Ficam juntos de propósito: separados, ninguém descobria que a capa existia —
 * ela só podia ser trocada dentro da própria página do evento.
 */

/** Um slot no formulário: arquivo novo, o que exibir, e se apagaram o que havia. */
export interface SlotImagem {
  file: File | null
  preview: string | null
  removida: boolean
}

export function slotImagem(url: string | null = null): SlotImagem {
  return { file: null, preview: url, removida: false }
}

/**
 * Devolve a URL que deve ser gravada no banco, subindo o arquivo novo quando
 * houver.
 *
 * A compressão não é enfeite: o corpo de uma Server Action tem teto de 1 MB e
 * foto de celular passa disso com folga — sem ela o upload falha, o formulário
 * volta ao estado anterior e parece que "não fez nada". Arquivo já pequeno vai
 * intacto, para não achatar um GIF animado à toa.
 */
export async function resolverImagem(
  slot: SlotImagem,
  atual: string | null,
  upload: (fd: FormData) => Promise<string>
): Promise<string | null> {
  if (slot.file) {
    const fd = new FormData()
    fd.append('file', slot.file.size > 700_000 ? await comprimirImagem(slot.file) : slot.file)
    return upload(fd)
  }
  return slot.removida ? null : atual
}

interface Props {
  /** Prefixo dos `id` dos inputs — dois formulários podem coexistir na página. */
  idPrefixo: string
  card: SlotImagem
  capa: SlotImagem
  onCardChange: (slot: SlotImagem) => void
  onCapaChange: (slot: SlotImagem) => void
}

export function ImagensEventoFields({
  idPrefixo,
  card,
  capa,
  onCardChange,
  onCapaChange,
}: Props) {
  return (
    <div className="space-y-1.5">
      <Label>Imagens do evento (opcional)</Label>
      <div className="flex gap-3">
        <Slot
          id={`${idPrefixo}-card`}
          slot={card}
          onChange={onCardChange}
          legenda="Card vertical"
          wrapperClassName="w-24 shrink-0"
          boxClassName="aspect-[4/5]"
        />
        <Slot
          id={`${idPrefixo}-capa`}
          slot={capa}
          onChange={onCapaChange}
          legenda="Capa horizontal"
          wrapperClassName="flex-1 min-w-0"
          boxClassName="aspect-video"
        />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        O card circula no WhatsApp e nas listagens. A capa fica no topo da página do
        evento — sem ela, o card faz as vezes. JPG, PNG ou WebP.
      </p>
    </div>
  )
}

interface SlotProps {
  id: string
  slot: SlotImagem
  onChange: (slot: SlotImagem) => void
  legenda: string
  wrapperClassName: string
  boxClassName: string
}

function Slot({ id, slot, onChange, legenda, wrapperClassName, boxClassName }: SlotProps) {
  function selecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    liberar(slot.preview)
    onChange({ file, preview: URL.createObjectURL(file), removida: false })
    // Permite reescolher o mesmo arquivo depois de remover.
    e.target.value = ''
  }

  function remover(e: React.MouseEvent) {
    e.preventDefault()
    liberar(slot.preview)
    onChange({ file: null, preview: null, removida: true })
  }

  return (
    <div className={`space-y-1 ${wrapperClassName}`}>
      <label
        htmlFor={id}
        className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-input bg-muted/30 cursor-pointer transition-colors hover:bg-accent/30 ${boxClassName}`}
      >
        {slot.preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.preview}
              alt="Pré-visualização"
              /* `contain` de propósito: aqui o que importa é conferir a imagem
                 inteira, não simular o corte da listagem. */
              className="absolute inset-0 h-full w-full object-contain"
            />
            <button
              type="button"
              onClick={remover}
              className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="pointer-events-none flex flex-col items-center gap-1 px-1 text-center text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px] leading-tight">Clique para importar</span>
          </div>
        )}
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={selecionar}
        />
      </label>
      <p className="text-center text-[10px] text-muted-foreground">{legenda}</p>
    </div>
  )
}

function liberar(url: string | null) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}
