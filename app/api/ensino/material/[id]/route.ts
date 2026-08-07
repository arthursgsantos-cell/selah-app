import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET_MATERIAIS } from '@/lib/ensino/tipos'

/** A URL assinada vive o suficiente para o download começar, e não mais. */
const VALIDADE_SEGUNDOS = 60

/**
 * Entrega um material do bucket privado.
 *
 * A autorização não é reimplementada aqui: a consulta usa o cliente do
 * usuário, então a policy `ensino_materiais_select` é quem decide. Se a pessoa
 * não está inscrita e o material não é público, a linha simplesmente não
 * aparece — e sem a linha não há `arquivo_path` para assinar.
 *
 * Dois modos, e a diferença importa:
 *
 * - padrão: redireciona para a URL assinada com `download`, que manda o
 *   navegador salvar o arquivo;
 * - `?modo=ver`: devolve o próprio conteúdo, com `Content-Disposition: inline`,
 *   para o visualizador embutido do app. Aqui o arquivo passa pelo servidor em
 *   vez de redirecionar de propósito — o `<iframe>` do diálogo continua na
 *   mesma origem, e o PDF abre dentro do app em vez de virar outra aba.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ erro: 'Faça login para acessar o material.' }, { status: 401 })
  }

  const { data: material } = await supabase
    .from('ensino_materiais')
    .select('id, titulo, tipo, url, arquivo_path, arquivo_nome')
    .eq('id', params.id)
    .maybeSingle()

  if (!material) {
    return NextResponse.json(
      { erro: 'Material indisponível ou você não está inscrito nesta turma.' },
      { status: 404 }
    )
  }

  // Link e vídeo não passam pelo bucket.
  if (material.tipo !== 'arquivo') {
    if (!material.url) {
      return NextResponse.json({ erro: 'Material sem endereço.' }, { status: 404 })
    }
    return NextResponse.redirect(material.url)
  }

  if (!material.arquivo_path) {
    return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })
  }

  const paraVer = request.nextUrl.searchParams.get('modo') === 'ver'
  const admin = createAdminClient()

  const { data: assinado, error } = await admin.storage
    .from(BUCKET_MATERIAIS)
    .createSignedUrl(
      material.arquivo_path,
      VALIDADE_SEGUNDOS,
      paraVer ? undefined : { download: material.arquivo_nome ?? true }
    )

  if (error || !assinado) {
    return NextResponse.json({ erro: 'Não foi possível abrir o arquivo.' }, { status: 500 })
  }

  if (!paraVer) return NextResponse.redirect(assinado.signedUrl)

  const arquivo = await fetch(assinado.signedUrl)
  if (!arquivo.ok || !arquivo.body) {
    return NextResponse.json({ erro: 'Não foi possível abrir o arquivo.' }, { status: 502 })
  }

  return new NextResponse(arquivo.body, {
    headers: {
      'Content-Type': arquivo.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(material.arquivo_nome ?? 'material')}"`,
      // Material de turma não vai para cache compartilhado: a URL é a mesma
      // para todo mundo, mas o direito de ver não é.
      'Cache-Control': 'private, no-store',
    },
  })
}
