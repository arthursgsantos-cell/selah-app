import { createAdminClient } from '@/lib/supabase/admin'
import { criarLeitorDrive, type LeitorDrive } from './drive'
import { baixarAbas, type Aba } from './planilha'

export type TipoImportacao = 'roteiro' | 'foto_celula' | 'evento'
export type StatusImportacao = 'importado' | 'ignorado' | 'pendente' | 'erro'

export type LinhaImportacao = {
  tipo: TipoImportacao
  /** Identificador estável do item na origem (ver comentário da migração). */
  chave: string
  arquivo_nome: string | null
  celula_id: string | null
  destino: string | null
  grupo_origem: string | null
  registro_id: string | null
  status: StatusImportacao
  motivo: string | null
  importado_em: string
}

export type ResultadoImportacao = {
  importados: string[]
  atualizados: string[]
  ignorados: string[]
  /** Item reconhecido, mas que precisa de uma decisão humana (célula/rede nova). */
  pendentes: { arquivo: string; motivo: string }[]
  erros: { arquivo: string; motivo: string }[]
}

export function resultadoVazio(): ResultadoImportacao {
  return { importados: [], atualizados: [], ignorados: [], pendentes: [], erros: [] }
}

export type Contexto = {
  admin: ReturnType<typeof createAdminClient>
  igrejaId: string
  abas: Aba[]
  /** Id da pasta compartilhada do Drive (raiz). */
  pastaRaiz: string
  listar: LeitorDrive
}

/**
 * Abre a planilha e a pasta do Drive uma única vez para as três importações.
 *
 * `ROTEIROS_SHEET_CSV_URL` aponta para a URL de uma aba; a base da publicação
 * (sem query) é o que serve para descobrir todas as abas — por isso nenhuma
 * variável de ambiente nova.
 */
export async function prepararContexto(): Promise<Contexto> {
  const csvUrl = process.env.ROTEIROS_SHEET_CSV_URL
  const pastaRaiz = process.env.ROTEIROS_DRIVE_FOLDER_ID
  if (!csvUrl || !pastaRaiz) {
    throw new Error('Configure ROTEIROS_SHEET_CSV_URL e ROTEIROS_DRIVE_FOLDER_ID no ambiente.')
  }

  const admin = createAdminClient()
  const { data: igreja } = await admin.from('igrejas').select('id').limit(1).single()
  if (!igreja) throw new Error('Nenhuma igreja cadastrada.')

  const abas = await baixarAbas(csvUrl)
  if (abas.length === 0) throw new Error('A planilha publicada não devolveu nenhuma aba legível.')

  return { admin, igrejaId: igreja.id, abas, pastaRaiz, listar: criarLeitorDrive() }
}

/** Todas as linhas de `importacoes` de um tipo, para a igreja do contexto. */
export async function carregarRegistros(
  ctx: Contexto,
  tipo: TipoImportacao
): Promise<LinhaImportacao[]> {
  const { data, error } = await ctx.admin
    .from('importacoes')
    .select('tipo, chave, arquivo_nome, celula_id, destino, grupo_origem, registro_id, status, motivo, importado_em')
    .eq('igreja_id', ctx.igrejaId)
    .eq('tipo', tipo)
  if (error) throw new Error(`Não consegui ler a tabela de importações: ${error.message}`)
  return (data ?? []) as unknown as LinhaImportacao[]
}

export type EntradaRegistro = {
  tipo: TipoImportacao
  chave: string
  status: StatusImportacao
  arquivoNome?: string | null
  celulaId?: string | null
  destino?: string | null
  grupoOrigem?: string | null
  registroId?: string | null
  motivo?: string | null
}

/**
 * Grava (ou atualiza) a linha de controle. O `onConflict` na chave natural é o
 * que torna a importação repetível: rodar de novo reencontra a mesma linha.
 */
export async function registrar(ctx: Contexto, entrada: EntradaRegistro): Promise<void> {
  const { error } = await ctx.admin.from('importacoes').upsert(
    {
      igreja_id: ctx.igrejaId,
      tipo: entrada.tipo,
      chave: entrada.chave,
      arquivo_nome: entrada.arquivoNome ?? null,
      celula_id: entrada.celulaId ?? null,
      destino: entrada.destino ?? null,
      grupo_origem: entrada.grupoOrigem ?? null,
      registro_id: entrada.registroId ?? null,
      status: entrada.status,
      motivo: entrada.motivo ?? null,
      importado_em: new Date().toISOString(),
    } as never,
    { onConflict: 'igreja_id,tipo,chave' }
  )
  if (error) throw new Error(`Não consegui registrar a importação: ${error.message}`)
}

/**
 * Apaga a linha de controle de uma chave. Usado quando uma pendência é
 * resolvida: a linha "arquivo:<nome>" sai e entra a linha definitiva.
 */
export async function apagarRegistro(
  ctx: Contexto,
  tipo: TipoImportacao,
  chave: string
): Promise<void> {
  await ctx.admin
    .from('importacoes')
    .delete()
    .eq('igreja_id', ctx.igrejaId)
    .eq('tipo', tipo)
    .eq('chave', chave)
}

/**
 * Chave provisória de um item que ainda não chegou ao destino final (pendência
 * ou erro). O prefixo separa esse espaço do das chaves definitivas — um hash
 * SHA-256 nunca começa com "arquivo:".
 */
export function chaveProvisoria(nomeArquivo: string): string {
  return `arquivo:${nomeArquivo}`
}
