// Gerador de payload PIX — "copia e cola" / BR Code, padrão BACEN sobre EMV®QRCPS.

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

/**
 * Texto para os campos livres do BR Code (nome, cidade, referência).
 *
 * Acento e cedilha viram a letra base e o que sobrar fora de ASCII cai fora:
 * cada app de banco decodifica o payload à sua maneira, e um "ç" cru é o jeito
 * mais fácil de o QR abrir com o nome corrompido em uns e falhar em outros.
 * O corte vem depois da limpeza — cortar antes conta bytes que nem sobrevivem.
 */
function textoAscii(valor: string, max: number): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, max)
    .trim()
}

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

/**
 * Deixa a chave no formato que o Banco Central registra, não no que a pessoa
 * digitou. CPF e CNPJ vão sem pontuação; telefone vai em E.164 (+5584…). Uma
 * chave com máscara gera um QR que o banco recusa na hora de pagar, e o erro
 * só aparece na mão de quem tentou contribuir.
 */
export function normalizarChavePix(chave: string, tipo: TipoChavePix): string {
  const limpa = chave.trim()
  switch (tipo) {
    case 'cpf':
    case 'cnpj':
      return limpa.replace(/\D/g, '')
    case 'telefone': {
      const digitos = limpa.replace(/\D/g, '')
      const semDDI = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
      return `+55${semDDI}`
    }
    case 'email':
      return limpa.toLowerCase()
    default:
      return limpa
  }
}

export interface PixParams {
  chave: string
  tipo: TipoChavePix
  nome: string      // beneficiário (máx. 25 caracteres no padrão)
  cidade?: string   // (máx. 15 caracteres)
  valor?: number    // opcional; sem valor, quem paga digita o quanto quer dar
  txid?: string     // referência (máx. 25 caracteres)
  descricao?: string
}

export function gerarPayloadPix(params: PixParams): string {
  const nome = textoAscii(params.nome, 25) || 'RECEBEDOR'
  const cidade = textoAscii(params.cidade ?? 'BRASIL', 15) || 'BRASIL'
  // O padrão aceita '***' como "sem identificador"; alfanumérico puro no resto.
  const txidLimpo = params.txid ? textoAscii(params.txid, 25).replace(/[^A-Za-z0-9]/g, '') : ''
  const txid = txidLimpo || '***'

  const mai = emv('00', 'br.gov.bcb.pix') +
    emv('01', normalizarChavePix(params.chave, params.tipo)) +
    (params.descricao ? emv('02', textoAscii(params.descricao, 72)) : '')

  const additionalData = emv('05', txid)

  let payload =
    emv('00', '01') +                    // Payload Format Indicator
    // '11' = QR reutilizável. Precisa ser este: '12' marca uso único, e é o
    // que fazia o app do banco recusar a segunda leitura do mesmo código —
    // justamente o caso do QR de dízimo, que fica fixo na tela e no mural.
    emv('01', '11') +
    emv('26', mai) +                     // Merchant Account Information
    emv('52', '0000') +                  // MCC — sem categoria específica
    emv('53', '986') +                   // Moeda: BRL
    (params.valor != null && params.valor > 0 ? emv('54', params.valor.toFixed(2)) : '') +
    emv('58', 'BR') +                    // País
    emv('59', nome) +
    emv('60', cidade) +
    emv('62', additionalData) +
    '6304'                               // CRC — o próprio campo entra no cálculo

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

export const LABEL_TIPO_PIX: Record<TipoChavePix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave aleatória',
}
