/**
 * Qual roteiro do pastor vale para um encontro.
 *
 * O pastor publica o roteiro da semana com um período de validade
 * (`data_culto` até `validade_ate`), e a célula que se reúne dentro dele deve
 * estudar aquele texto. Antes, alguém precisava abrir o encontro e escolher o
 * roteiro na mão — e como a célula se reúne toda semana, era um trabalho
 * repetido que ninguém lembrava de fazer: o campo ficava vazio e a edificação
 * acontecia sem o material.
 *
 * A escolha manual continua valendo e ganha do automático. Ela existe para o
 * caso real de a célula estar atrasada e querer estudar o roteiro da semana
 * anterior.
 */

import { dataLocalIso } from '@/lib/dia-semana'

export interface RoteiroPeriodo {
  id: string
  data_culto: string
  validade_ate: string
}

/**
 * O roteiro cujo período cobre a data do encontro.
 *
 * A comparação é entre datas puras ("AAAA-MM-DD"), e a do encontro sai do
 * fuso da igreja: o encontro das 20h de sábado é guardado como 23h UTC, e
 * comparar pelo UTC jogaria metade dos sábados para o domingo — que pode já
 * ser outro roteiro.
 *
 * Com mais de um roteiro cobrindo o mesmo dia (período refeito, publicação
 * duplicada), ganha o de `data_culto` mais recente: é o que a liderança
 * publicou por último para aquele período.
 */
export function roteiroDoPeriodo<T extends RoteiroPeriodo>(
  dataHoraEncontro: string,
  roteiros: T[]
): T | null {
  const dia = dataLocalIso(dataHoraEncontro)

  const cobrindo = roteiros.filter(
    (r) => r.data_culto <= dia && dia <= r.validade_ate
  )
  if (cobrindo.length === 0) return null

  return cobrindo.reduce((maisRecente, r) =>
    r.data_culto > maisRecente.data_culto ? r : maisRecente
  )
}
