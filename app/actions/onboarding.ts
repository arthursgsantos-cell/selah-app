'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { vincularInscricoesEnsino } from '@/lib/ensino/vinculo-aluno'
import type { Role } from '@/lib/supabase/types'

export async function criarPerfilConvidado(
  nome: string
): Promise<{ sucesso: boolean; erro?: string; cargo?: Role }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sucesso: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()

  const { data: perfilExistente } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (perfilExistente) return { sucesso: true }

  // Assume igreja única (single-tenant): usa a primeira existente
  const { data: igreja } = await admin.from('igrejas').select('id').limit(1).single()
  if (!igreja) return { sucesso: false, erro: 'Nenhuma igreja cadastrada ainda.' }

  // Pré-cadastro por e-mail: se um líder já cadastrou esta pessoa definindo o
  // cargo, o perfil nasce com esse cargo em vez de "convidado".
  const email = user.email?.trim().toLowerCase() ?? null
  const { data: preCadastro } = email
    ? await admin
        .from('membros_pre_cadastro')
        .select('id, cargo, nome, telefone, celula_id, vinculo_casal')
        .eq('igreja_id', igreja.id)
        .ilike('email', email)
        .is('profile_id', null)
        .limit(1)
        .maybeSingle()
    : { data: null }

  const cargo: Role = (preCadastro?.cargo as Role | null) ?? 'convidado'

  const { error } = await admin.from('profiles').insert({
    id: user.id,
    igreja_id: igreja.id,
    nome: nome.trim(),
    email: user.email,
    telefone: preCadastro?.telefone ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    role: cargo,
  })

  if (error) return { sucesso: false, erro: `Erro ao criar perfil: ${error.message}` }

  // Marca o pré-cadastro como confirmado e vincula ao perfil recém-criado
  if (preCadastro) {
    await admin
      .from('membros_pre_cadastro')
      .update({
        profile_id: user.id,
        status: 'confirmado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', preCadastro.id)

    await aplicarPreCadastro(admin, user.id, igreja.id, preCadastro)
  }

  return { sucesso: true, cargo }
}

/**
 * Coloca a pessoa na célula definida no pré-cadastro, assume as inscrições que
 * o professor já tinha lançado no Ensino e liga o cônjuge, quando o par já
 * tiver criado a conta. O vínculo do casal é recíproco: quem chega depois
 * completa a ligação dos dois lados.
 */
async function aplicarPreCadastro(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  igrejaId: string,
  pre: { id: string; celula_id: string | null; cargo: string | null; vinculo_casal: string | null },
) {
  // Turma em que o professor a cadastrou à mão passa a ser dela, com as
  // presenças que ele já tinha registrado.
  await vincularInscricoesEnsino(admin, pre.id, userId)

  if (pre.celula_id) {
    const papel = pre.cargo === 'lider' || pre.cargo === 'lider_treinamento' ? 'lider' : 'membro'
    await admin
      .from('celula_membros')
      .upsert(
        { celula_id: pre.celula_id, user_id: userId, papel },
        { onConflict: 'celula_id,user_id' },
      )
  }

  if (!pre.vinculo_casal) return

  // O par é quem compartilha o mesmo código de vínculo e já virou perfil.
  const { data: par } = await admin
    .from('membros_pre_cadastro')
    .select('profile_id')
    .eq('igreja_id', igrejaId)
    .eq('vinculo_casal', pre.vinculo_casal)
    .not('profile_id', 'is', null)
    .neq('profile_id', userId)
    .limit(1)
    .maybeSingle()

  if (!par?.profile_id) return

  await admin.from('profiles').update({ conjuge_id: par.profile_id }).eq('id', userId)
  await admin.from('profiles').update({ conjuge_id: userId }).eq('id', par.profile_id)
}
