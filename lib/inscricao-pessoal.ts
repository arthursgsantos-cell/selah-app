import { baseDaPublicacao, parseCsv } from '@/lib/importacao/planilha'
import { normalizarNome } from '@/lib/importacao/texto'

/**
 * Lê a planilha de acompanhamento de um evento e devolve os dados de UMA
 * pessoa: a ficha de inscrição e os pagamentos que ela já fez.
 *
 * A planilha tem duas abas, identificadas pelo cabeçalho (nunca pelo gid, que
 * muda a cada republicação):
 *
 *   Inscritos  — uma linha por família, com o consolidado do pagamento
 *   Pagamentos — uma linha por parcela, com o link do comprovante no Drive
 *
 * O app não guarda cópia disso: a planilha é a fonte, alimentada pelo Zapia.
 */

/** A contagem e a ficha podem ficar até 5 minutos atrasadas. */
const REVALIDAR = 300

export type Pagamento = {
  data: string
  valor: string
  parcela: string
  transacao: string | null
  comprovanteUrl: string | null
  status: string
}

export type InscricaoPessoal = {
  nome: string
  email: string | null
  telefone: string | null
  conjuge: string | null
  celula: string | null
  acomodacao: string | null
  transporte: string | null
  servico: string | null
  restricaoAlimentar: string | null
  formaPagamento: string | null
  valorTotal: string | null
  valorPago: string | null
  saldo: string | null
  parcelasPagas: string | null
  parcelasRestantes: string | null
  statusPagamento: string | null
  pagamentos: Pagamento[]
}

type Aba = { cabecalho: string[]; linhas: string[][] }

async function baixar(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow', next: { revalidate: REVALIDAR } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** Baixa todas as abas da publicação. */
async function abasDaPlanilha(urlPublicada: string): Promise<Aba[]> {
  const base = baseDaPublicacao(urlPublicada)
  const html = await baixar(`${base}html`)
  const gids = [...new Set([...html.matchAll(/gid=(\d+)/g)].map((m) => m[1]))]

  const abas = await Promise.all(
    gids.map(async (gid) => {
      try {
        const texto = await baixar(`${base}?gid=${gid}&single=true&output=csv`)
        // Sem seguir o redirect o Google devolve HTML no lugar do CSV.
        if (texto.trimStart().startsWith('<')) return null
        const linhas = parseCsv(texto)
        if (linhas.length === 0) return null
        return { cabecalho: linhas[0].map(normalizarNome), linhas: linhas.slice(1) }
      } catch {
        return null
      }
    })
  )
  return abas.filter((a): a is Aba => a !== null)
}

/** Índice da coluna cujo nome contém o trecho. -1 quando não existe. */
function col(aba: Aba, ...trechos: string[]): number {
  for (const t of trechos) {
    const alvo = normalizarNome(t)
    const i = aba.cabecalho.findIndex((c) => c.includes(alvo))
    if (i >= 0) return i
  }
  return -1
}

function val(linha: string[], i: number): string {
  return i >= 0 ? (linha[i] ?? '').trim() : ''
}

/** Só os dígitos, e sem o DDI: números vêm digitados de formas diferentes. */
function soDigitos(telefone: string): string {
  const d = telefone.replace(/\D/g, '')
  return d.length > 11 ? d.slice(-11) : d
}

/**
 * A mesma pessoa aparece na planilha ora pelo e-mail, ora pelo telefone. Basta
 * um bater — exigir os dois deixaria de fora quem digitou o telefone com
 * formato diferente do cadastro.
 */
function ehAPessoa(
  identidade: { email: string | null; telefone: string | null },
  emailLinha: string,
  telefoneLinha: string
): boolean {
  const email = identidade.email?.trim().toLowerCase()
  if (email && emailLinha && emailLinha.trim().toLowerCase() === email) return true

  const tel = identidade.telefone ? soDigitos(identidade.telefone) : ''
  if (tel && telefoneLinha && soDigitos(telefoneLinha) === tel) return true

  return false
}

/**
 * `null` quando a pessoa não está na planilha ou a planilha não pôde ser lida.
 * A página trata os dois casos como "você ainda não aparece como inscrito".
 */
export async function buscarInscricao(
  urlPublicada: string,
  identidade: { email: string | null; telefone: string | null }
): Promise<InscricaoPessoal | null> {
  if (!identidade.email && !identidade.telefone) return null

  try {
    const abas = await abasDaPlanilha(urlPublicada)

    const abaInscritos = abas.find((a) => col({ ...a }, 'nome completo') >= 0)
    if (!abaInscritos) return null

    const idx = {
      nome: col(abaInscritos, 'nome completo'),
      telefone: col(abaInscritos, 'telefone'),
      email: col(abaInscritos, 'email', 'endereco de e-mail'),
      conjuge: col(abaInscritos, 'conjuge'),
      celula: col(abaInscritos, 'qual a sua celula', 'celula'),
      acomodacao: col(abaInscritos, 'acomodacao'),
      transporte: col(abaInscritos, 'transporte'),
      servico: col(abaInscritos, 'quero servir'),
      restricao: col(abaInscritos, 'restricao alimentar'),
      forma: col(abaInscritos, 'forma de pagamento'),
      total: col(abaInscritos, 'valor total'),
      pago: col(abaInscritos, 'valor pago'),
      saldo: col(abaInscritos, 'saldo restante'),
      parcelasPagas: col(abaInscritos, 'parcelas pagas'),
      parcelasRestantes: col(abaInscritos, 'parcelas restantes'),
      status: col(abaInscritos, 'status do pagamento'),
    }

    const linha = abaInscritos.linhas.find((l) =>
      ehAPessoa(identidade, val(l, idx.email), val(l, idx.telefone))
    )
    if (!linha) return null

    // "—" é o preenchimento que a planilha usa para vazio; virar null aqui
    // evita espalhar essa convenção pela tela.
    const limpo = (v: string) => (v && v !== '—' ? v : null)

    const nome = val(linha, idx.nome)
    const telefone = val(linha, idx.telefone)

    // Aba de pagamentos: uma linha por parcela.
    //
    // A exclusão da aba de inscritos não é zelo excessivo — sem ela o casamento
    // dava errado de verdade. O cabeçalho dos inscritos tem "Parcelas pagas" e
    // "Último comprovante", que satisfazem os dois trechos procurados aqui, e
    // como ela vem primeiro na planilha era ela que o `find` devolvia. O
    // resultado: a pessoa via um único "pagamento" com o valor TOTAL da
    // inscrição e a data do envio do formulário, no lugar das parcelas reais.
    const abaPagamentos = abas.find(
      (a) => a !== abaInscritos && col(a, 'parcela') >= 0 && col(a, 'comprovante') >= 0
    )
    const pagamentos: Pagamento[] = []

    if (abaPagamentos) {
      const p = {
        nome: col(abaPagamentos, 'nome'),
        telefone: col(abaPagamentos, 'telefone'),
        data: col(abaPagamentos, 'data/hora do pagamento', 'data'),
        valor: col(abaPagamentos, 'valor'),
        parcela: col(abaPagamentos, 'parcela'),
        transacao: col(abaPagamentos, 'id da transacao'),
        comprovante: col(abaPagamentos, 'comprovante'),
        status: col(abaPagamentos, 'status'),
      }

      for (const l of abaPagamentos.linhas) {
        // A aba de pagamentos não tem e-mail: casa por telefone e, na falta
        // dele, pelo nome normalizado.
        const mesmoTelefone =
          telefone && val(l, p.telefone) && soDigitos(val(l, p.telefone)) === soDigitos(telefone)
        const mesmoNome =
          !mesmoTelefone && nome && normalizarNome(val(l, p.nome)) === normalizarNome(nome)
        if (!mesmoTelefone && !mesmoNome) continue

        pagamentos.push({
          data: val(l, p.data),
          valor: val(l, p.valor),
          parcela: val(l, p.parcela),
          transacao: limpo(val(l, p.transacao)),
          comprovanteUrl: limpo(val(l, p.comprovante)),
          status: val(l, p.status) || 'Registrado',
        })
      }
    }

    return {
      nome,
      email: limpo(val(linha, idx.email)),
      telefone: limpo(telefone),
      conjuge: limpo(val(linha, idx.conjuge)),
      celula: limpo(val(linha, idx.celula)),
      acomodacao: limpo(val(linha, idx.acomodacao)),
      transporte: limpo(val(linha, idx.transporte)),
      servico: limpo(val(linha, idx.servico)),
      restricaoAlimentar: limpo(val(linha, idx.restricao)),
      formaPagamento: limpo(val(linha, idx.forma)),
      valorTotal: limpo(val(linha, idx.total)),
      valorPago: limpo(val(linha, idx.pago)),
      saldo: limpo(val(linha, idx.saldo)),
      parcelasPagas: limpo(val(linha, idx.parcelasPagas)),
      parcelasRestantes: limpo(val(linha, idx.parcelasRestantes)),
      statusPagamento: limpo(val(linha, idx.status)),
      pagamentos,
    }
  } catch {
    return null
  }
}
