'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = ['arthursgsantos@gmail.com']

export async function criarPerfilAdmin(): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { sucesso: false, erro: 'Não autenticado.' }
  if (!ADMIN_EMAILS.includes(user.email ?? '')) return { sucesso: false, erro: 'Não autorizado.' }

  const admin = createAdminClient()

  // Verifica se já tem perfil
  const { data: perfilExistente } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (perfilExistente) return { sucesso: true }

  // Busca a primeira igreja existente
  let { data: igreja } = await admin
    .from('igrejas')
    .select('id')
    .limit(1)
    .single()

  // Se não existe nenhuma, cria uma padrão
  if (!igreja) {
    const { data: nova, error: erroIgreja } = await admin
      .from('igrejas')
      .insert({ nome: 'Igreja Batista Zona Sul', slug: 'igreja-batista-zona-sul', horario_culto: 'Nove horas, 11 horas, 17 horas', codigo_convite: 'admin' })
      .select('id')
      .single()

    if (erroIgreja || !nova) {
      console.error('[admin] erro ao criar igreja:', erroIgreja)
      return { sucesso: false, erro: `Erro ao criar igreja: ${erroIgreja?.message ?? 'desconhecido'}` }
    }
    igreja = nova
  }

  // Cria o perfil com role pastor
  const { error: erroPerfil } = await admin.from('profiles').insert({
    id: user.id,
    igreja_id: igreja.id,
    nome: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Admin',
    email: user.email,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    role: 'pastor',
  })

  if (erroPerfil) {
    console.error('[admin] erro ao criar perfil:', erroPerfil)
    return { sucesso: false, erro: `Erro ao criar perfil: ${erroPerfil.message}` }
  }

  return { sucesso: true }
}
