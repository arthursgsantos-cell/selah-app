import { acharIdDoArquivo, baixarArquivo } from '@/lib/importacao/drive'
import { acharAba, celula, coluna, parseCsv, type Aba } from '@/lib/importacao/planilha'
import {
  prepararContexto,
  registrar,
  resultadoVazio,
  type Contexto,
  type ResultadoImportacao,
} from '@/lib/importacao/registro'
import { normalizarData } from '@/lib/importacao/texto'

/**
 * Importa roteiros a partir da planilha de controle publicada no Google Sheets.
 *
 * A planilha traz apenas o NOME do arquivo, então o ID no Drive é resolvido a
 * partir da listagem da pasta compartilhada. Os PDFs ficam na **raiz** da
 * pasta (as fotos e os cards de evento é que estão em subpastas).
 *
 * A deduplicação continua sendo por `resumos_culto.arquivo_nome` — foi assim
 * que os roteiros já importados entraram, e mudar a chave reimportaria tudo.
 */

export type LinhaPlanilha = {
  nome: string
  data: string
  publicadoPor: string
  resumo: string
}

/** Mantido para compatibilidade com quem já consumia esse tipo. */
export type ResultadoSync = ResultadoImportacao

/** Colunas que identificam a aba de roteiros, em qualquer ordem. */
const ASSINATURA_ROTEIROS = ['Nome', 'Data', 'Quem Publicou', 'Resumo']

export { parseCsv }

/** Lê as linhas da aba de roteiros. */
export function lerAbaDeRoteiros(aba: Aba): LinhaPlanilha[] {
  const idxNome = coluna(aba, 'Nome')
  const idxData = coluna(aba, 'Data')
  const idxAutor = coluna(aba, 'Quem Publicou', 'Autor')
  // A spec pede o resumo longo; "Resumo" (curto) só entra se o detalhado
  // estiver ausente ou vazio na linha.
  const idxDetalhado = coluna(aba, 'Resumo Detalhado')
  const idxResumo = coluna(aba, 'Resumo')

  if (idxNome < 0) throw new Error('A planilha não tem coluna "Nome".')

  return aba.linhas
    .map((l) => ({
      nome: celula(l, idxNome),
      data: celula(l, idxData),
      publicadoPor: celula(l, idxAutor),
      resumo: celula(l, idxDetalhado) || celula(l, idxResumo),
    }))
    .filter((r) => r.nome)
}

/** Baixa uma aba avulsa em CSV — reserva para quando a descoberta falhar. */
export async function lerPlanilha(csvUrl: string): Promise<LinhaPlanilha[]> {
  const res = await fetch(csvUrl, { cache: 'no-store', redirect: 'follow' })
  if (!res.ok) throw new Error(`Não consegui ler a planilha (HTTP ${res.status}).`)

  const linhas = parseCsv(await res.text())
  if (linhas.length < 2) return []

  return lerAbaDeRoteiros({
    gid: '',
    cabecalho: linhas[0].map((c) => c.trim()),
    linhas: linhas.slice(1),
  })
}

function somarDias(dataIso: string, dias: number): string {
  const d = new Date(dataIso)
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

/** Título legível a partir do nome do arquivo. */
function tituloDoArquivo(nome: string, data: string): string {
  const semExt = nome.replace(/\.[^.]+$/, '')
  const limpo = semExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return limpo || `Roteiro de ${data}`
}

export async function sincronizarRoteiros(contexto?: Contexto): Promise<ResultadoImportacao> {
  const ctx = contexto ?? (await prepararContexto())
  const resultado = resultadoVazio()

  const aba = acharAba(ctx.abas, ASSINATURA_ROTEIROS)
  const linhas = aba
    ? lerAbaDeRoteiros(aba)
    // Se a aba não for reconhecida pelo cabeçalho, cai na URL configurada —
    // os roteiros nunca dependem só da descoberta automática.
    : await lerPlanilha(process.env.ROTEIROS_SHEET_CSV_URL!)

  const arquivos = await ctx.listar(ctx.pastaRaiz)

  const { data: existentes } = await ctx.admin
    .from('resumos_culto')
    .select('arquivo_nome')
    .eq('igreja_id', ctx.igrejaId)
    .not('arquivo_nome', 'is', null)

  const jaImportados = new Set(
    ((existentes ?? []) as { arquivo_nome: string | null }[]).map((r) => r.arquivo_nome)
  )

  for (const linha of linhas) {
    if (jaImportados.has(linha.nome)) {
      resultado.ignorados.push(linha.nome)
      continue
    }

    const fileId = acharIdDoArquivo(arquivos, linha.nome)
    if (!fileId) {
      const motivo = 'Arquivo não encontrado na pasta do Drive'
      resultado.erros.push({ arquivo: linha.nome, motivo })
      await registrar(ctx, {
        tipo: 'roteiro',
        chave: linha.nome,
        status: 'erro',
        arquivoNome: linha.nome,
        motivo,
      })
      continue
    }

    try {
      const buffer = await baixarArquivo(fileId)
      const assinatura = new TextDecoder().decode(buffer.slice(0, 5))
      if (assinatura !== '%PDF-') throw new Error('o arquivo baixado não é um PDF')

      const dataCulto = normalizarData(linha.data)
      const path = `planilha/${fileId}.pdf`

      const { error: erroUpload } = await ctx.admin.storage
        .from('resumos-culto')
        .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
      if (erroUpload) throw new Error(erroUpload.message)

      const { data: { publicUrl } } = ctx.admin.storage.from('resumos-culto').getPublicUrl(path)

      const { data: inserido, error: erroInsert } = await ctx.admin
        .from('resumos_culto')
        .insert({
          igreja_id: ctx.igrejaId,
          titulo: tituloDoArquivo(linha.nome, dataCulto),
          conteudo: linha.resumo || 'Resumo não informado na planilha.',
          pdf_url: publicUrl,
          data_culto: dataCulto,
          validade_ate: somarDias(dataCulto, 7),
          arquivo_nome: linha.nome,
          publicado_por: linha.publicadoPor || null,
        } as never)
        .select('id')
        .single()
      if (erroInsert) throw new Error(erroInsert.message)

      // A planilha lista o mesmo PDF em mais de uma linha; a partir daqui as
      // repetições dentro desta mesma execução caem em "ignorados".
      jaImportados.add(linha.nome)

      await registrar(ctx, {
        tipo: 'roteiro',
        chave: linha.nome,
        status: 'importado',
        arquivoNome: linha.nome,
        destino: 'resumos_culto',
        registroId: (inserido as { id: string } | null)?.id ?? null,
      })

      resultado.importados.push(linha.nome)
    } catch (e) {
      const motivo = e instanceof Error ? e.message : 'erro desconhecido'
      resultado.erros.push({ arquivo: linha.nome, motivo })
      await registrar(ctx, {
        tipo: 'roteiro',
        chave: linha.nome,
        status: 'erro',
        arquivoNome: linha.nome,
        motivo,
      })
    }
  }

  return resultado
}
