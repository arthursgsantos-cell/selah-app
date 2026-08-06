import { sincronizarRoteiros } from '@/lib/roteiros-sync'
import { importarEncontrosDaCelula, type ResultadoCelula } from './encontros-celula'
import { importarEventos } from './eventos'
import { importarFotosDeCelula } from './fotos'
import { prepararContexto, resultadoVazio, type ResultadoImportacao } from './registro'

export type ResultadoGeral = {
  roteiros: ResultadoImportacao
  fotos: ResultadoImportacao
  eventos: ResultadoImportacao
  encontros: ResultadoImportacao
  lanches: ResultadoImportacao
}

/**
 * Roda todas as importações sobre a mesma leitura da planilha e da pasta do
 * Drive. Uma falhar não impede as outras: o erro fica no bloco daquele tipo.
 */
export async function sincronizarConteudos(): Promise<ResultadoGeral> {
  const ctx = await prepararContexto()

  const [roteiros, fotos, eventos, celula] = await Promise.all([
    executar(() => sincronizarRoteiros(ctx)),
    executar(() => importarFotosDeCelula(ctx)),
    executar(() => importarEventos(ctx)),
    executarCelula(() => importarEncontrosDaCelula(ctx)),
  ])

  return { roteiros, fotos, eventos, ...celula }
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

/** A célula devolve dois blocos de uma vez (encontros e lanches). */
async function executarCelula(fn: () => Promise<ResultadoCelula>): Promise<ResultadoCelula> {
  try {
    return await fn()
  } catch (e) {
    const motivo = e instanceof Error ? e.message : 'erro desconhecido'
    const encontros = resultadoVazio()
    encontros.erros.push({ arquivo: 'planilha', motivo })
    return { encontros, lanches: resultadoVazio() }
  }
}

export { prepararContexto, resultadoVazio }
export type { ResultadoImportacao }
