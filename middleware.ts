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
  // /home, a galeria e as páginas de rede e evento têm view de visitante
  const isPublicPage =
    path === '/home' || path === '/galeria' ||
    path.startsWith('/rede/') || path.startsWith('/evento/')

  if (isStatic || isCallback) return supabaseResponse

  // Logado acessando landing ou login/cadastro → home, ou o destino pedido.
  // Ignorar o `next` aqui era o que mandava para a home quem clicava num link
  // protegido, entrava, e voltava a passar pelo /login já autenticado.
  if (user && (isLanding || path === '/login' || path === '/cadastro')) {
    const pedido = request.nextUrl.searchParams.get('next')
    const destino = pedido && pedido.startsWith('/') && !pedido.startsWith('//')
      ? pedido
      : '/home'
    return NextResponse.redirect(new URL(destino, request.url))
  }

  // Não logado tentando acessar área protegida → login, guardando o destino.
  // Sem isso a pessoa entra e cai na home, tendo que procurar de novo a página
  // que pediu — o caso mais visível é o link de acompanhamento da inscrição,
  // que chega por fora do app.
  if (!user && !isAuthPage && !isLanding && !isPublicPage) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', path + request.nextUrl.search)
    return NextResponse.redirect(login)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\..*).*)'],
}
