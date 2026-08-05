import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sincronizarRoteiros } from '@/lib/roteiros-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET  — usado pelo Vercel Cron. Exige o header Authorization com CRON_SECRET.
 * POST — usado pelo botão "Sincronizar agora"; exige pastor/admin logado.
 */

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')

  // A Vercel envia "Bearer <CRON_SECRET>" automaticamente nas rotas de cron
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const resultado = await sincronizarRoteiros()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido'
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 })
  }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['pastor', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })
  }

  try {
    const resultado = await sincronizarRoteiros()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido'
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 })
  }
}
