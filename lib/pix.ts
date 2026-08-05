// Gerador de payload PIX estático — padrão BACEN/EMV QR Code

function emv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0')
  return `${id}${len}${value}`
}

function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return ((crc & 0xffff).toString(16).toUpperCase()).padStart(4, '0')
}

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export interface PixParams {
  chave: string
  tipo: TipoChavePix
  nome: string   // beneficiário (max 25 chars)
  cidade?: string // (max 15 chars, padrão "Brasil")
  valor?: number  // opcional; omitido = o usuário digita
  txid?: string   // referência (max 25 chars, padrão "***")
  descricao?: string // descrição curta no app do banco
}

export function gerarPayloadPix(params: PixParams): string {
  const nome = params.nome.slice(0, 25).normalize('NFD').replace(/[̀-ͯ]/g, '')
  const cidade = (params.cidade ?? 'Brasil').slice(0, 15).normalize('NFD').replace(/[̀-ͯ]/g, '')
  const txid = (params.txid ?? '***').slice(0, 25)

  const mai = emv('00', 'br.gov.bcb.pix') +
    emv('01', params.chave) +
    (params.descricao ? emv('02', params.descricao.slice(0, 72)) : '')

  const additionalData = emv('05', txid)

  let payload =
    emv('00', '01') +                    // Payload Format Indicator
    emv('01', '12') +                    // Dynamic — sem valor fixo no QR; use '11' se tiver valor
    emv('26', mai) +                     // Merchant Account Information
    emv('52', '0000') +                  // MCC
    emv('53', '986') +                   // BRL
    (params.valor != null ? emv('54', params.valor.toFixed(2)) : '') +
    emv('58', 'BR') +                    // Country
    emv('59', nome) +
    emv('60', cidade) +
    emv('62', additionalData) +
    '6304'                               // CRC placeholder

  const checksum = crc16(payload)
  return payload + checksum
}

export function formatarChavePix(chave: string, tipo: TipoChavePix): string {
  switch (tipo) {
    case 'cpf':    return chave.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    case 'cnpj':   return chave.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    case 'telefone': return chave
    default:       return chave
  }
}
