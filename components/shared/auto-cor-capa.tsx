'use client'

import { useEffect, useRef } from 'react'
import { coresDaImagem } from '@/lib/cores-da-imagem'

interface Props {
  /** Capa de onde as cores saem. Sem capa, não há o que extrair. */
  capaUrl: string | null
  ativo: boolean
  /** URL da capa que gerou as cores atuais. */
  origem: string | null
  salvar: (cor: string, corSecundaria: string, origem: string) => Promise<void>
}

/**
 * Recalcula as cores do fundo quando a capa muda.
 *
 * Não desenha nada: só compara a capa atual com a que gerou as cores gravadas
 * e, se forem diferentes, extrai e salva. A partir daí o servidor já entrega
 * a página com as cores certas, sem piscar.
 */
export function AutoCorCapa({ capaUrl, ativo, origem, salvar }: Props) {
  // Sem isto, o React em modo estrito dispararia a extração duas vezes.
  const processando = useRef<string | null>(null)

  useEffect(() => {
    if (!ativo || !capaUrl) return
    if (origem === capaUrl) return
    if (processando.current === capaUrl) return

    processando.current = capaUrl
    let cancelado = false

    void (async () => {
      const cores = await coresDaImagem(capaUrl)
      if (!cores || cancelado) return
      try {
        await salvar(cores.cor, cores.corSecundaria, capaUrl)
      } catch {
        // Sem permissão ou rede fora: a página segue com as cores atuais e
        // tenta de novo na próxima visita de quem puder salvar.
      }
    })()

    return () => {
      cancelado = true
    }
  }, [capaUrl, ativo, origem, salvar])

  return null
}
