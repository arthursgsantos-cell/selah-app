/**
 * Reduz a imagem no navegador antes de mandá-la para uma Server Action.
 *
 * Não é só economia de banda: o corpo de uma Server Action tem teto de 1 MB, e
 * foto de celular passa disso com folga. Sem comprimir, o upload falha e a tela
 * volta ao estado anterior — parecendo que "não salvou".
 *
 * Os buckets também têm teto próprio (`evento-capas` aceita 5 MB), então a
 * compressão serve aos dois limites de uma vez.
 */
export async function comprimirImagem(
  file: File,
  maxPx = 1600,
  quality = 0.82
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objUrl = URL.createObjectURL(file)

    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objUrl)
          if (!blob) {
            reject(new Error('Não consegui processar essa imagem.'))
            return
          }
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          )
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objUrl)
      reject(new Error('Não consegui ler essa imagem.'))
    }

    img.src = objUrl
  })
}
