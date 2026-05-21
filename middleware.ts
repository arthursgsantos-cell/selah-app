import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage = path === '/login' || path === '/cadastro' || path === '/onboarding'
  const isCallback = path.startsWith('/auth/')
  const isStatic = path.startsWith('/_next') || path === '/favicon.ico' || path.includes('.')
  const isLanding = path === '/'
  // /home tem view de visitante — acessível sem login
  const isPublicPage = path === '/home'

  if (isStatic || isCallback) return supabaseResponse

  // Logado acessando landing ou login/cadastro → home
  if (user && (isLanding || path === '/login' || path === '/cadastro')) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Não logado tentando acessar área protegida → login
  if (!user && !isAuthPage && !isLanding && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\..*).*)'],
}
