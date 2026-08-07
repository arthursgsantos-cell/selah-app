'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react'

interface Props {
  url: string
  titulo: string
  /** Texto do gatilho. Padrão: "Abrir PDF". */
  rotulo?: string
  className?: string
}

/**
 * Abre um PDF dentro do app, num diálogo.
 *
 * Roteiro e resumo do culto são consultados no meio do encontro: mandar a
 * pessoa para outra aba faz ela perder o lugar onde estava. O diálogo ocupa
 * quase a tela inteira e o PDF entra com `#view=FitH`, que ajusta a página à
 * largura — sem isso o leitor do navegador abre no zoom padrão e corta a
 * margem direita no celular.
 *
 * O navegador móvel que não desenha PDF em `<iframe>` mostra um quadro em
 * branco; por isso "Abrir em nova aba" e "Baixar" ficam sempre visíveis no
 * rodapé, e não escondidos atrás de um erro.
 */
export function BotaoPdf({ url, titulo, rotulo = 'Abrir PDF', className }: Props) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)

  return (
    <>
      <button
        type="button"
        onClick={() => { setCarregando(true); setAberto(true) }}
        className={className ?? 'flex items-center gap-1 text-xs text-primary hover:underline shrink-0'}
      >
        <FileText className="h-3 w-3" />
        {rotulo}
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-4xl h-[90vh] grid-rows-[auto_1fr_auto]">
          <DialogHeader>
            <DialogTitle className="pr-8 truncate text-base">{titulo}</DialogTitle>
          </DialogHeader>

          <div className="relative min-h-0 overflow-hidden rounded-lg border border-border bg-muted">
            {carregando && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {aberto && (
              <iframe
                src={`${url}#view=FitH`}
                title={titulo}
                onLoad={() => setCarregando(false)}
                className="h-full w-full"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Não abriu aqui?</p>
            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Nova aba
              </a>
              <a
                href={url}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
