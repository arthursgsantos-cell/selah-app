/**
 * Converte um link de vídeo colado pelo usuário na URL de incorporação.
 * Aceita YouTube (watch, youtu.be, shorts, embed), Vimeo e arquivos diretos.
 */

export type VideoEmbed =
  | { tipo: 'iframe'; src: string }
  | { tipo: 'arquivo'; src: string }
  | null

export function resolverVideo(url: string | null | undefined): VideoEmbed {
  if (!url) return null
  const limpo = url.trim()
  if (!limpo) return null

  // Arquivo de vídeo servido diretamente
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(limpo)) {
    return { tipo: 'arquivo', src: limpo }
  }

  const yt =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(limpo)
  if (yt) {
    return { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}` }
  }

  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(limpo)
  if (vimeo) {
    return { tipo: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` }
  }

  return null
}
