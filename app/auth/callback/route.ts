import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const ADMIN_EMAILS = ['arthursgsantos@gmail.com']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const admin = createAdminClient()

        const { data: profile } = await admin
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (profile) {
          return NextResponse.redirect(new URL('/home', origin))
        }

        // Admin bypass: cria perfil automaticamente sem código de convite
        if (ADMIN_EMAILS.includes(user.email ?? '')) {
          let { data: igreja } = await admin
            .from('igrejas')
            .select('id')
            .limit(1)
            .single()

          if (!igreja) {
            const { data: novaIgreja } = await admin
              .from('igrejas')
              .insert({ nome: 'Minha Igreja', slug: 'minha-igreja', codigo_convite: 'admin' })
              .select('id')
              .single()
            igreja = novaIgreja
          }

          if (igreja) {
            await admin.from('profiles').insert({
              id: user.id,
              igreja_id: igreja.id,
              nome: user.user_metadata?.full_name ?? 'Admin',
              email: user.email,
              avatar_url: user.user_metadata?.avatar_url ?? null,
              role: 'pastor',
            })
          }

          return NextResponse.redirect(new URL('/home', origin))
        }

        return NextResponse.redirect(new URL('/onboarding', origin))
      }
    }
  }

  return NextResponse.redirect(new URL('/login?erro=auth', origin))
}
