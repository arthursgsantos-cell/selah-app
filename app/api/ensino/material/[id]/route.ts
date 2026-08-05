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
 */
export async function GET(
  _request: NextRequest,
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

  const admin = createAdminClient()
  const { data: assinado, error } = await admin.storage
    .from(BUCKET_MATERIAIS)
    .createSignedUrl(material.arquivo_path, VALIDADE_SEGUNDOS, {
      download: material.arquivo_nome ?? true,
    })

  if (error || !assinado) {
    return NextResponse.json({ erro: 'Não foi possível abrir o arquivo.' }, { status: 500 })
  }

  return NextResponse.redirect(assinado.signedUrl)
}
