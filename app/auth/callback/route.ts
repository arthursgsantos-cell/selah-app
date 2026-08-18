import { createClient } from '@/lib/supabase/server'
import { caminhoDepoisDeEntrar, destinoInterno } from '@/lib/auth/pos-login'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const destino = destinoInterno(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Redefinição de senha: a pessoa precisa chegar ao formulário antes de
      // qualquer outra coisa — inclusive antes do onboarding, já que sem senha
      // nova ela não volta a entrar.
      if (destino === '/redefinir-senha') {
        return NextResponse.redirect(new URL(destino, origin))
      }

      const caminho = await caminhoDepoisDeEntrar(supabase, destino)
      if (caminho) return NextResponse.redirect(new URL(caminho, origin))
    }
  }

  return NextResponse.redirect(new URL('/login?erro=auth', origin))
}
