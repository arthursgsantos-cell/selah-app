'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Images, Loader2, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Lightbox } from '@/components/shared/lightbox'
import { comprimirImagem } from '@/lib/comprimir-imagem'
import { publicarFotoAulaAction, removerFotoAulaAction } from '@/app/actions/ensino/registro'

export interface FotoRegistro {
  id: string
  url: string
  legenda: string | null
  criadoEm: string
  /** Número e nome da aula, quando a foto está amarrada a uma. */
  aulaNumero: number | null
  aulaTitulo: string | null
  /** Data da aula — é ela que vira a tag, não a data do upload. */
  aulaData: string | null
}

interface Props {
  turmaId: string
  turmaNome: string
  cursoNome: string
  fotos: FotoRegistro[]
  aulas: { id: string; numero: number; titulo: string; data: string | null }[]
  canEdit: boolean
}

/**
 * Registro da turma — a memória de que ela aconteceu.
 *
 * Mesma mecânica da galeria da comunidade: grade quadrada, ampliação com
 * animação e a assinatura sobre a foto. O que muda é a assinatura, que aqui
 * traz curso, turma e data em vez de rede e célula.
 *
 * A data da tag é a da AULA, não a do envio: a foto do primeiro encontro
 * subida três semanas depois continua sendo do primeiro encontro.
 */
export function RegistroAulas({
  turmaId, turmaNome, cursoNome, fotos, aulas, canEdit,
}: Props) {
  const router = useRouter()
  const [ampliada, setAmpliada] = useState<number | null>(null)
  const [aulaId, setAulaId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()
  const arquivoRef = useRef<HTMLInputElement>(null)

  function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (escolhidos.length === 0) return

    setErro(null)
    iniciar(async () => {
      for (const arquivo of escolhidos) {
        const fd = new FormData()
        // Comprimir antes de enviar: o corpo de uma Server Action tem teto de
        // 1 MB, e foto de celular passa disso com folga.
        fd.append('file', await comprimirImagem(arquivo))
        if (aulaId) fd.append('aulaId', aulaId)
        const r = await publicarFotoAulaAction(turmaId, fd)
        if (!r.ok) { setErro(r.erro); break }
      }
      router.refresh()
    })
  }

  function remover(foto: FotoRegistro) {
    if (!confirm('Remover esta foto do registro?')) return
    iniciar(async () => {
      const r = await removerFotoAulaAction(foto.id)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  /** "Aula 3 · 25/08" ou só a data, quando a foto é da turma toda. */
  function etiqueta(f: FotoRegistro): string {
    const data = f.aulaData ?? f.criadoEm
    const quando = format(parseISO(data), 'dd/MM/yyyy', { locale: ptBR })
    return f.aulaNumero ? `Aula ${f.aulaNumero} · ${quando}` : quando
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Images className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Registro</h2>
          {fotos.length > 0 && (
            <span className="text-xs text-muted-foreground">{fotos.length}</span>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {aulas.length > 0 && (
              <select
                value={aulaId}
                onChange={(e) => setAulaId(e.target.value)}
                aria-label="Aula da foto"
                className="h-8 max-w-[10rem] rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
              >
                <option value="">Sem aula</option>
                {aulas.map((a) => (
                  <option key={a.id} value={a.id}>Aula {a.numero}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {enviando ? 'Enviando…' : 'Adicionar fotos'}
            </button>
            <input
              ref={arquivoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={enviar}
            />
          </div>
        )}
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {fotos.length === 0 ? (
        <div className="py-8 text-center">
          <Images className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma foto ainda</p>
          {canEdit && (
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground/70 leading-relaxed">
              A foto do encontro fica aqui, com o curso, a turma e a data —
              separada dos materiais de estudo.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
          {fotos.map((f, i) => (
            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              <button
                type="button"
                onClick={() => setAmpliada(i)}
                aria-label={`Ver foto — ${etiqueta(f)}`}
                className="h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[9px] font-medium text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                  {etiqueta(f)}
                </span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => remover(f)}
                  disabled={enviando}
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Lightbox
        fotos={fotos.map((f) => ({
          url: f.url,
          legenda: f.legenda,
          // As tags pedidas: curso em cima, turma em destaque, data embaixo.
          contexto: f.aulaTitulo ? `${cursoNome} · Aula ${f.aulaNumero}` : cursoNome,
          celula: turmaNome,
          data: f.aulaData ?? f.criadoEm,
        }))}
        indice={ampliada}
        onFechar={() => setAmpliada(null)}
        animado
      />
    </section>
  )
}
