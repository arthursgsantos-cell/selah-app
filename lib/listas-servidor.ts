/**
 * Listas dinâmicas — leitura no banco.
 *
 * Separado de `lib/listas.ts` porque aquele arquivo é importado pelo
 * construtor de listas, que roda no navegador: manter a service role fora do
 * módulo compartilhado impede que ela seja arrastada para o bundle do cliente.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { Role } from '@/lib/supabase/types'
import type { PessoaLista } from '@/lib/listas'

/** Idade em anos a partir de "AAAA-MM-DD", sem depender de fuso. */
function idadeDe(iso: string | null): number | null {
  if (!iso) return null
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - ano
  const jaFez = hoje.getMonth() + 1 > mes || (hoje.getMonth() + 1 === mes && hoje.getDate() >= dia)
  if (!jaFez) idade -= 1
  return idade >= 0 && idade < 130 ? idade : null
}

function partesData(iso: string | null): { mes: number | null; dia: number | null } {
  if (!iso) return { mes: null, dia: null }
  const [, mes, dia] = iso.split('-').map(Number)
  return { mes: mes || null, dia: dia || null }
}

/**
 * Carrega a igreja inteira — com conta e sem conta — já com célula e rede
 * resolvidas.
 *
 * Traz tudo de uma vez e deixa o filtro para a tela: são poucos milhares de
 * linhas mesmo numa igreja grande, e filtrar no cliente faz cada ajuste de
 * filtro responder na hora, sem ida ao servidor.
 */
export async function carregarPessoas(igrejaId: string): Promise<PessoaLista[]> {
  const admin = createAdminClient()

  const [{ data: perfis }, { data: preCadastros }, { data: celulas }, { data: vinculos }] =
    await Promise.all([
      admin
        .from('profiles')
        .select('id, nome, telefone, email, role, data_nascimento_1')
        .eq('igreja_id', igrejaId)
        .order('nome'),
      admin
        .from('membros_pre_cadastro')
        .select('id, nome, telefone, email, celula_id')
        .eq('igreja_id', igrejaId)
        .is('profile_id', null)
        .order('nome'),
      admin
        .from('celulas')
        .select('id, nome, rede_id, redes!inner(id, nome, igreja_id)')
        .eq('redes.igreja_id', igrejaId),
      admin.from('celula_membros').select('celula_id, user_id'),
    ])

  type CelulaRow = {
    id: string; nome: string; rede_id: string
    redes: { id: string; nome: string } | null
  }
  const celulaPorId = new Map(
    ((celulas ?? []) as unknown as CelulaRow[]).map((c) => [c.id, c])
  )

  // Uma pessoa pode estar em mais de uma célula; a lista mostra a primeira.
  // Duplicar a linha faria a mesma pessoa receber a mensagem duas vezes.
  const celulaDoUsuario = new Map<string, string>()
  for (const v of (vinculos ?? []) as { celula_id: string; user_id: string }[]) {
    if (!celulaDoUsuario.has(v.user_id) && celulaPorId.has(v.celula_id)) {
      celulaDoUsuario.set(v.user_id, v.celula_id)
    }
  }

  const pessoas: PessoaLista[] = []

  for (const p of (perfis ?? []) as {
    id: string; nome: string; telefone: string | null; email: string | null
    role: Role; data_nascimento_1: string | null
  }[]) {
    const celulaId = celulaDoUsuario.get(p.id) ?? null
    const celula = celulaId ? celulaPorId.get(celulaId) ?? null : null
    const { mes, dia } = partesData(p.data_nascimento_1)
    pessoas.push({
      chave: `profile:${p.id}`,
      nome: p.nome,
      telefone: p.telefone,
      email: p.email,
      role: p.role,
      temConta: true,
      celulaId,
      celulaNome: celula?.nome ?? null,
      redeId: celula?.redes?.id ?? null,
      redeNome: celula?.redes?.nome ?? null,
      mesAniversario: mes,
      diaAniversario: dia,
      idade: idadeDe(p.data_nascimento_1),
    })
  }

  for (const p of (preCadastros ?? []) as {
    id: string; nome: string; telefone: string | null; email: string | null
    celula_id: string | null
  }[]) {
    const celula = p.celula_id ? celulaPorId.get(p.celula_id) ?? null : null
    pessoas.push({
      chave: `pre:${p.id}`,
      nome: p.nome,
      telefone: p.telefone,
      email: p.email,
      role: null,
      temConta: false,
      celulaId: p.celula_id,
      celulaNome: celula?.nome ?? null,
      redeId: celula?.redes?.id ?? null,
      redeNome: celula?.redes?.nome ?? null,
      mesAniversario: null,
      diaAniversario: null,
      idade: null,
    })
  }

  return pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
