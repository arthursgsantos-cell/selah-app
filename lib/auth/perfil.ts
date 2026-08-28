import { createClient } from '@/lib/supabase/server'

type Resposta = { data: unknown; error: unknown }

/**
 * Carrega o perfil de quem está logado sem confundir "não tem perfil" com
 * "a consulta falhou".
 *
 * `.single()` devolve `data: null` nos dois casos, e as páginas liam esse
 * `null` como cadastro inexistente e mandavam para o onboarding. Quando o
 * token vencia no meio da renderização o PostgREST respondia 401, e quem já
 * era membro há meses via a tela de criar conta — e, ao concluí-la, disparava
 * a notificação de "novo membro entrou" para os pastores.
 *
 * Aqui o `maybeSingle` separa os dois: linha ausente vem como `null` com
 * `error` vazio, e só isso significa onboarding. Erro de verdade ganha uma
 * segunda chance depois de `getUser()`, que renova a sessão em memória; se
 * ainda assim falhar, estoura — melhor uma tela de erro do que empurrar para
 * o cadastro alguém que já tem conta.
 */
export async function carregarPerfil<R extends Resposta>(
  consulta: () => PromiseLike<R>
): Promise<R['data']> {
  const primeira = await consulta()
  if (!primeira.error) return primeira.data

  const supabase = await createClient()
  await supabase.auth.getUser()

  const segunda = await consulta()
  if (!segunda.error) return segunda.data

  const motivo = (segunda.error as { message?: string }).message ?? 'erro desconhecido'
  throw new Error(`Falha ao carregar o perfil: ${motivo}`)
}
