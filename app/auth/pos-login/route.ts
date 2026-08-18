import { createClient } from '@/lib/supabase/server'
import { caminhoDepoisDeEntrar, destinoInterno } from '@/lib/auth/pos-login'
import { NextResponse } from 'next/server'

/**
 * Chegada do botão nativo do Google.
 *
 * Diferente do `/auth/callback`, aqui não há `code` para trocar: o
 * `signInWithIdToken` já montou a sessão no navegador e gravou os cookies.
 * Falta só a parte que depende do servidor — consultar o perfil e, quando for
 * o caso, criá-lo — para saber se a pessoa vai para o destino pedido ou para
 * o onboarding.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const destino = destinoInterno(searchParams.get('next'))

  const supabase = await createClient()
  const caminho = await caminhoDepoisDeEntrar(supabase, destino)

  if (caminho) return NextResponse.redirect(new URL(caminho, origin))
  return NextResponse.redirect(new URL('/login?erro=auth', origin))
}
