import { dataLocalIso } from '@/lib/dia-semana'
import { resolvedorDeCelulas, type Alvo } from './destinos'
import {
  acharIdDaSubpasta,
  acharIdDoArquivo,
  baixarArquivo,
  extensaoDe,
  tipoDaImagem,
  type ArquivoDrive,
} from './drive'
import { acharAba, celula as campo, coluna, type Aba } from './planilha'
import {
  registrar,
  resultadoVazio,
  type Contexto,
  type ResultadoImportacao,
} from './registro'
import { dataHoraEncontro, normalizarNome, slug } from './texto'

/**
 * Importa, das duas abas que a planilha mantém para a célula Cais:
 *
 *   1. o **card de informações do encontro** (data, horário, local, endereço,
 *      avisos e a imagem do convite) → `encontros`
 *   2. a **lista de lanche** daquele encontro → `lanches`
 *
 * A planilha não diz de qual célula a aba é: as duas abas são da Cais e só
 * dela. Mesmo assim a célula é resolvida pelo nome (nunca por id fixo), então
 * um `celula_apelidos` novo continua funcionando sem tocar no código.
 *
 * Regra de conflito: a planilha **só preenche o que está vazio**. Local, avisos,
 * card e responsável pelo item que já foram mexidos no app ficam como estão —
 * quem se ofereceu para levar alguma coisa nunca é desmarcado por uma
 * sincronização.
 *
 * Chaves de dedup em `importacoes`:
 *   encontro_celula → "<celula_id>@<AAAA-MM-DD>"
 *   lanche          → "<encontro_id>#<slug do item>"
 */

/** Célula dona das duas abas. Resolvido por nome/apelido, não por id. */
const CELULA = 'Cais'

const ASSINATURA_ENCONTROS = ['Data do encontro', 'Nome do encontro', 'Local', 'Nome da imagem']
const ASSINATURA_LANCHE = ['Data do encontro', 'Item do lanche', 'Quem vai levar']

/** Subpastas do Drive onde o convite da célula pode ter caído. */
const PASTAS_DO_CARD = ['Encontros das Células', 'Eventos', 'Fotos das Células']

export type ResultadoCelula = {
  encontros: ResultadoImportacao
  lanches: ResultadoImportacao
}

type EncontroExistente = {
  id: string
  data_hora: string
  local: string | null
  avisos: string | null
  card_imagem_url: string | null
  status: string
}

type LancheExistente = {
  id: string
  emoji: string | null
  item: string
  responsavel: string | null
  responsavel_id: string | null
  ordem: number
}

export async function importarEncontrosDaCelula(ctx: Contexto): Promise<ResultadoCelula> {
  const encontros = resultadoVazio()
  const lanches = resultadoVazio()

  const abaEncontros = acharAba(ctx.abas, ASSINATURA_ENCONTROS)
  const abaLanche = acharAba(ctx.abas, ASSINATURA_LANCHE)

  if (!abaEncontros && !abaLanche) {
    encontros.erros.push({
      arquivo: CELULA,
      motivo: `Nenhuma aba da planilha tem as colunas de encontro (${ASSINATURA_ENCONTROS.join(', ')}) nem as de lanche (${ASSINATURA_LANCHE.join(', ')}).`,
    })
    return { encontros, lanches }
  }

  const acharCelula = await resolvedorDeCelulas(ctx)
  const alvo = acharCelula(CELULA)
  if (!alvo) {
    const motivo = `Célula "${CELULA}" não existe. Cadastre a célula ou adicione a grafia em celula_apelidos.`
    encontros.pendentes.push({ arquivo: CELULA, motivo })
    await registrar(ctx, {
      tipo: 'encontro_celula',
      chave: `celula:${slug(CELULA)}`,
      status: 'pendente',
      grupoOrigem: CELULA,
      motivo,
    })
    return { encontros, lanches }
  }

  const { data: dadosCelula } = await ctx.admin
    .from('celulas')
    .select('horario')
    .eq('id', alvo.id)
    .maybeSingle()
  const horarioPadrao = (dadosCelula as { horario: string | null } | null)?.horario ?? null

  const { data: linhasEncontro } = await ctx.admin
    .from('encontros')
    .select('id, data_hora, local, avisos, card_imagem_url, status')
    .eq('celula_id', alvo.id)

  // Um encontro por dia: é assim que a célula funciona e é o que permite casar
  // a linha da planilha com o encontro que já existe no app.
  const porData = new Map<string, EncontroExistente>()
  for (const e of (linhasEncontro ?? []) as EncontroExistente[]) {
    porData.set(dataLocalIso(e.data_hora), e)
  }

  if (abaEncontros) {
    await importarCards(ctx, abaEncontros, alvo, horarioPadrao, porData, encontros)
  }

  if (abaLanche) {
    await importarLanches(ctx, abaLanche, alvo, horarioPadrao, porData, lanches)
  }

  return { encontros, lanches }
}

// ============================================================
// Card de informações do encontro
// ============================================================

async function importarCards(
  ctx: Contexto,
  aba: Aba,
  alvo: Alvo,
  horarioPadrao: string | null,
  porData: Map<string, EncontroExistente>,
  resultado: ResultadoImportacao
): Promise<void> {
  const idx = {
    data: coluna(aba, 'Data do encontro'),
    nome: coluna(aba, 'Nome do encontro'),
    horario: coluna(aba, 'Horário'),
    local: coluna(aba, 'Local'),
    endereco: coluna(aba, 'Endereço/Localização', 'Endereço'),
    informacoes: coluna(aba, 'Informações'),
    imagem: coluna(aba, 'Nome da imagem'),
    link: coluna(aba, 'Link do arquivo'),
    status: coluna(aba, 'Status'),
  }

  for (const linha of aba.linhas) {
    const dataTexto = campo(linha, idx.data)
    const nome = campo(linha, idx.nome) || `Encontro da célula ${alvo.nome}`
    const imagem = campo(linha, idx.imagem)

    const dataHora = dataHoraEncontro(dataTexto, campo(linha, idx.horario), horarioPadrao)
    if (!dataHora) {
      const motivo = `Não entendi a data "${dataTexto}" do encontro.`
      resultado.pendentes.push({ arquivo: nome, motivo })
      await registrar(ctx, {
        tipo: 'encontro_celula',
        chave: `${alvo.id}@sem-data:${slug(nome)}`,
        status: 'pendente',
        arquivoNome: imagem || null,
        celulaId: alvo.id,
        grupoOrigem: nome,
        motivo,
      })
      continue
    }

    const dataIso = dataHora.slice(0, 10)
    const chave = `${alvo.id}@${dataIso}`

    const dados = {
      local: montarLocal(campo(linha, idx.local), campo(linha, idx.endereco)),
      avisos: valorUtil(campo(linha, idx.informacoes)),
      status: statusDoEncontro(campo(linha, idx.status)),
      imagem,
      link: campo(linha, idx.link),
    }

    try {
      const existente = porData.get(dataIso)

      if (existente) {
        const patch: Record<string, unknown> = {}
        if (!existente.local && dados.local) patch.local = dados.local
        if (!existente.avisos && dados.avisos) patch.avisos = dados.avisos

        // Status nunca regride: a planilha pode confirmar que aconteceu ou que
        // foi cancelado, mas não devolve um encontro já realizado para agendado.
        if (dados.status && existente.status === 'agendado') patch.status = dados.status

        if (!existente.card_imagem_url) {
          const url = await subirCard(ctx, dados.link, dados.imagem, alvo.nome, chave)
          if (url) patch.card_imagem_url = url
        }

        if (Object.keys(patch).length > 0) {
          const { error } = await ctx.admin.from('encontros').update(patch as never).eq('id', existente.id)
          if (error) throw new Error(error.message)
          Object.assign(existente, patch)
          resultado.atualizados.push(nome)
        } else {
          resultado.ignorados.push(nome)
        }

        await registrar(ctx, {
          tipo: 'encontro_celula',
          chave,
          status: 'importado',
          arquivoNome: dados.imagem || null,
          celulaId: alvo.id,
          destino: 'encontros',
          grupoOrigem: nome,
          registroId: existente.id,
        })
        continue
      }

      const url = await subirCard(ctx, dados.link, dados.imagem, alvo.nome, chave)

      const { data: criado, error } = await ctx.admin
        .from('encontros')
        .insert({
          celula_id: alvo.id,
          data_hora: dataHora,
          local: dados.local || null,
          avisos: dados.avisos || null,
          card_imagem_url: url,
          status: dados.status ?? 'agendado',
        } as never)
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      const registroId = (criado as { id: string } | null)?.id ?? null

      porData.set(dataIso, {
        id: registroId!,
        data_hora: dataHora,
        local: dados.local || null,
        avisos: dados.avisos || null,
        card_imagem_url: url,
        status: dados.status ?? 'agendado',
      })

      await registrar(ctx, {
        tipo: 'encontro_celula',
        chave,
        status: 'importado',
        arquivoNome: dados.imagem || null,
        celulaId: alvo.id,
        destino: 'encontros',
        grupoOrigem: nome,
        registroId,
      })

      resultado.importados.push(nome)
    } catch (e) {
      const motivo = e instanceof Error ? e.message : 'erro desconhecido'
      resultado.erros.push({ arquivo: nome, motivo })
      await registrar(ctx, {
        tipo: 'encontro_celula',
        chave,
        status: 'erro',
        arquivoNome: imagem || null,
        celulaId: alvo.id,
        grupoOrigem: nome,
        motivo,
      })
    }
  }
}

/**
 * "Salão de Festas" + "Av. Petra Kelly, 1500..." → "Salão de Festas — Av. Petra
 * Kelly, 1500...". Quando o endereço já cita o local, o local sozinho sai fora.
 */
function montarLocal(local: string, endereco: string): string {
  const a = valorUtil(local)
  const b = semRabichoDeAusencia(valorUtil(endereco))
  if (!a) return b
  if (!b) return a
  if (normalizarNome(b).includes(normalizarNome(a))) return b
  return `${a} — ${b}`
}

/**
 * Descarta a célula quando ela INTEIRA é um marcador de ausência
 * ("Não informado", "Pendente de confirmação"). Frases longas que por acaso
 * mencionam o que falta continuam valendo — são avisos de verdade.
 */
function valorUtil(texto: string): string {
  const t = texto.trim()
  if (!t) return ''
  // Compara sem acento: "confirmação" tem "çã", que `\w` não reconhece — foi
  // assim que "Pendente de confirmação" escapou e virou uma pessoa de mentira.
  const marcador =
    /^(nao (informad\w*|definid\w*|atribuid\w*)|pendente( de confirmacao)?|a confirmar|sem informacao|[-–—]{1,2}|\?)$/
  return marcador.test(normalizarNome(t)) ? '' : t
}

/** "Praia — localização exata não informada" → "Praia". */
function semRabichoDeAusencia(texto: string): string {
  return texto.replace(/\s*[—-]\s*[^—-]*n[ãa]o informad\w*\s*$/i, '').trim()
}

/** Coluna "Status" da planilha → enum `status_encontro`. `null` = não mexe. */
function statusDoEncontro(texto: string): 'realizado' | 'cancelado' | null {
  const t = normalizarNome(texto)
  if (t.startsWith('realizado')) return 'realizado'
  if (t.startsWith('cancelado')) return 'cancelado'
  return null
}

/**
 * Baixa o convite e guarda no bucket das capas de encontro.
 *
 * O id do arquivo vem da coluna "Link do arquivo" quando ela aponta para um
 * arquivo; quando aponta para uma pasta (ou está vazia), o convite é procurado
 * pelo nome nas subpastas conhecidas. Card ausente não impede a importação.
 */
async function subirCard(
  ctx: Contexto,
  link: string,
  nomeImagem: string,
  nomeCelula: string,
  chave: string
): Promise<string | null> {
  const fileId = await acharCard(ctx, link, nomeImagem, nomeCelula)
  if (!fileId) return null

  const buffer = await baixarArquivo(fileId)
  const contentType = tipoDaImagem(buffer)
  if (!contentType) return null

  const path = `planilha/${chave.replace(/[^a-z0-9-]/gi, '-')}.${extensaoDe(nomeImagem)}`
  const { error } = await ctx.admin.storage
    .from('encontro-capas')
    .upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = ctx.admin.storage.from('encontro-capas').getPublicUrl(path)
  return data.publicUrl
}

async function acharCard(
  ctx: Contexto,
  link: string,
  nomeImagem: string,
  nomeCelula: string
): Promise<string | null> {
  const doLink = idDoArquivoNoLink(link)
  if (doLink) return doLink

  if (!nomeImagem) return null

  const pastas: string[] = []
  const doFolder = idDaPastaNoLink(link)
  if (doFolder) pastas.push(doFolder)

  const raiz = await ctx.listar(ctx.pastaRaiz)
  const solto = acharIdDoArquivo(raiz, nomeImagem)
  if (solto) return solto

  for (const nome of PASTAS_DO_CARD) {
    const id = acharIdDaSubpasta(raiz, nome)
    if (id) pastas.push(id)
  }

  for (const pasta of pastas) {
    let itens: ArquivoDrive[]
    try {
      itens = await ctx.listar(pasta)
    } catch {
      continue
    }

    const achado = acharIdDoArquivo(itens, nomeImagem) ?? acharPorPrefixo(itens, nomeImagem)
    if (achado) return achado

    // "Fotos das Células" guarda uma subpasta por célula.
    const subpasta = acharIdDaSubpasta(itens, nomeCelula)
    if (subpasta) {
      const dentro = await ctx.listar(subpasta)
      const naSubpasta = acharIdDoArquivo(dentro, nomeImagem) ?? acharPorPrefixo(dentro, nomeImagem)
      if (naSubpasta) return naSubpasta
    }
  }

  return null
}

/**
 * Reserva para quando a planilha e o Drive discordam do nome depois da data:
 * a planilha descreve o encontro ("cais_2026-08-08_cais-de-rebeka-e-jonathan")
 * e o Drive numera ("cais_2026-08-08_01"). O prefixo até a data é o que os dois
 * concordam, então ele é encurtado um trecho por vez até casar.
 *
 * Para em "célula_data" (dois trechos): um prefixo mais curto seria só o nome
 * da célula e pegaria o convite de qualquer outro dia.
 */
function acharPorPrefixo(itens: ArquivoDrive[], nomeImagem: string): string | null {
  const partes = normalizarNome(nomeImagem.replace(/\.[^.]+$/, '')).split('_')

  for (let corte = partes.length - 1; corte >= 2; corte--) {
    const prefixo = `${partes.slice(0, corte).join('_')}_`
    const achado = itens.find((i) => normalizarNome(i.rotulo).startsWith(prefixo))
    if (achado) return achado.id
  }

  return null
}

/** ".../file/d/<ID>/view" ou "...?id=<ID>" → ID. */
function idDoArquivoNoLink(link: string): string | null {
  return (
    /\/file\/d\/([a-zA-Z0-9_-]{20,})/.exec(link)?.[1] ??
    /[?&]id=([a-zA-Z0-9_-]{20,})/.exec(link)?.[1] ??
    null
  )
}

/** ".../drive/folders/<ID>" → ID. */
function idDaPastaNoLink(link: string): string | null {
  return /\/folders\/([a-zA-Z0-9_-]{20,})/.exec(link)?.[1] ?? null
}

// ============================================================
// Lista de lanche
// ============================================================

async function importarLanches(
  ctx: Contexto,
  aba: Aba,
  alvo: Alvo,
  horarioPadrao: string | null,
  porData: Map<string, EncontroExistente>,
  resultado: ResultadoImportacao
): Promise<void> {
  const idx = {
    data: coluna(aba, 'Data do encontro'),
    item: coluna(aba, 'Item do lanche', 'Item'),
    quem: coluna(aba, 'Quem vai levar'),
  }

  const pessoas = await catalogoDePessoas(ctx, alvo.id)
  const itensPorEncontro = new Map<string, LancheExistente[]>()

  for (const linha of aba.linhas) {
    const item = campo(linha, idx.item)
    if (!item) continue

    const dataTexto = campo(linha, idx.data)
    const dataHora = dataHoraEncontro(dataTexto, '', horarioPadrao)
    const dataIso = dataHora?.slice(0, 10) ?? null

    const encontro = dataIso ? porData.get(dataIso) : undefined
    if (!encontro) {
      const motivo = dataIso
        ? `Não há encontro da célula ${alvo.nome} em ${dataTexto} para pendurar o lanche.`
        : `Não entendi a data "${dataTexto}" da lista de lanche.`
      resultado.pendentes.push({ arquivo: item, motivo })
      await registrar(ctx, {
        tipo: 'lanche',
        chave: `${alvo.id}@${dataIso ?? 'sem-data'}#${slug(item)}`,
        status: 'pendente',
        celulaId: alvo.id,
        grupoOrigem: dataTexto,
        motivo,
      })
      continue
    }

    const chave = `${encontro.id}#${slug(item)}`

    try {
      if (!itensPorEncontro.has(encontro.id)) {
        const { data } = await ctx.admin
          .from('lanches')
          .select('id, emoji, item, responsavel, responsavel_id, ordem')
          .eq('encontro_id', encontro.id)
        itensPorEncontro.set(encontro.id, (data ?? []) as LancheExistente[])
      }
      const itens = itensPorEncontro.get(encontro.id)!

      const quem = await resolverQuemLeva(ctx, campo(linha, idx.quem), alvo, pessoas)
      const emoji = emojiDoItem(item)

      // O item pode já existir porque a célula digitou a lista no app antes da
      // planilha chegar: aproveitamos a linha em vez de duplicar o prato.
      const existente = itens.find((l) => normalizarNome(l.item) === normalizarNome(item))

      if (existente) {
        const patch: Record<string, unknown> = {}
        if (!existente.emoji && emoji) patch.emoji = emoji
        // Quem já se ofereceu no app nunca é trocado pela planilha.
        if (!existente.responsavel && !existente.responsavel_id && quem) {
          patch.responsavel = quem.texto
          patch.responsavel_id = quem.profileId
          patch.com_conjuge = quem.acompanhado
        }

        if (Object.keys(patch).length > 0) {
          const { error } = await ctx.admin.from('lanches').update(patch as never).eq('id', existente.id)
          if (error) throw new Error(error.message)
          Object.assign(existente, patch)
          resultado.atualizados.push(item)
        } else {
          resultado.ignorados.push(item)
        }

        await registrar(ctx, {
          tipo: 'lanche',
          chave,
          status: 'importado',
          celulaId: alvo.id,
          destino: 'lanches',
          grupoOrigem: dataTexto,
          registroId: existente.id,
        })
        continue
      }

      const ordem = itens.reduce((maior, l) => Math.max(maior, l.ordem), 0) + 1

      const { data: criado, error } = await ctx.admin
        .from('lanches')
        .insert({
          encontro_id: encontro.id,
          emoji,
          item,
          ordem,
          responsavel: quem?.texto ?? null,
          responsavel_id: quem?.profileId ?? null,
          com_conjuge: quem?.acompanhado ?? false,
        } as never)
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      const registroId = (criado as { id: string } | null)?.id ?? null

      itens.push({
        id: registroId!,
        emoji,
        item,
        responsavel: quem?.texto ?? null,
        responsavel_id: quem?.profileId ?? null,
        ordem,
      })

      await registrar(ctx, {
        tipo: 'lanche',
        chave,
        status: 'importado',
        celulaId: alvo.id,
        destino: 'lanches',
        grupoOrigem: dataTexto,
        registroId,
      })

      resultado.importados.push(item)
    } catch (e) {
      const motivo = e instanceof Error ? e.message : 'erro desconhecido'
      resultado.erros.push({ arquivo: item, motivo })
      await registrar(ctx, {
        tipo: 'lanche',
        chave,
        status: 'erro',
        celulaId: alvo.id,
        grupoOrigem: dataTexto,
        motivo,
      })
    }
  }
}

type QuemLeva = {
  /** O texto da planilha, do jeito que a célula escreveu ("Iasmin e Raul"). */
  texto: string
  /** Só quando alguém do par tem cadastro de verdade. */
  profileId: string | null
  /** Mais de uma pessoa no mesmo item — é o que o app chama de "com cônjuge". */
  acompanhado: boolean
}

/**
 * "Iasmin e Raul" → quem leva o item.
 *
 * Quem tem cadastro entra como responsável de verdade (`responsavel_id`). Quem
 * não tem vira **pré-cadastro provisório** na célula, com os dois nomes ligados
 * pelo mesmo `vinculo_casal` — assim o casal aparece junto na tela de usuários
 * e um dia vira cadastro real sem digitar nada de novo.
 */
async function resolverQuemLeva(
  ctx: Contexto,
  texto: string,
  alvo: Alvo,
  pessoas: CatalogoPessoas
): Promise<QuemLeva | null> {
  const util = valorUtil(texto)
  if (!util) return null

  const nomes = separarNomes(util)
  if (nomes.length === 0) return null

  const perfis = nomes.map((n) => pessoas.acharPerfil(n))
  const profileId = perfis.find((p) => p !== null) ?? null

  const semCadastro = nomes.filter((_, i) => perfis[i] === null)
  if (semCadastro.length > 0) {
    await pessoas.garantirPreCadastros(ctx, alvo.id, nomes, semCadastro)
  }

  return { texto: util, profileId, acompanhado: nomes.length > 1 }
}

/** "Axel, Jéssica e Caleb" → ["Axel", "Jéssica", "Caleb"] */
function separarNomes(texto: string): string[] {
  return texto
    .split(/\s*(?:,|;|\/|&|\+|\be\b)\s*/i)
    .map((n) => n.trim())
    .filter(Boolean)
}

type CatalogoPessoas = {
  acharPerfil: (nome: string) => string | null
  garantirPreCadastros: (
    ctx: Contexto,
    celulaId: string,
    grupo: string[],
    faltantes: string[]
  ) => Promise<void>
}

type PreCadastro = { id: string; nome: string; celula_id: string | null; vinculo_casal: string | null }

/** "Seu Raul" → ["seu", "raul"] */
function pedacosDoNome(nome: string): string[] {
  return normalizarNome(nome).split(/\s+/).filter(Boolean)
}

/**
 * Índice de quem já existe no app.
 *
 * O nome completo vale para a igreja inteira; um pedaço solto do nome ("Raul",
 * "Iasmin") só vale **dentro da célula**. A planilha é escrita no WhatsApp e
 * quase nunca traz o nome completo, mas um "Raul" qualquer da igreja não pode
 * herdar o lanche de outra pessoa.
 */
async function catalogoDePessoas(ctx: Contexto, celulaId: string): Promise<CatalogoPessoas> {
  const { data: perfis } = await ctx.admin
    .from('profiles')
    .select('id, nome')
    .eq('igreja_id', ctx.igrejaId)

  const { data: membros } = await ctx.admin
    .from('celula_membros')
    .select('user_id')
    .eq('celula_id', celulaId)

  const daCelula = new Set(((membros ?? []) as { user_id: string }[]).map((m) => m.user_id))

  const porNome = new Map<string, string>()
  const porPedaco = new Map<string, string>()
  for (const p of (perfis ?? []) as { id: string; nome: string }[]) {
    const nome = normalizarNome(p.nome)
    if (!porNome.has(nome)) porNome.set(nome, p.id)
    if (!daCelula.has(p.id)) continue
    for (const pedaco of pedacosDoNome(p.nome)) {
      if (!porPedaco.has(pedaco)) porPedaco.set(pedaco, p.id)
    }
  }

  const { data: pres } = await ctx.admin
    .from('membros_pre_cadastro')
    .select('id, nome, celula_id, vinculo_casal')
    .eq('igreja_id', ctx.igrejaId)

  const preCadastros = (pres ?? []) as PreCadastro[]

  function acharPreCadastro(nome: string): PreCadastro | null {
    const alvo = normalizarNome(nome)
    const exato = preCadastros.find((p) => normalizarNome(p.nome) === alvo)
    if (exato) return exato
    return (
      preCadastros.find(
        (p) => p.celula_id === celulaId && pedacosDoNome(p.nome).includes(alvo)
      ) ?? null
    )
  }

  return {
    acharPerfil(nome) {
      const alvo = normalizarNome(nome)
      return porNome.get(alvo) ?? porPedaco.get(alvo) ?? null
    },

    async garantirPreCadastros(ctx, celulaDoGrupo, grupo, faltantes) {
      // Casal só faz sentido em dupla ou mais. Reaproveita o vínculo que alguém
      // do grupo já tenha, para não desmanchar o par montado à mão.
      let vinculo: string | null = null
      if (grupo.length > 1) {
        for (const nome of grupo) {
          const existente = acharPreCadastro(nome)
          if (existente?.vinculo_casal) {
            vinculo = existente.vinculo_casal
            break
          }
        }
        if (!vinculo) vinculo = `lanche-${slug(grupo.join(' e '))}`.slice(0, 60)
      }

      for (const nome of faltantes) {
        const existente = acharPreCadastro(nome)
        if (existente) {
          const patch: Record<string, unknown> = {}
          if (!existente.celula_id) patch.celula_id = celulaDoGrupo
          if (!existente.vinculo_casal && vinculo) patch.vinculo_casal = vinculo
          if (Object.keys(patch).length > 0) {
            patch.updated_at = new Date().toISOString()
            await ctx.admin
              .from('membros_pre_cadastro')
              .update(patch as never)
              .eq('id', existente.id)
            Object.assign(existente, patch)
          }
          continue
        }

        const { data: criado } = await ctx.admin
          .from('membros_pre_cadastro')
          .insert({
            igreja_id: ctx.igrejaId,
            nome,
            celula_id: celulaDoGrupo,
            vinculo_casal: vinculo,
            status: 'pendente',
            obs: 'Provisório — criado pela lista de lanche da planilha.',
          } as never)
          .select('id')
          .single()

        // Entra no índice na hora: o mesmo nome em outro item da lista reusa
        // este pré-cadastro em vez de criar um segundo.
        preCadastros.push({
          id: (criado as { id: string } | null)?.id ?? '',
          nome,
          celula_id: celulaDoGrupo,
          vinculo_casal: vinculo,
        })
      }
    },
  }
}

/**
 * Emoji do prato, para a lista importada ficar igual à que a célula digita no
 * app. Sem correspondência o item entra sem emoji — a planilha não tem coluna
 * para isso e chutar um ícone genérico ficaria pior que nenhum.
 */
const EMOJIS: [RegExp, string][] = [
  [/caf[ée]/i, '☕'],
  [/p[ãa]o de queijo/i, '🧀'],
  [/tapioca|cuscuz/i, '🌽'],
  [/macaxeira|mandioca|aipim|batata/i, '🍠'],
  [/frango|carne|churrasc/i, '🍗'],
  [/ovo/i, '🍳'],
  [/bolo|torta/i, '🍰'],
  [/fruta|salada de fruta/i, '🍓'],
  [/sandu[ií]|p[ãa]o|misto/i, '🥪'],
  [/castanha|amendoim|petisco/i, '🥜'],
  [/biscoito|bolacha|cookie/i, '🍪'],
  [/leite|iogurte/i, '🥛'],
  [/[áa]gua/i, '💧'],
  [/suco|refrigerante|ch[áa]|bebida/i, '🥤'],
  [/salgad|coxinha|empada|esfirra/i, '🥟'],
  [/descart[áa]ve|copo|guardanapo|prato/i, '🧻'],
]

function emojiDoItem(item: string): string | null {
  return EMOJIS.find(([re]) => re.test(item))?.[1] ?? null
}
