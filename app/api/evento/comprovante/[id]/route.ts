import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acessoAoEvento } from '@/lib/eventos-permissoes'

/** A URL assinada vive o suficiente para a imagem carregar, e não mais. */
const VALIDADE_SEGUNDOS = 60

const BUCKET_COMPROVANTES = 'evento-comprovantes'

/**
 * Entrega o comprovante de um pagamento.
 *
 * O bucket é privado: comprovante é documento financeiro de terceiro e não
 * pode abrir para quem descobrir a URL. Quem autoriza é `acessoAoEvento` — o
 * mesmo critério que libera a tela de gestão.
 *
 * Sem `?modo=baixar`, o conteúdo passa pelo servidor com
 * `Content-Disposition: inline`, para o visualizador do app poder desenhar a
 * imagem e, na mesma origem, ler o arquivo e mandá-lo para a folha de
 * compartilhamento do celular.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient()

  const { data: pagamento } = await admin
    .from('inscricao_pagamentos')
    .select('comprovante_path, comprovante_nome, inscricoes_evento(evento_id)')
    .eq('id', params.id)
    .maybeSingle()

  const registro = pagamento as {
    comprovante_path: string | null
    comprovante_nome: string | null
    inscricoes_evento: { evento_id: string } | null
  } | null

  if (!registro?.comprovante_path || !registro.inscricoes_evento) {
    return NextResponse.json({ erro: 'Comprovante não encontrado.' }, { status: 404 })
  }

  const acesso = await acessoAoEvento(registro.inscricoes_evento.evento_id)
  if (!acesso) {
    return NextResponse.json({ erro: 'Faça login para ver o comprovante.' }, { status: 401 })
  }
  if (!acesso.pode) {
    return NextResponse.json({ erro: 'Você não gerencia este evento.' }, { status: 403 })
  }

  const baixar = request.nextUrl.searchParams.get('modo') === 'baixar'
  const nome = registro.comprovante_nome ?? 'comprovante'

  const { data: assinado, error } = await admin.storage
    .from(BUCKET_COMPROVANTES)
    .createSignedUrl(
      registro.comprovante_path,
      VALIDADE_SEGUNDOS,
      baixar ? { download: nome } : undefined
    )

  if (error || !assinado) {
    return NextResponse.json({ erro: 'Não foi possível abrir o comprovante.' }, { status: 500 })
  }

  if (baixar) return NextResponse.redirect(assinado.signedUrl)

  const arquivo = await fetch(assinado.signedUrl)
  if (!arquivo.ok || !arquivo.body) {
    return NextResponse.json({ erro: 'Não foi possível abrir o comprovante.' }, { status: 502 })
  }

  return new NextResponse(arquivo.body, {
    headers: {
      'Content-Type': arquivo.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(nome)}"`,
      // A URL é a mesma para todo mundo, mas o direito de ver não é.
      'Cache-Control': 'private, no-store',
    },
  })
}
