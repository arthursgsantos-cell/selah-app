import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Importação do texto bíblico.
 *
 * A tabela `biblia_versiculos` não tem policy de escrita — nada no app pode
 * alterar o texto. Esta rota é a única porta, e ela mesma só abre para pastor
 * ou admin da igreja.
 *
 * ## O formato
 *
 * O corpo é o formato que os repositórios de Bíblia em domínio público
 * publicam — uma lista de livros, cada um com uma lista de capítulos, cada
 * capítulo uma lista de versículos:
 *
 * ```json
 * {
 *   "versao": "acf",
 *   "livros": [
 *     { "abbrev": "gn", "chapters": [["No princípio...", "E a terra..."]] }
 *   ]
 * }
 * ```
 *
 * `abbrev` casa com `biblia_livros.sigla`; a posição no array é o número do
 * capítulo e do versículo. Livro que não bater com nenhuma sigla é ignorado e
 * volta no relatório, em vez de derrubar a importação inteira — um arquivo com
 * 66 livros não deve falhar por causa de um.
 *
 * ## Por que em lotes
 *
 * Uma Bíblia tem cerca de 31 mil versículos. Um `insert` só desse tamanho
 * estoura o limite do PostgREST e o tempo da função, então entram de 2 mil em
 * 2 mil, com `upsert` — reimportar corrige o texto em vez de duplicar.
 */

export const maxDuration = 300

interface CorpoImportacao {
  versao: string
  livros: { abbrev: string; chapters: string[][] }[]
}

const LOTE = 2000

export async function POST(request: Request) {
  // Quem autoriza é o cliente do usuário: a rota só segue se o perfil de quem
  // chamou for pastor ou admin.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil || !['pastor', 'admin'].includes((perfil as { role: string }).role)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  let corpo: CorpoImportacao
  try {
    corpo = (await request.json()) as CorpoImportacao
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!corpo.versao || !Array.isArray(corpo.livros)) {
    return NextResponse.json(
      { erro: 'Envie { versao, livros: [{ abbrev, chapters }] }.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { data: versao } = await admin
    .from('biblia_versoes')
    .select('id, dominio_publico')
    .eq('id', corpo.versao)
    .maybeSingle()

  if (!versao) {
    return NextResponse.json(
      { erro: `Versão "${corpo.versao}" não existe em biblia_versoes.` },
      { status: 400 }
    )
  }

  const { data: livrosData } = await admin.from('biblia_livros').select('id, sigla, capitulos')
  const porSigla = new Map(
    ((livrosData ?? []) as { id: number; sigla: string; capitulos: number }[]).map((l) => [
      l.sigla,
      l,
    ])
  )

  const linhas: {
    versao_id: string; livro_id: number; capitulo: number; versiculo: number; texto: string
  }[] = []
  const ignorados: string[] = []

  for (const livro of corpo.livros) {
    const registro = porSigla.get((livro.abbrev ?? '').toLowerCase())
    if (!registro) {
      ignorados.push(livro.abbrev)
      continue
    }

    livro.chapters.forEach((versiculos, indiceCapitulo) => {
      versiculos.forEach((texto, indiceVersiculo) => {
        const limpo = (texto ?? '').trim()
        if (!limpo) return
        linhas.push({
          versao_id: versao.id,
          livro_id: registro.id,
          capitulo: indiceCapitulo + 1,
          versiculo: indiceVersiculo + 1,
          texto: limpo,
        })
      })
    })
  }

  if (linhas.length === 0) {
    return NextResponse.json(
      { erro: 'Nenhum versículo reconhecido.', ignorados },
      { status: 400 }
    )
  }

  let gravados = 0
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await admin
      .from('biblia_versiculos')
      .upsert(linhas.slice(i, i + LOTE), {
        onConflict: 'versao_id,livro_id,capitulo,versiculo',
      })

    if (error) {
      return NextResponse.json(
        { erro: error.message, gravados, total: linhas.length },
        { status: 500 }
      )
    }
    gravados += Math.min(LOTE, linhas.length - i)
  }

  return NextResponse.json({
    ok: true,
    versao: versao.id,
    gravados,
    livros: corpo.livros.length - ignorados.length,
    ignorados,
  })
}
