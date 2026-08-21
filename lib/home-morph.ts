import type { HomeLayout } from '@/lib/supabase/types'

/** O elemento que embrulha a home inteira — landing ou grade. */
export const ID_PALCO = 'home-conteudo'

/**
 * Marca deixada para a home que vai nascer: "você está entrando depois de uma
 * troca, entre em cascata". Vive na sessão porque a página é remontada pelo
 * servidor no meio do caminho, e um estado de React não atravessaria isso.
 */
export const CHAVE_ENTRADA = 'selah:home-entrada'

/** Quanto dura cada saída no CSS, somado ao atraso do último elemento. */
const DURACAO_SAIDA: Record<HomeLayout, number> = {
  icones: 700,
  landing: 620,
}

export function prefereMenosMovimento(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Toca a saída da home atual e só volta quando ela terminou.
 *
 * Não faz nada fora de `/home` (a troca também sai de Meu perfil, onde não há
 * palco para animar) nem para quem pediu menos movimento no sistema. Nos dois
 * casos a troca continua acontecendo — o que se perde é só o gesto.
 */
export async function animarSaidaHome(destino: HomeLayout): Promise<void> {
  if (typeof document === 'undefined') return

  try {
    window.sessionStorage.setItem(CHAVE_ENTRADA, destino)
  } catch {
    // Navegador com armazenamento bloqueado: sem cascata na entrada, e é só.
  }

  const palco = document.getElementById(ID_PALCO)
  if (!palco || prefereMenosMovimento()) return

  // A transformação acontece no topo da página; quem trocou de layout com a
  // página rolada não veria nada.
  palco.scrollIntoView({ block: 'start', behavior: 'smooth' })

  palco.dataset.morph = destino === 'icones' ? 'para-icones' : 'para-secoes'
  await new Promise((resolve) => setTimeout(resolve, DURACAO_SAIDA[destino]))
}

/** Lê e consome a marca deixada por `animarSaidaHome`. */
export function consumirEntrada(): HomeLayout | null {
  if (typeof window === 'undefined') return null
  try {
    const marca = window.sessionStorage.getItem(CHAVE_ENTRADA)
    if (marca !== 'landing' && marca !== 'icones') return null
    window.sessionStorage.removeItem(CHAVE_ENTRADA)
    return marca
  } catch {
    return null
  }
}
