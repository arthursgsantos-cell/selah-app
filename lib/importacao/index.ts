import { sincronizarRoteiros } from '@/lib/roteiros-sync'
import { importarEventos } from './eventos'
import { importarFotosDeCelula } from './fotos'
import { prepararContexto, resultadoVazio, type ResultadoImportacao } from './registro'

export type ResultadoGeral = {
  roteiros: ResultadoImportacao
  fotos: ResultadoImportacao
  eventos: ResultadoImportacao
}

/**
 * Roda as três importações sobre a mesma leitura da planilha e da pasta do
 * Drive. Uma falhar não impede as outras: o erro fica no bloco daquele tipo.
 */
export async function sincronizarConteudos(): Promise<ResultadoGeral> {
  const ctx = await prepararContexto()

  const [roteiros, fotos, eventos] = await Promise.all([
    executar(() => sincronizarRoteiros(ctx)),
    executar(() => importarFotosDeCelula(ctx)),
    executar(() => importarEventos(ctx)),
  ])

  return { roteiros, fotos, eventos }
}

async function executar(fn: () => Promise<ResultadoImportacao>): Promise<ResultadoImportacao> {
  try {
    return await fn()
  } catch (e) {
    const resultado = resultadoVazio()
    resultado.erros.push({
      arquivo: 'planilha',
      motivo: e instanceof Error ? e.message : 'erro desconhecido',
    })
    return resultado
  }
}

export { prepararContexto, resultadoVazio }
export type { ResultadoImportacao }
