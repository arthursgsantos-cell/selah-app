'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, ExternalLink, Loader2, Share2 } from 'lucide-react'

interface Props {
  url: string
  titulo: string
  aberto: boolean
  aoFechar: () => void
  /** Nome sugerido do arquivo ao salvar. */
  nomeArquivo?: string | null
}

/**
 * Gatilho + diálogo, para quem só quer um botão pronto — inclusive dentro de
 * páginas de servidor, que não podem guardar o estado de aberto/fechado.
 */
export function BotaoComprovante({
  url, titulo, rotulo, className, children,
}: {
  url: string
  titulo: string
  rotulo?: string
  className?: string
  children?: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={rotulo ?? 'Ver comprovante'}
        className={className ?? 'shrink-0 text-xs font-medium text-primary hover:underline'}
      >
        {children ?? rotulo ?? 'ver'}
      </button>
      {aberto && (
        <VisualizadorComprovante
          url={url}
          titulo={titulo}
          aberto
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  )
}

/** Link do Drive vira endereço de pré-visualização, que abre dentro de um iframe. */
function paraPreview(url: string): string {
  const id =
    url.match(/\/file\/d\/([\w-]+)/)?.[1] ??
    url.match(/[?&]id=([\w-]+)/)?.[1] ??
    null
  return id ? `https://drive.google.com/file/d/${id}/preview` : url
}

function ehImagem(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|heic|avif)(\?|$)/i.test(url)
}

/**
 * Comprovante de pagamento, aberto sobre a tela.
 *
 * Ver o comprovante é uma conferência rápida no meio da lista: abrir outra aba
 * faz perder a posição na tabela, ainda mais no celular. Daí o diálogo, com
 * "Fechar" à mão.
 *
 * "Salvar" tenta, nesta ordem: a folha de compartilhamento do sistema com o
 * arquivo (é o que o celular espera, e permite mandar no WhatsApp), depois o
 * compartilhamento só do link, e por fim o download. O arquivo só pode ser
 * lido quando vem da mesma origem — comprovante hospedado no Drive cai no
 * compartilhamento de link.
 */
export function VisualizadorComprovante({ url, titulo, aberto, aoFechar, nomeArquivo }: Props) {
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  // `navigator` não existe na renderização do servidor; o ícone só decide
  // depois que a página monta.
  const [podeCompartilhar, setPodeCompartilhar] = useState(false)
  useEffect(() => setPodeCompartilhar(typeof navigator !== 'undefined' && !!navigator.share), [])

  const imagem = ehImagem(url)
  const src = imagem ? url : paraPreview(url)
  const nome = nomeArquivo ?? `${titulo.replace(/[^\w.-]+/g, '-').toLowerCase()}`

  async function salvar() {
    setSalvando(true)
    try {
      // Mesma origem: dá para entregar o arquivo em si à folha de compartilhamento.
      if (url.startsWith('/') || url.startsWith(window.location.origin)) {
        try {
          const resposta = await fetch(url)
          const blob = await resposta.blob()
          const arquivo = new File([blob], nome, { type: blob.type })
          if (navigator.canShare?.({ files: [arquivo] })) {
            await navigator.share({ files: [arquivo], title: titulo })
            return
          }
          const objeto = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = objeto
          link.download = nome
          link.click()
          URL.revokeObjectURL(objeto)
          return
        } catch {
          /* cai para o compartilhamento do link */
        }
      }

      if (navigator.share) {
        await navigator.share({ title: titulo, url })
        return
      }

      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      /* usuário cancelou o compartilhamento */
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-2xl h-[85vh] grid-rows-[auto_1fr_auto]">
        <DialogHeader>
          <DialogTitle className="pr-8 truncate text-base">{titulo}</DialogTitle>
        </DialogHeader>

        <div className="relative min-h-0 overflow-auto rounded-lg border border-border bg-muted">
          {carregando && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {aberto && (imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={titulo}
              onLoad={() => setCarregando(false)}
              className="mx-auto h-full w-auto max-w-full object-contain"
            />
          ) : (
            <iframe
              src={src}
              title={titulo}
              onLoad={() => setCarregando(false)}
              className="h-full w-full"
            />
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mr-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir fora
          </a>
          <Button variant="outline" size="sm" onClick={aoFechar}>
            Fechar
          </Button>
          <Button size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : podeCompartilhar ? (
              <Share2 className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
