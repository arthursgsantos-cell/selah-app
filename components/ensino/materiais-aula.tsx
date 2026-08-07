'use client'

import { useState } from 'react'
import {
  FileText, LinkIcon, Download, Eye, ExternalLink, Loader2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TipoMaterial } from '@/lib/supabase/types'

export interface MaterialAula {
  id: string
  titulo: string
  descricao: string | null
  tipo: TipoMaterial
  arquivoNome: string | null
  arquivoTamanho: number | null
}

/**
 * Formatos que o navegador desenha sozinho dentro de um `<iframe>`.
 *
 * `.docx` e `.pptx` não estão aqui de propósito: o visualizador abriria um
 * quadro em branco ou dispararia o download por baixo do pano, o que é pior do
 * que só oferecer "Baixar". Para esses, o cartão mostra apenas o download.
 */
const VISUALIZAVEIS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'txt', 'md']

function podeVerNoApp(nome: string | null): boolean {
  const ext = nome?.split('.').pop()?.toLowerCase()
  return ext !== undefined && VISUALIZAVEIS.includes(ext)
}

function tamanhoLegivel(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Materiais de uma aula.
 *
 * Documento abre num diálogo, sem sair da aula — quem está acompanhando a aula
 * perde o fio se o PDF sequestra a aba. Link externo, ao contrário, abre em
 * guia nova: ele leva para fora do app de qualquer jeito, e prender um site de
 * terceiro num iframe costuma dar tela branca (`X-Frame-Options`).
 *
 * Tudo passa por `/api/ensino/material/[id]`, inclusive os links: a policy
 * `ensino_materiais_select` continua sendo quem autoriza, e o endereço do Drive
 * não fica no HTML de quem não deveria vê-lo.
 */
export function MateriaisAula({ materiais }: { materiais: MaterialAula[] }) {
  const [aberto, setAberto] = useState<MaterialAula | null>(null)
  const [carregando, setCarregando] = useState(false)

  const arquivos = materiais.filter((m) => m.tipo === 'arquivo')
  const links = materiais.filter((m) => m.tipo !== 'arquivo')

  if (materiais.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum material nesta aula ainda.</p>
      </div>
    )
  }

  function abrir(material: MaterialAula) {
    setCarregando(true)
    setAberto(material)
  }

  return (
    <div className="space-y-3">
      {arquivos.length > 0 && (
        <div className="rounded-2xl border border-border bg-card divide-y overflow-hidden">
          {arquivos.map((m) => {
            const tamanho = tamanhoLegivel(m.arquivoTamanho)
            const verNoApp = podeVerNoApp(m.arquivoNome)

            return (
              <div key={m.id} className="flex items-center gap-3 px-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{m.titulo}</p>
                  {m.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {m.descricao}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1.5 flex-wrap">
                    {m.arquivoNome && (
                      <span className="truncate max-w-[12rem]">{m.arquivoNome}</span>
                    )}
                    {tamanho && <span>{tamanho}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {verNoApp && (
                    <button
                      type="button"
                      onClick={() => abrir(m)}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </button>
                  )}
                  <a
                    href={`/api/ensino/material/${m.id}`}
                    aria-label={`Baixar ${m.titulo}`}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className={verNoApp ? 'sr-only sm:not-sr-only' : ''}>Baixar</span>
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((m) => (
            <a
              key={m.id}
              href={`/api/ensino/material/${m.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={m.descricao ?? undefined}
              className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors"
            >
              <LinkIcon className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate max-w-[16rem]">{m.titulo}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      )}

      <Dialog open={aberto !== null} onOpenChange={(open) => !open && setAberto(null)}>
        <DialogContent className="sm:max-w-3xl h-[85vh] grid-rows-[auto_1fr_auto]">
          <DialogHeader>
            <DialogTitle className="pr-8 truncate">{aberto?.titulo}</DialogTitle>
          </DialogHeader>

          <div className="relative min-h-0 rounded-lg border border-border bg-muted overflow-hidden">
            {carregando && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {aberto && (
              <iframe
                key={aberto.id}
                src={`/api/ensino/material/${aberto.id}?modo=ver`}
                title={aberto.titulo}
                onLoad={() => setCarregando(false)}
                className="h-full w-full"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Não abriu? Baixe o arquivo.
            </p>
            {aberto && (
              <a
                href={`/api/ensino/material/${aberto.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
