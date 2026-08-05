import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const ADMIN_EMAILS = ['arthursgsantos@gmail.com']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Password reset flow — redirect to the requested page (e.g. /redefinir-senha)
      if (next !== '/home') {
        return NextResponse.redirect(new URL(next, origin))
      }

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
              .insert({ nome: 'Igreja Batista Zona Sul', slug: 'igreja-batista-zona-sul', horario_culto: 'Nove horas, 11 horas, 17 horas', codigo_convite: 'admin' })
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
