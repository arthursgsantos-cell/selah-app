'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, ExternalLink, Loader2, FileQuestion } from 'lucide-react'

export type FormatoArquivo = 'imagem' | 'pdf' | 'texto' | 'nenhum'

const IMAGENS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp']
const TEXTOS = ['txt', 'md', 'csv']

/**
 * O que o navegador desenha sozinho.
 *
 * `.docx` e `.pptx` ficam de fora de propósito: abririam um quadro em branco
 * ou disparariam o download por baixo do pano — pior do que dizer de cara que
 * só dá para baixar.
 */
export function formatoDoArquivo(nome: string | null | undefined): FormatoArquivo {
  const ext = nome?.split('?')[0].split('.').pop()?.toLowerCase()
  if (!ext) return 'nenhum'
  if (IMAGENS.includes(ext)) return 'imagem'
  if (ext === 'pdf') return 'pdf'
  if (TEXTOS.includes(ext)) return 'texto'
  return 'nenhum'
}

export function podeVerNoApp(nome: string | null | undefined): boolean {
  return formatoDoArquivo(nome) !== 'nenhum'
}

interface Props {
  /** Endereço que devolve o conteúdo para exibir (`Content-Disposition: inline`). */
  urlVer: string
  /** Endereço que força o download. Só é usado no clique do botão "Baixar". */
  urlBaixar: string
  titulo: string
  nomeArquivo?: string | null
  aberto: boolean
  aoFechar: () => void
}

/**
 * Arquivo aberto sobre a tela, no tamanho dele.
 *
 * Imagem entra como `<img>`, não dentro de um `<iframe>`: o visualizador de
 * imagem do navegador, preso num quadro de altura fixa, aplica o próprio zoom
 * e corta as bordas. Com a tag de imagem o popup encolhe até o tamanho natural
 * do arquivo — e só reduz, nunca corta, quando a imagem é maior que a tela.
 *
 * PDF é o caso oposto: não tem tamanho próprio para o diálogo herdar, então
 * ganha uma altura generosa e entra com `#view=FitH`, que ajusta a página à
 * largura em vez de abrir no zoom padrão cortando a margem direita no celular.
 *
 * Nada aqui baixa sozinho. O download é o botão do rodapé, e só ele.
 */
export function VisualizadorArquivo({
  urlVer, urlBaixar, titulo, nomeArquivo, aberto, aoFechar,
}: Props) {
  const [carregando, setCarregando] = useState(true)
  const [falhou, setFalhou] = useState(false)

  const formato = formatoDoArquivo(nomeArquivo)

  // Cada arquivo recomeça o ciclo: sem isso o segundo material abre já
  // marcado como carregado, herdando o estado do anterior.
  useEffect(() => {
    if (aberto) { setCarregando(true); setFalhou(false) }
  }, [aberto, urlVer])

  // A imagem manda no tamanho; o PDF precisa de uma moldura alta para existir.
  const molduraClasse =
    formato === 'imagem'
      ? 'w-auto max-w-[95vw] sm:max-w-[92vw] max-h-[92vh] grid-rows-[auto_1fr_auto]'
      : 'w-[95vw] sm:w-[min(56rem,92vw)] max-w-none sm:max-w-none h-[88vh] grid-rows-[auto_1fr_auto]'

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      {/* `showCloseButton` é o padrão do DialogContent — o X fica no canto
          superior direito, e o título reserva o espaço dele com `pr-8`. */}
      <DialogContent className={molduraClasse}>
        <DialogHeader>
          <DialogTitle className="pr-8 truncate text-base">{titulo}</DialogTitle>
        </DialogHeader>

        <div className="relative min-h-0 overflow-auto rounded-lg border border-border bg-muted">
          {carregando && !falhou && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {falhou || formato === 'nenhum' ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <FileQuestion className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Este arquivo não abre aqui</p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                O formato não tem visualização no navegador. Use o botão abaixo para baixar.
              </p>
            </div>
          ) : formato === 'imagem' ? (
            // Sem `object-cover` e sem altura fixa: a imagem fica no tamanho
            // natural e só encolhe se passar da tela.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlVer}
              alt={titulo}
              onLoad={() => setCarregando(false)}
              onError={() => { setCarregando(false); setFalhou(true) }}
              className="mx-auto block h-auto w-auto max-h-[75vh] max-w-full object-contain"
            />
          ) : (
            <iframe
              src={formato === 'pdf' ? `${urlVer}#view=FitH` : urlVer}
              title={titulo}
              onLoad={() => setCarregando(false)}
              className="h-full w-full"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <a
            href={urlVer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir em nova aba
          </a>
          <a
            href={urlBaixar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
