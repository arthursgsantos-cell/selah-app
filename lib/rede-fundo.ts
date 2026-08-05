import type { CSSProperties } from 'react'

export type FundoTipo = 'cor' | 'gradiente' | 'nebula' | 'imagem'

export const FUNDO_LABELS: Record<FundoTipo, string> = {
  cor: 'Cor sólida',
  gradiente: 'Degradê',
  nebula: 'Nébula',
  imagem: 'Imagem',
}

export type RedeAparencia = {
  cor: string
  cor_secundaria?: string | null
  fundo_tipo?: string | null
  /** Imagem do fundo da página — não confundir com `capa_url`, que é a foto de capa. */
  fundo_imagem_url?: string | null
  /** 0–100. Vale para qualquer estilo (cor, degradê, nébula ou imagem). */
  fundo_opacidade?: number | null
}

/** Clareia ou escurece um hex (#rrggbb). `amount` de -1 (preto) a 1 (branco). */
export function ajustarCor(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const mix = (c: number) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => mix(parseInt(h, 16)))
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

/**
 * Estilo do fundo da capa da rede. A imagem tem prioridade quando o tipo é
 * 'imagem'; se não houver capa, cai para o comportamento de cor sólida.
 */
export function fundoStyle(rede: RedeAparencia): CSSProperties {
  const cor = rede.cor || '#6366f1'
  const cor2 = rede.cor_secundaria || ajustarCor(cor, -0.45)
  const tipo = (rede.fundo_tipo ?? 'cor') as FundoTipo

  // Opacidade vale para qualquer estilo — controla o quanto o fundo se
  // impõe sobre o conteúdo por cima. 100 = padrão (sem transparência extra).
  const opacidadeRaw = rede.fundo_opacidade
  const opacidade = opacidadeRaw == null ? 1 : Math.min(100, Math.max(0, opacidadeRaw)) / 100

  if (tipo === 'imagem' && rede.fundo_imagem_url) {
    return {
      backgroundImage: `url(${rede.fundo_imagem_url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      opacity: opacidade,
    }
  }

  if (tipo === 'gradiente') {
    return { backgroundImage: `linear-gradient(135deg, ${cor} 0%, ${cor2} 100%)`, opacity: opacidade }
  }

  if (tipo === 'nebula') {
    const claro = ajustarCor(cor, 0.35)
    return {
      backgroundColor: cor2,
      backgroundImage: [
        `radial-gradient(at 18% 22%, ${claro} 0px, transparent 55%)`,
        `radial-gradient(at 82% 18%, ${cor} 0px, transparent 50%)`,
        `radial-gradient(at 68% 82%, ${ajustarCor(cor2, 0.3)} 0px, transparent 55%)`,
        `radial-gradient(at 25% 88%, ${cor} 0px, transparent 45%)`,
      ].join(', '),
      opacity: opacidade,
    }
  }

  return { backgroundColor: cor, opacity: opacidade }
}
