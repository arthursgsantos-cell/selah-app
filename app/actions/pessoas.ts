'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Alguém que pode ser apontado para uma função na igreja.
 *
 * Duas origens, uma lista só: quem já usa o app (`profile`) e quem está na
 * lista da igreja sem ter entrado ainda (`pre_cadastro`). Quem escolhe não
 * precisa saber dessa diferença — ela só muda o que dá para fazer depois.
 */
export interface PessoaDaIgreja {
  id: string
  tipo: 'profile' | 'pre_cadastro'
  nome: string
  avatarUrl: string | null
  /** Telefone ou e-mail — desempata dois "João Silva" na lista. */
  detalhe: string | null
}

const CARGOS_GESTAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento']

async function gestao() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  const p = profile as { role: string; igreja_id: string } | null
  if (!p || !CARGOS_GESTAO.includes(p.role)) return null
  return { userId: user.id, igrejaId: p.igreja_id }
}

function curinga(termo: string): string {
  return `%${termo.replace(/[%,()*\\]/g, ' ').trim()}%`
}

function limpar(valor: string | null | undefined): string | null {
  const t = valor?.trim()
  return t ? t : null
}

/**
 * Procura uma pessoa da igreja pelo nome, e-mail ou telefone.
 *
 * Mesma ideia da busca de professor no Ensino: perfis e pré-cadastros no mesmo
 * resultado, quem tem conta primeiro — é o cadastro mais completo dos dois. O
 * pré-cadastro já vinculado a um perfil fica de fora, senão a mesma pessoa
 * apareceria duas vezes.
 */
export async function buscarPessoasDaIgrejaAction(termo: string): Promise<PessoaDaIgreja[]> {
  const acesso = await gestao()
  if (!acesso) return []

  const busca = termo.trim()
  if (busca.length < 2) return []

  const admin = createAdminClient()
  const padrao = curinga(busca)

  const [perfisRes, preRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, nome, avatar_url, telefone, email')
      .eq('igreja_id', acesso.igrejaId)
      .or(`nome.ilike.${padrao},email.ilike.${padrao},telefone.ilike.${padrao}`)
      .order('nome')
      .limit(8),
    admin
      .from('membros_pre_cadastro')
      .select('id, nome, telefone, email')
      .eq('igreja_id', acesso.igrejaId)
      .is('profile_id', null)
      .or(`nome.ilike.${padrao},email.ilike.${padrao},telefone.ilike.${padrao}`)
      .order('nome')
      .limit(8),
  ])

  const perfis: PessoaDaIgreja[] = (
    (perfisRes.data ?? []) as {
      id: string; nome: string; avatar_url: string | null
      telefone: string | null; email: string | null
    }[]
  ).map((p) => ({
    id: p.id,
    tipo: 'profile',
    nome: p.nome,
    avatarUrl: p.avatar_url,
    detalhe: p.telefone ?? p.email ?? null,
  }))

  const pres: PessoaDaIgreja[] = (
    (preRes.data ?? []) as { id: string; nome: string; telefone: string | null; email: string | null }[]
  ).map((p) => ({
    id: p.id,
    tipo: 'pre_cadastro',
    nome: p.nome,
    avatarUrl: null,
    detalhe: p.telefone ?? p.email ?? null,
  }))

  return [...perfis, ...pres].slice(0, 10)
}

/**
 * Põe na lista da igreja alguém que o app ainda não conhece.
 *
 * Só o nome é obrigatório: quem está registrando uma multiplicação nem sempre
 * tem o contato do líder em mãos. A pessoa entra em `membros_pre_cadastro` —
 * a lista da igreja, não uma tabela da supervisão —, então passa a existir
 * para o app inteiro e é reconhecida quando ela criar a conta.
 *
 * Sem cargo: dar cargo é decisão da liderança em `/usuarios`, não efeito
 * colateral de apontar alguém como líder de uma célula nova.
 */
export async function cadastrarPessoaSemContaAction(params: {
  nome: string
  telefone?: string | null
  email?: string | null
  /** Aparece na ficha em `/usuarios`, dizendo de onde a pessoa veio. */
  obs?: string | null
}): Promise<{ ok: true; pessoa: PessoaDaIgreja } | { ok: false; erro: string }> {
  const acesso = await gestao()
  if (!acesso) return { ok: false, erro: 'Só a supervisão cadastra pessoas por aqui.' }

  const nome = params.nome.trim().replace(/\s+/g, ' ')
  if (nome.length < 2) return { ok: false, erro: 'Informe o nome da pessoa.' }

  const email = limpar(params.email)?.toLowerCase() ?? null
  const telefone = limpar(params.telefone)
  const admin = createAdminClient()

  // E-mail é identidade: se já é de alguém no app, é aquela pessoa que entra —
  // e não uma segunda ficha para o mesmo nome.
  if (email) {
    const { data: perfil } = await admin
      .from('profiles')
      .select('id, nome, avatar_url, telefone')
      .eq('igreja_id', acesso.igrejaId)
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (perfil) {
      const p = perfil as { id: string; nome: string; avatar_url: string | null; telefone: string | null }
      return {
        ok: true,
        pessoa: {
          id: p.id, tipo: 'profile', nome: p.nome, avatarUrl: p.avatar_url,
          detalhe: p.telefone ?? email,
        },
      }
    }

    const { data: pre } = await admin
      .from('membros_pre_cadastro')
      .select('id, nome, telefone')
      .eq('igreja_id', acesso.igrejaId)
      .is('profile_id', null)
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (pre) {
      const p = pre as { id: string; nome: string; telefone: string | null }
      return {
        ok: true,
        pessoa: {
          id: p.id, tipo: 'pre_cadastro', nome: p.nome, avatarUrl: null,
          detalhe: p.telefone ?? email,
        },
      }
    }
  }

  const { data: criado, error } = await admin
    .from('membros_pre_cadastro')
    .insert({
      igreja_id: acesso.igrejaId,
      nome,
      telefone,
      email,
      obs: limpar(params.obs),
      created_by: acesso.userId,
    } as never)
    .select('id')
    .single()

  if (error || !criado) {
    return { ok: false, erro: error?.message ?? 'Não foi possível cadastrar a pessoa.' }
  }

  revalidatePath('/usuarios')
  revalidatePath('/pendencias')

  return {
    ok: true,
    pessoa: {
      id: (criado as { id: string }).id,
      tipo: 'pre_cadastro',
      nome,
      avatarUrl: null,
      detalhe: telefone ?? email,
    },
  }
}
