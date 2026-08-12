import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lerTurmaParaPlanilha, registrarNaPlanilha } from '@/lib/planilha-ensino'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Reenvia **todas** as turmas para a aba "Ensino" da planilha.
 *
 * Serve para o retroativo (turmas que já existiam antes da integração) e para
 * reconstruir a aba se ela for apagada. Como a planilha casa a linha pelo `id`
 * da turma, rodar de novo atualiza as linhas em vez de duplicá-las.
 *
 * Só pastor/admin. Mesma checagem de `app/api/roteiros/sync/route.ts`.
 */
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

  if (!process.env.ENSINO_SHEET_WEBHOOK_URL) {
    return NextResponse.json(
      { ok: false, erro: 'ENSINO_SHEET_WEBHOOK_URL não está configurada.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: turmas, error } = await admin
    .from('ensino_turmas')
    .select('id')
    .order('criado_em')

  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 })

  // Uma de cada vez: o Apps Script serializa as gravações numa trava só, e
  // disparar tudo em paralelo faria as chamadas se esperarem no servidor do
  // Google — com o risco de estourar o tempo da rota.
  let enviadas = 0
  for (const { id } of turmas ?? []) {
    const linha = await lerTurmaParaPlanilha(id)
    if (!linha) continue
    await registrarNaPlanilha(linha, 'criada', '(retroativo)')
    enviadas++
  }

  return NextResponse.json({ ok: true, turmas: turmas?.length ?? 0, enviadas })
}
