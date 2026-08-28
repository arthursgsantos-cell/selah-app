'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPermissaoCelula } from '@/lib/celula-permissoes'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Frequencia, PapelCelula } from '@/lib/supabase/types'

export async function createCelulaAction(data: {
  nome: string
  descricao?: string
  rede_id: string
  frequencia?: Frequencia
  local_padrao?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: celula, error } = await supabase
    .from('celulas')
    .insert({
      nome: data.nome,
      descricao: data.descricao ?? null,
      rede_id: data.rede_id,
      frequencia: data.frequencia ?? 'semanal',
      local_padrao: data.local_padrao ?? null,
      ativa: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/supervisor')
  redirect(`/celula/${celula.id}`)
}

export async function addMembroCelulaAction(
  celulaId: string,
  userId: string,
  papel: PapelCelula
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('celula_membros')
    .upsert({ celula_id: celulaId, user_id: userId, papel }, { onConflict: 'celula_id,user_id' })
  if (error) throw new Error(error.message)
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')
}

export async function uploadLogoCelulaAction(celulaId: string, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: membro } = await supabase
    .from('celula_membros').select('papel').eq('celula_id', celulaId).eq('user_id', user.id).maybeSingle()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const canUpload = !!membro || ['admin', 'pastor', 'supervisor'].includes(profile?.role ?? '')
  if (!canUpload) throw new Error('Sem permissão')

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${celulaId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('celula-logos')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('celula-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('celulas').update({ logo_url: url }).eq('id', celulaId)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')

  return url
}


export async function uploadCapaCelulaAction(celulaId: string, formData: FormData): Promise<string> {
  await exigirPermissaoCelula(celulaId)

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `capas/${celulaId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('celula-logos')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('celula-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('celulas').update({ capa_url: url } as never).eq('id', celulaId)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')

  return url
}

export async function uploadFundoCelulaAction(celulaId: string, formData: FormData): Promise<string> {
  await exigirPermissaoCelula(celulaId)

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `fundos/${celulaId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('celula-logos')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('celula-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('celulas').update({ fundo_imagem_url: url } as never).eq('id', celulaId)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)

  return url
}

/**
 * Liga/desliga as cores tiradas da capa. Ao desligar, `origem` é limpa para
 * que religar volte a extrair.
 */
export async function alternarAutoCorCelulaAction(celulaId: string, ativo: boolean) {
  await exigirPermissaoCelula(celulaId)

  const admin = createAdminClient()
  const { error } = await admin
    .from('celulas')
    .update({ fundo_auto_cor: ativo, ...(ativo ? {} : { fundo_auto_cor_origem: null }) } as never)
    .eq('id', celulaId)
  if (error) throw new Error(error.message)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
}

/** Grava as cores que o navegador extraiu da capa. */
export async function salvarAutoCorCelulaAction(
  celulaId: string,
  cores: { cor: string; corSecundaria: string; origem: string }
) {
  await exigirPermissaoCelula(celulaId)

  const hex = /^#[0-9a-f]{6}$/i
  if (!hex.test(cores.cor) || !hex.test(cores.corSecundaria)) throw new Error('Cor inválida')

  const admin = createAdminClient()
  const { error } = await admin
    .from('celulas')
    .update({
      cor: cores.cor,
      cor_secundaria: cores.corSecundaria,
      fundo_tipo: 'nebula',
      fundo_auto_cor_origem: cores.origem,
    } as never)
    .eq('id', celulaId)
  if (error) throw new Error(error.message)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
}

/** A capa passa a ser a foto mais recente da galeria da própria célula. */
export async function alternarCapaAutomaticaAction(celulaId: string, ativo: boolean) {
  await exigirPermissaoCelula(celulaId)

  const admin = createAdminClient()
  const { error } = await admin
    .from('celulas')
    .update({ capa_automatica: ativo } as never)
    .eq('id', celulaId)
  if (error) throw new Error(error.message)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
}

/**
 * Galeria no fundo. Separada de `atualizarAparenciaCelulaAction` porque é uma
 * camada independente: convive com a cor, o degradê ou a nébula já escolhidos.
 */
export async function atualizarFundoGaleriaCelulaAction(
  celulaId: string,
  data: { ativo: boolean; opacidade: number }
) {
  await exigirPermissaoCelula(celulaId)

  const admin = createAdminClient()
  const { error } = await admin
    .from('celulas')
    .update({
      fundo_galeria: data.ativo,
      fundo_galeria_opacidade: Math.min(100, Math.max(0, Math.round(data.opacidade))),
    } as never)
    .eq('id', celulaId)
  if (error) throw new Error(error.message)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
}

export async function atualizarAparenciaCelulaAction(
  celulaId: string,
  data: { cor: string; cor_secundaria: string | null; fundo_tipo: string; fundo_opacidade?: number }
) {
  await exigirPermissaoCelula(celulaId)

  const hex = /^#[0-9a-f]{6}$/i
  if (!hex.test(data.cor)) throw new Error('Cor inválida')
  if (data.cor_secundaria && !hex.test(data.cor_secundaria)) throw new Error('Cor secundária inválida')
  if (!['cor', 'gradiente', 'nebula', 'imagem'].includes(data.fundo_tipo)) throw new Error('Tipo de fundo inválido')
  if (data.fundo_opacidade != null && (data.fundo_opacidade < 0 || data.fundo_opacidade > 100)) {
    throw new Error('Opacidade precisa estar entre 0 e 100')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('celulas')
    .update({
      cor: data.cor,
      cor_secundaria: data.cor_secundaria,
      fundo_tipo: data.fundo_tipo,
      ...(data.fundo_opacidade != null ? { fundo_opacidade: data.fundo_opacidade } : {}),
    } as never)
    .eq('id', celulaId)
  if (error) throw new Error(error.message)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
}

export async function editCelulaAction(data: {
  id: string
  nome: string
  descricao?: string | null
  local_padrao?: string | null
  cor?: string | null
  frequencia: Frequencia
  dia_semana?: number | null
  horario?: string | null
  /** Transferência de rede. Só cargos de gestão podem mexer. */
  rede_id?: string | null
  /** Data-alvo combinada para a próxima multiplicação. Líder também define. */
  multiplicacao_prevista?: string | null
  /**
   * Célula que gerou esta, na árvore de multiplicação. Estrutural — só quem
   * gerencia a rede mexe, mesma régua da transferência de rede.
   */
  celula_mae_id?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdminRole = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento'].includes(profile?.role ?? '')

  if (!isAdminRole) {
    const { data: membro } = await supabase
      .from('celula_membros')
      .select('papel')
      .eq('celula_id', data.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (membro?.papel !== 'lider') throw new Error('Sem permissão')
  }

  // A rede só entra no update quando quem edita é da gestão: um líder pode
  // ajustar o nome e o horário da própria célula, mas não movê-la de rede.
  const { data: celulaAtual } = await supabase
    .from('celulas')
    .select('rede_id')
    .eq('id', data.id)
    .single()

  const redeAnterior = (celulaAtual as { rede_id: string } | null)?.rede_id ?? null
  // `celulas.rede_id` é NOT NULL: uma célula sempre pertence a alguma rede.
  // Por isso a troca só vale com um destino de verdade.
  const redeDestino =
    isAdminRole && data.rede_id && data.rede_id !== redeAnterior ? data.rede_id : null

  // Estrutural, mesma régua da rede: só quem gerencia decide a linhagem.
  if (data.celula_mae_id !== undefined && !isAdminRole) {
    throw new Error('Sem permissão para definir a célula-mãe.')
  }
  // Uma célula não pode ser mãe de si mesma — a árvore quebraria num ciclo
  // de um nó só.
  if (data.celula_mae_id === data.id) {
    throw new Error('Uma célula não pode ser mãe de si mesma.')
  }

  const { error } = await supabase
    .from('celulas')
    .update({
      nome: data.nome,
      // Quem salva o nome pela tela de edição batizou a célula: o rótulo
      // provisório da multiplicação não sobrevive a isso.
      nome_provisorio: false,
      descricao: data.descricao ?? null,
      local_padrao: data.local_padrao ?? null,
      cor: data.cor ?? null,
      frequencia: data.frequencia,
      dia_semana: data.dia_semana ?? null,
      horario: data.horario ?? null,
      ...(redeDestino ? { rede_id: redeDestino } : {}),
      ...(data.multiplicacao_prevista !== undefined
        ? { multiplicacao_prevista: data.multiplicacao_prevista }
        : {}),
      ...(isAdminRole && data.celula_mae_id !== undefined
        ? { celula_mae_id: data.celula_mae_id }
        : {}),
    })
    .eq('id', data.id)

  if (error) throw new Error(error.message)
  revalidatePath('/celula')
  revalidatePath(`/celula/${data.id}`)
  revalidatePath('/supervisor')
  // O painel do pastor mostra os alertas de multiplicação da igreja inteira,
  // então qualquer edição de célula pode mudar o que aparece lá — não só a
  // transferência de rede.
  revalidatePath('/pastor')
  // As duas páginas de rede mudam de conteúdo: a célula sai de uma e entra na
  // outra.
  if (redeDestino) {
    if (redeAnterior) revalidatePath(`/rede/${redeAnterior}`)
    revalidatePath(`/rede/${redeDestino}`)
  }
}

export async function deleteCelulaAction(celulaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const canDelete = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento'].includes(profile?.role ?? '')
  if (!canDelete) throw new Error('Sem permissão')

  const { error } = await supabase.from('celulas').delete().eq('id', celulaId)
  if (error) throw new Error(error.message)
  revalidatePath('/supervisor')
  redirect('/supervisor')
}

export async function removeMembroCelulaAction(celulaId: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('celula_membros')
    .delete()
    .eq('celula_id', celulaId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')
}
