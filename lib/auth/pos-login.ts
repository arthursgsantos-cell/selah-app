import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'

const ADMIN_EMAILS = ['arthursgsantos@gmail.com']

/**
 * `next` chega pela query e vai virar um redirect. Sem esta checagem,
 * `?next=https://site-falso/` faria o nosso domínio empurrar a pessoa para
 * fora logo depois de autenticar — que é o que torna um redirecionamento
 * aberto útil para phishing. `//` também sai: é URL relativa a protocolo, e o
 * navegador a trata como externa.
 */
export function destinoInterno(alvo: string | null): string | null {
  if (!alvo || !alvo.startsWith('/') || alvo.startsWith('//')) return null
  return alvo
}

/**
 * Para onde mandar quem acabou de autenticar.
 *
 * Vale para as duas portas de entrada do Google, que terminam em lugares
 * diferentes: o fluxo antigo troca um `code` no `/auth/callback`, e o botão
 * nativo já chega com a sessão montada no navegador e só passa por aqui pelo
 * `/auth/pos-login`. A decisão é a mesma nos dois casos, então mora num lugar só.
 *
 * Devolve `null` quando não há sessão — quem chama decide o que fazer.
 */
export async function caminhoDepoisDeEntrar(
  supabase: SupabaseClient<Database>,
  destino: string | null
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  // Com perfil, o destino pedido vale. Antes esta volta acontecia antes
  // da consulta ao perfil, e quem entrava pela primeira vez por um link
  // de turma caía num laço: a página exigia perfil, devolvia para o
  // login, que devolvia para a página.
  if (profile) return destino ?? '/home'

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

    return destino ?? '/home'
  }

  // Sem perfil, o onboarding vem primeiro. O destino não se perde: ficou
  // guardado no `sessionStorage` da aba (ver `lib/destino-login.ts`) e é
  // o onboarding que o entrega no fim.
  return '/onboarding'
}
