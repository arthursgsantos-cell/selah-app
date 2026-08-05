import { resolvedorDeRedes } from './destinos'
import {
  acharIdDaSubpasta,
  acharIdDoArquivo,
  baixarArquivo,
  extensaoDe,
  tipoDaImagem,
} from './drive'
import { acharAba, celula, coluna } from './planilha'
import {
  apagarRegistro,
  carregarRegistros,
  registrar,
  resultadoVazio,
  type Contexto,
  type ResultadoImportacao,
} from './registro'
import { normalizarNome, parsePeriodoEvento, slug } from './texto'

/**
 * Importa os eventos (cards do WhatsApp) para a agenda.
 *
 * Chave de dedup: `slug(nome do evento) + data do evento`. Segunda chamada,
 * lembrete e card novo do mesmo evento caem na mesma chave — o evento é
 * **atualizado**, nunca duplicado.
 *
 * A coluna `Destino` é a fonte oficial do escopo: não é inferida do nome nem
 * alterada por aqui. Rede que não existe vira pendência, sem descartar a linha.
 */

const ASSINATURA = ['Nome da imagem', 'Nome do evento', 'Data do evento', 'Destino']

/** Subpasta do Drive onde ficam os cards. */
const PASTA = 'Eventos'

type Escopo = { redeId: string | null; tipo: 'igreja' | 'rede' }

export async function importarEventos(ctx: Contexto): Promise<ResultadoImportacao> {
  const resultado = resultadoVazio()

  const aba = acharAba(ctx.abas, ASSINATURA)
  if (!aba) {
    resultado.erros.push({
      arquivo: PASTA,
      motivo: `Nenhuma aba da planilha tem as colunas de eventos (${ASSINATURA.join(', ')}).`,
    })
    return resultado
  }

  const idx = {
    imagem: coluna(aba, 'Nome da imagem'),
    nome: coluna(aba, 'Nome do evento'),
    data: coluna(aba, 'Data do evento'),
    local: coluna(aba, 'Local do evento'),
    resumo: coluna(aba, 'Resumo do evento'),
    link: coluna(aba, 'Link de inscrição'),
    destino: coluna(aba, 'Destino'),
  }

  const raiz = await ctx.listar(ctx.pastaRaiz)
  const pastaEventos = acharIdDaSubpasta(raiz, PASTA)
  const itensDaPasta = pastaEventos ? await ctx.listar(pastaEventos) : []

  const registros = await carregarRegistros(ctx, 'evento')
  const porChave = new Map(registros.map((r) => [r.chave, r]))
  const acharRede = await resolvedorDeRedes(ctx)

  for (const linha of aba.linhas) {
    const nome = celula(linha, idx.nome)
    if (!nome) continue

    const destinoTexto = celula(linha, idx.destino)
    const periodo = parsePeriodoEvento(celula(linha, idx.data))
    const chave = chaveDoEvento(nome, periodo?.inicio ?? null)

    if (!periodo) {
      const motivo = `Não entendi a data "${celula(linha, idx.data)}" do evento.`
      resultado.pendentes.push({ arquivo: nome, motivo })
      await registrar(ctx, {
        tipo: 'evento',
        chave,
        status: 'pendente',
        arquivoNome: celula(linha, idx.imagem) || null,
        destino: destinoTexto || null,
        grupoOrigem: nome,
        motivo,
      })
      continue
    }

    const escopo = resolverEscopo(destinoTexto, acharRede)
    if (!escopo) {
      const motivo = `Destino "${destinoTexto}" não corresponde a nenhuma rede cadastrada (${acharRede.nomes.join(', ')}).`
      resultado.pendentes.push({ arquivo: nome, motivo })
      await registrar(ctx, {
        tipo: 'evento',
        chave,
        status: 'pendente',
        arquivoNome: celula(linha, idx.imagem) || null,
        destino: destinoTexto || null,
        grupoOrigem: nome,
        motivo,
      })
      continue
    }

    const dados = {
      nome,
      local: celula(linha, idx.local),
      resumo: celula(linha, idx.resumo),
      link: celula(linha, idx.link),
      imagem: celula(linha, idx.imagem),
      destinoTexto,
      escopo,
      periodo,
    }

    try {
      const anterior = porChave.get(chave)
      const existente =
        anterior?.status === 'importado' && anterior.registro_id ? anterior.registro_id : null

      if (existente) {
        const { mudou, imagemAvaliada } = await atualizarEvento(
          ctx,
          existente,
          dados,
          anterior!.arquivo_nome,
          anterior!.destino,
          itensDaPasta
        )
        if (mudou) resultado.atualizados.push(nome)
        else resultado.ignorados.push(nome)

        await registrar(ctx, {
          tipo: 'evento',
          chave,
          status: 'importado',
          // Guarda o card já avaliado (trocado ou descartado por ser menor):
          // a rodada seguinte não precisa baixá-lo de novo para decidir igual.
          arquivoNome: imagemAvaliada,
          destino: destinoTexto || null,
          grupoOrigem: nome,
          registroId: existente,
        })
        continue
      }

      const imagemUrl = await subirCard(ctx, dados.imagem, itensDaPasta, chave)

      const { data: criado, error } = await ctx.admin
        .from('eventos')
        .insert({
          igreja_id: ctx.igrejaId,
          rede_id: escopo.redeId,
          titulo: nome,
          descricao: dados.resumo || null,
          data_hora: periodo.inicio,
          data_hora_fim: periodo.fim,
          local: dados.local || null,
          imagem_url: imagemUrl,
          tipo: escopo.tipo,
          tipo_inscricao: dados.link ? 'link' : 'aberto',
          link_inscricao_url: dados.link || null,
        } as never)
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      const registroId = (criado as { id: string } | null)?.id ?? null

      await registrar(ctx, {
        tipo: 'evento',
        chave,
        status: 'importado',
        arquivoNome: dados.imagem || null,
        destino: destinoTexto || null,
        grupoOrigem: nome,
        registroId,
      })

      // A pendência que ficou quando a data ainda não era legível deixa de valer.
      await apagarRegistro(ctx, 'evento', chaveDoEvento(nome, null))

      porChave.set(chave, {
        tipo: 'evento',
        chave,
        arquivo_nome: dados.imagem || null,
        celula_id: null,
        destino: destinoTexto || null,
        grupo_origem: nome,
        registro_id: registroId,
        status: 'importado',
        motivo: null,
        importado_em: new Date().toISOString(),
      })

      resultado.importados.push(nome)
    } catch (e) {
      const motivo = e instanceof Error ? e.message : 'erro desconhecido'
      resultado.erros.push({ arquivo: nome, motivo })
      await registrar(ctx, {
        tipo: 'evento',
        chave,
        status: 'erro',
        arquivoNome: celula(linha, idx.imagem) || null,
        destino: destinoTexto || null,
        grupoOrigem: nome,
        motivo,
      })
    }
  }

  return resultado
}

type DadosEvento = {
  nome: string
  local: string
  resumo: string
  link: string
  imagem: string
  destinoTexto: string
  escopo: Escopo
  periodo: NonNullable<ReturnType<typeof parsePeriodoEvento>>
}

export function chaveDoEvento(nome: string, dataIso: string | null): string {
  return `${slug(nome)}@${dataIso ? dataIso.slice(0, 10) : 'sem-data'}`
}

/**
 * "Rede One" → rede One. "Igreja" ou vazio → evento da igreja.
 * `null` quando o destino cita uma rede que não existe.
 */
function resolverEscopo(destino: string, acharRede: Awaited<ReturnType<typeof resolvedorDeRedes>>): Escopo | null {
  const texto = normalizarNome(destino)
  if (!texto || texto === 'igreja') return { redeId: null, tipo: 'igreja' }

  const rede = acharRede(destino)
  return rede ? { redeId: rede.id, tipo: 'rede' } : null
}

/**
 * Reencontrou um evento já importado: preenche o que está vazio e devolve se
 * algo mudou de fato. Sem mudança a execução reporta "ignorado" — é o que
 * garante que a segunda rodada seguida não mexa em nada.
 */
async function atualizarEvento(
  ctx: Contexto,
  eventoId: string,
  dados: DadosEvento,
  imagemAnterior: string | null,
  destinoAnterior: string | null,
  itensDaPasta: { rotulo: string; id: string }[]
): Promise<{ mudou: boolean; imagemAvaliada: string | null }> {
  const { data } = await ctx.admin
    .from('eventos')
    .select('descricao, local, imagem_url, data_hora_fim, tipo_inscricao, link_inscricao_url, rede_id, tipo')
    .eq('id', eventoId)
    .maybeSingle()

  if (!data) throw new Error('o evento importado antes não existe mais')
  const atual = data as {
    descricao: string | null
    local: string | null
    imagem_url: string | null
    data_hora_fim: string | null
    tipo_inscricao: string
    link_inscricao_url: string | null
    rede_id: string | null
    tipo: string
  }

  const patch: Record<string, unknown> = {}

  if (!atual.descricao && dados.resumo) patch.descricao = dados.resumo
  if (!atual.local && dados.local) patch.local = dados.local
  if (!atual.data_hora_fim && dados.periodo.fim) patch.data_hora_fim = dados.periodo.fim

  if (dados.link && !atual.link_inscricao_url) {
    patch.link_inscricao_url = dados.link
    if (atual.tipo_inscricao === 'aberto') patch.tipo_inscricao = 'link'
  }

  // O Destino é a fonte oficial do escopo: se ele mudou na planilha, o evento
  // acompanha. Não mexemos quando a planilha repete o mesmo destino.
  const destinoMudou = normalizarNome(destinoAnterior ?? '') !== normalizarNome(dados.destinoTexto)
  if (destinoMudou && atual.rede_id !== dados.escopo.redeId) {
    patch.rede_id = dados.escopo.redeId
    patch.tipo = dados.escopo.tipo
  }

  // Card novo só substitui o antigo se for maior — heurística da spec para
  // "card mais completo". Mesmo nome de arquivo nem chega a baixar.
  let imagemAvaliada = imagemAnterior
  if (dados.imagem && dados.imagem !== imagemAnterior) {
    imagemAvaliada = dados.imagem
    const nova = await baixarCard(dados.imagem, itensDaPasta)
    if (nova && nova.buffer.byteLength > (await tamanhoAtual(atual.imagem_url))) {
      patch.imagem_url = await guardarCard(ctx, nova, dados.imagem, `${eventoId}-${Date.now()}`)
    }
  }

  if (Object.keys(patch).length === 0) return { mudou: false, imagemAvaliada }

  const { error } = await ctx.admin.from('eventos').update(patch as never).eq('id', eventoId)
  if (error) throw new Error(error.message)
  return { mudou: true, imagemAvaliada }
}

/** Tamanho em bytes da imagem que o evento já usa. 0 quando não há imagem. */
async function tamanhoAtual(url: string | null): Promise<number> {
  if (!url) return 0
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return Number(res.headers.get('content-length') ?? 0)
  } catch {
    return 0
  }
}

type Card = { buffer: ArrayBuffer; contentType: string }

async function baixarCard(
  nomeImagem: string,
  itensDaPasta: { rotulo: string; id: string }[]
): Promise<Card | null> {
  const fileId = acharIdDoArquivo(itensDaPasta, nomeImagem)
  if (!fileId) return null
  const buffer = await baixarArquivo(fileId)
  const contentType = tipoDaImagem(buffer)
  if (!contentType) return null
  return { buffer, contentType }
}

async function guardarCard(ctx: Contexto, card: Card, nomeImagem: string, id: string): Promise<string> {
  const path = `planilha/${id}.${extensaoDe(nomeImagem)}`
  const { error } = await ctx.admin.storage
    .from('evento-capas')
    .upload(path, card.buffer, { contentType: card.contentType, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = ctx.admin.storage.from('evento-capas').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Baixa e guarda o card do evento. Card ausente não impede a importação — o
 * evento entra na agenda sem imagem e o card pode chegar depois.
 */
async function subirCard(
  ctx: Contexto,
  nomeImagem: string,
  itensDaPasta: { rotulo: string; id: string }[],
  chave: string
): Promise<string | null> {
  if (!nomeImagem) return null
  const card = await baixarCard(nomeImagem, itensDaPasta)
  if (!card) return null
  return guardarCard(ctx, card, nomeImagem, chave.replace(/[^a-z0-9-]/gi, '-'))
}
