import { resolvedorDeCelulas, type Resolvedor } from './destinos'
import {
  acharIdDaSubpasta,
  acharIdsDasSubpastas,
  acharIdDoArquivo,
  baixarArquivo,
  extensaoDe,
  hashDoConteudo,
  idDoLinkDrive,
  subpastasDe,
  tipoDaImagem,
  type ArquivoDrive,
} from './drive'
import { acharAba, celula, coluna } from './planilha'
import {
  apagarRegistro,
  carregarRegistros,
  chaveProvisoria,
  registrar,
  resultadoVazio,
  type Contexto,
  type LinhaImportacao,
  type ResultadoImportacao,
} from './registro'
import { dataHoraPublicacao, normalizarNome } from './texto'

/**
 * Importa as fotos das células para a galeria da comunidade.
 *
 * Chave de dedup: **hash SHA-256 do conteúdo**. Uma cópia idêntica com outro
 * nome é ignorada; duas fotos diferentes da mesma célula entram as duas.
 *
 * Célula que a planilha cita e que não existe no banco vira **pendência** —
 * nunca uma célula nova. Um erro de digitação criaria célula fantasma.
 */

const ASSINATURA = ['Nome do arquivo', 'Quem publicou', 'Nome da célula']

/** Subpasta do Drive onde as fotos são despejadas. */
const PASTA = 'Fotos das Células'

export async function importarFotosDeCelula(ctx: Contexto): Promise<ResultadoImportacao> {
  const resultado = resultadoVazio()

  const aba = acharAba(ctx.abas, ASSINATURA)
  if (!aba) {
    resultado.erros.push({
      arquivo: PASTA,
      motivo: `Nenhuma aba da planilha tem as colunas de fotos (${ASSINATURA.join(', ')}).`,
    })
    return resultado
  }

  const idxArquivo = coluna(aba, 'Nome do arquivo')
  const idxCelula = coluna(aba, 'Nome da célula')
  const idxData = coluna(aba, 'Data e hora da publicação (Brasília)', 'Data e hora')
  const idxLink = coluna(aba, 'Link da imagem')

  const raiz = await ctx.listar(ctx.pastaRaiz)
  const pastaFotos = acharIdDaSubpasta(raiz, PASTA)
  if (!pastaFotos) {
    resultado.erros.push({
      arquivo: PASTA,
      motivo: `A subpasta "${PASTA}" não foi encontrada na pasta compartilhada do Drive.`,
    })
    return resultado
  }
  const itensDaPasta = await ctx.listar(pastaFotos)

  const registros = await carregarRegistros(ctx, 'foto_celula')
  const porChave = new Map(registros.map((r) => [r.chave, r]))
  const porArquivo = indexarPorArquivo(registros)

  const acharCelula = await resolvedorDeCelulas(ctx)

  for (const linha of aba.linhas) {
    const nome = celula(linha, idxArquivo)
    if (!nome) continue
    const nomeCelula = celula(linha, idxCelula)

    // Já resolvido numa execução anterior: não vale baixar a imagem de novo só
    // para recalcular um hash que já conhecemos. Só a célula da linha ainda
    // pode mudar, e isso se resolve sem tocar no arquivo.
    const anterior = porArquivo.get(nome)
    if (anterior && (anterior.status === 'importado' || anterior.status === 'ignorado')) {
      try {
        const mudou = await reatribuir(ctx, anterior, nomeCelula, acharCelula)
        if (mudou) resultado.atualizados.push(nome)
        else resultado.ignorados.push(nome)
      } catch (e) {
        resultado.erros.push({
          arquivo: nome,
          motivo: e instanceof Error ? e.message : 'erro desconhecido',
        })
      }
      continue
    }

    const destino = acharCelula(nomeCelula)
    if (!destino) {
      const motivo = nomeCelula
        ? `Célula "${nomeCelula}" não existe. Cadastre a célula ou adicione a grafia em celula_apelidos.`
        : 'A linha não informa a célula.'
      resultado.pendentes.push({ arquivo: nome, motivo })
      await registrar(ctx, {
        tipo: 'foto_celula',
        chave: chaveProvisoria(nome),
        status: 'pendente',
        arquivoNome: nome,
        grupoOrigem: nomeCelula || null,
        motivo,
      })
      continue
    }

    try {
      // A planilha pode trazer o link direto do arquivo ("Copiar link" no
      // Drive) — ele aponta o arquivo exato, sem depender do nome bater com o
      // rótulo do Drive nem de vasculhar pasta por pasta. Só cai na busca por
      // nome quando a linha não tem link (planilha antiga).
      const fileId =
        idDoLinkDrive(celula(linha, idxLink)) ??
        (await acharFoto(ctx, itensDaPasta, nome, [nomeCelula, destino.nome]))
      if (!fileId) {
        throw new Error(
          `Arquivo não encontrado em "${PASTA}" nem na subpasta da célula, e a coluna "Link da imagem" está vazia.`
        )
      }

      const buffer = await baixarArquivo(fileId)
      const contentType = tipoDaImagem(buffer)
      if (!contentType) throw new Error(motivoNaoImagem(buffer))

      const hash = await hashDoConteudo(buffer)

      const jaExiste = porChave.get(hash)
      if (jaExiste && jaExiste.status === 'importado') {
        const motivo = `Cópia idêntica de "${jaExiste.arquivo_nome ?? 'foto já importada'}"`
        resultado.ignorados.push(nome)
        await registrar(ctx, {
          tipo: 'foto_celula',
          chave: chaveProvisoria(nome),
          status: 'ignorado',
          arquivoNome: nome,
          celulaId: destino.id,
          grupoOrigem: nomeCelula || null,
          motivo,
        })
        continue
      }

      const path = `planilha/${hash}.${extensaoDe(nome)}`
      const { error: erroUpload } = await ctx.admin.storage
        .from('fotos-comunidade')
        .upload(path, buffer, { contentType, upsert: true })
      if (erroUpload) throw new Error(erroUpload.message)

      const { data: { publicUrl } } = ctx.admin.storage.from('fotos-comunidade').getPublicUrl(path)

      const { data: inserida, error: erroInsert } = await ctx.admin
        .from('fotos_comunidade')
        .insert({
          igreja_id: ctx.igrejaId,
          celula_id: destino.id,
          url: publicUrl,
          criado_em: dataHoraPublicacao(celula(linha, idxData)),
        } as never)
        .select('id')
        .single()
      if (erroInsert) throw new Error(erroInsert.message)

      const registroId = (inserida as { id: string } | null)?.id ?? null

      await registrar(ctx, {
        tipo: 'foto_celula',
        chave: hash,
        status: 'importado',
        arquivoNome: nome,
        celulaId: destino.id,
        destino: 'fotos_comunidade',
        grupoOrigem: nomeCelula || null,
        registroId,
      })

      // A pendência (ou o erro) da execução anterior deixou de valer.
      if (anterior) await apagarRegistro(ctx, 'foto_celula', chaveProvisoria(nome))

      porChave.set(hash, {
        tipo: 'foto_celula',
        chave: hash,
        arquivo_nome: nome,
        celula_id: destino.id,
        destino: 'fotos_comunidade',
        grupo_origem: nomeCelula || null,
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
        tipo: 'foto_celula',
        chave: chaveProvisoria(nome),
        status: 'erro',
        arquivoNome: nome,
        celulaId: destino.id,
        grupoOrigem: nomeCelula || null,
        motivo,
      })
    }
  }

  return resultado
}

/**
 * A foto pode estar solta em "Fotos das Células" ou dentro de uma subpasta com
 * o nome da célula — as duas organizações convivem na pasta compartilhada.
 */
async function acharFoto(
  ctx: Contexto,
  itensDaPasta: ArquivoDrive[],
  nomeArquivo: string,
  nomesDeSubpasta: string[]
): Promise<string | null> {
  const solto = acharIdDoArquivo(itensDaPasta, nomeArquivo)
  if (solto) return solto

  for (const nome of nomesDeSubpasta) {
    if (!nome) continue
    // Pode haver "Alpha" e "Alpha (1)": a foto está em uma das duas, então
    // vale procurar em todas antes de desistir.
    for (const subpasta of acharIdsDasSubpastas(itensDaPasta, nome)) {
      const dentro = await ctx.listar(subpasta)
      const achado = acharIdDoArquivo(dentro, nomeArquivo)
      if (achado) return achado

      // Algumas células organizam o próprio material em pastas ("Galeria",
      // "Fotos e Vídeos", "Encontros"). Vale mais um nível antes de desistir.
      for (const neta of subpastasDe(dentro)) {
        const achadoNeta = acharIdDoArquivo(await ctx.listar(neta.id), nomeArquivo)
        if (achadoNeta) return achadoNeta
      }
    }
  }

  return null
}

/**
 * A planilha é a dona do vínculo foto → célula. Quando alguém corrige a coluna
 * "Nome da célula" de uma linha já importada, a foto acompanha: antes ela ficava
 * na célula errada para sempre, porque a linha era pulada sem ser olhada.
 *
 * Não baixa nada — é só o `celula_id` da foto que muda.
 */
async function reatribuir(
  ctx: Contexto,
  anterior: LinhaImportacao,
  nomeCelula: string,
  acharCelula: Resolvedor
): Promise<boolean> {
  if (!anterior.registro_id) return false
  if (normalizarNome(anterior.grupo_origem ?? '') === normalizarNome(nomeCelula)) return false

  const destino = acharCelula(nomeCelula)
  // Grafia nova que ninguém cadastrou ainda: a foto fica onde está em vez de
  // perder a célula que já tinha.
  if (!destino || destino.id === anterior.celula_id) return false

  const { error } = await ctx.admin
    .from('fotos_comunidade')
    .update({ celula_id: destino.id } as never)
    .eq('id', anterior.registro_id)
  if (error) throw new Error(error.message)

  await registrar(ctx, {
    tipo: 'foto_celula',
    chave: anterior.chave,
    status: anterior.status,
    arquivoNome: anterior.arquivo_nome,
    celulaId: destino.id,
    destino: anterior.destino,
    grupoOrigem: nomeCelula,
    registroId: anterior.registro_id,
  })

  return true
}

/**
 * O que dizer ao pastor quando o download não é uma imagem. Vale distinguir os
 * dois casos: um é problema do arquivo, o outro é problema do compartilhamento
 * — e a mensagem única de antes ("não é uma imagem") não ajudava em nenhum.
 */
function motivoNaoImagem(buffer: ArrayBuffer): string {
  const inicio = new TextDecoder().decode(buffer.slice(0, 200)).trimStart().toLowerCase()
  if (inicio.startsWith('<')) {
    return 'o Drive devolveu uma página em vez do arquivo. Confirme que a pasta está compartilhada como "qualquer pessoa com o link".'
  }
  return 'o arquivo não é JPG, PNG, GIF nem WEBP. Vídeo e foto HEIC do iPhone não entram na galeria — converta para JPG ou tire a linha da planilha.'
}

/**
 * Uma mesma foto pode ter linhas em estados diferentes (uma pendência antiga e
 * o registro definitivo). Vale sempre o estado mais avançado.
 */
function indexarPorArquivo(registros: LinhaImportacao[]): Map<string, LinhaImportacao> {
  const ordem = { importado: 3, ignorado: 2, pendente: 1, erro: 0 } as const
  const mapa = new Map<string, LinhaImportacao>()
  for (const r of registros) {
    if (!r.arquivo_nome) continue
    const atual = mapa.get(r.arquivo_nome)
    if (!atual || ordem[r.status] > ordem[atual.status]) mapa.set(r.arquivo_nome, r)
  }
  return mapa
}
