import 'server-only'

import {
  compararDependentes,
  emparelharDuplicatas,
  sugerirMesclagem,
  type Divergencia,
  type DependenteComparavel,
} from '@/lib/familia-dependentes'
import type { createAdminClient } from '@/lib/supabase/admin'

type ClienteAdmin = ReturnType<typeof createAdminClient>

export type DependenteResumo = {
  id: number
  nome: string
  data_nascimento: string | null
  tipo: 'cônjuge' | 'filho'
  sexo: 'M' | 'F' | null
}

type LinhaDependente = DependenteResumo & {
  profile_id: string
  co_profile_id: string | null
}

const COLUNAS = 'id, profile_id, co_profile_id, nome, data_nascimento, tipo, sexo'

/** Um par de cadastros que parecem a mesma criança, mas discordam em algo. */
export type DuplicataParaConfirmar = {
  meu: DependenteResumo
  dele: DependenteResumo
  divergencias: Divergencia[]
  /** O que o sistema usaria se a pessoa apenas confirmar. */
  sugestao: { nome: string; data_nascimento: string | null; sexo: 'M' | 'F' | null }
}

export type ParDuplicado = { meu: DependenteResumo; dele: DependenteResumo }

export type AnaliseVinculo = {
  /** Idênticos dos dois lados: unifica sem perguntar nada. */
  automaticos: ParDuplicado[]
  /** Parecidos com alguma divergência: precisam do olho de quem está vinculando. */
  confirmar: DuplicataParaConfirmar[]
  /** Sem par do outro lado: continuam existindo, passam a valer para os dois. */
  compartilhar: DependenteResumo[]
  /** "Cônjuge" digitado à mão que agora vira uma conta de verdade. */
  conjugeDigitado: DependenteResumo[]
}

export type ResolucaoDuplicata = {
  meuId: number
  deleId: number
  /** false mantém os dois cadastros separados — a saída reversível. */
  mesclar: boolean
  nome?: string
  data_nascimento?: string | null
  sexo?: 'M' | 'F' | null
}

async function linhasDe(admin: ClienteAdmin, profileId: string): Promise<LinhaDependente[]> {
  const { data, error } = await admin
    .from('dependentes')
    .select(COLUNAS)
    .or(`profile_id.eq.${profileId},co_profile_id.eq.${profileId}`)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LinhaDependente[]
}

function resumir(l: LinhaDependente): DependenteResumo {
  return {
    id: l.id,
    nome: l.nome,
    data_nascimento: l.data_nascimento,
    tipo: l.tipo,
    sexo: l.sexo,
  }
}

/**
 * O que aconteceria com os cadastros de filhos se estas duas pessoas fossem
 * vinculadas agora. Roda antes do vínculo, para a tela conseguir perguntar; e
 * roda de novo na hora de aplicar, para o servidor não depender do que o
 * cliente mandou de volta.
 */
export async function analisarVinculo(
  admin: ClienteAdmin,
  euId: string,
  outroId: string
): Promise<AnaliseVinculo> {
  const [minhas, dele] = await Promise.all([linhasDe(admin, euId), linhasDe(admin, outroId)])

  const { data: perfilOutro } = await admin
    .from('profiles')
    .select('nome')
    .eq('id', outroId)
    .single()
  const { data: perfilEu } = await admin.from('profiles').select('nome').eq('id', euId).single()

  // Linhas que já valem para os dois são a mesma linha: nada a comparar.
  const compartilhadas = new Set(
    [...minhas, ...dele]
      .filter(
        (l) =>
          (l.profile_id === euId && l.co_profile_id === outroId) ||
          (l.profile_id === outroId && l.co_profile_id === euId)
      )
      .map((l) => l.id)
  )

  const meusFilhos = minhas.filter((l) => l.tipo === 'filho' && !compartilhadas.has(l.id))
  const filhosDele = dele.filter((l) => l.tipo === 'filho' && !compartilhadas.has(l.id))

  const pares = emparelharDuplicatas(meusFilhos, filhosDele)
  const pareadosMeus = new Set(pares.map((p) => p.a.id))
  const pareadosDele = new Set(pares.map((p) => p.b.id))

  const automaticos: ParDuplicado[] = []
  const confirmar: DuplicataParaConfirmar[] = []
  for (const par of pares) {
    if (par.comparacao.automatico) {
      automaticos.push({ meu: resumir(par.a), dele: resumir(par.b) })
      continue
    }
    confirmar.push({
      meu: resumir(par.a),
      dele: resumir(par.b),
      divergencias: par.comparacao.divergencias,
      sugestao: sugerirMesclagem(par.a, par.b),
    })
  }

  const compartilhar = [
    ...meusFilhos.filter((l) => !pareadosMeus.has(l.id)),
    ...filhosDele.filter((l) => !pareadosDele.has(l.id)),
  ].map(resumir)

  // O dependente tipo "cônjuge" era o substituto de uma conta que não existia.
  // Com o vínculo ele vira ruído: apareceria como um segundo aniversário da
  // mesma pessoa na aba de aniversários.
  const nomeOutro = (perfilOutro?.nome as string | undefined) ?? ''
  const nomeEu = (perfilEu?.nome as string | undefined) ?? ''
  const conjugeDigitado = [
    ...minhas.filter(
      (l) =>
        l.tipo === 'cônjuge' &&
        l.profile_id === euId &&
        ehAMesmaPessoa(l, nomeOutro)
    ),
    ...dele.filter(
      (l) =>
        l.tipo === 'cônjuge' &&
        l.profile_id === outroId &&
        ehAMesmaPessoa(l, nomeEu)
    ),
  ].map(resumir)

  return { automaticos, confirmar, compartilhar, conjugeDigitado }
}

function ehAMesmaPessoa(linha: DependenteComparavel, nomePerfil: string): boolean {
  if (!nomePerfil) return false
  return compararDependentes(linha, {
    nome: nomePerfil,
    data_nascimento: null,
    tipo: 'cônjuge',
  }).duplicado
}

/**
 * Vincula o casal e resolve os cadastros de filhos numa tacada só.
 *
 * A análise é refeita aqui dentro de propósito: o cliente diz o que fazer com
 * as divergências, mas quem decide o que é idêntico e o que sequer é par é o
 * servidor. Par que chega sem resolução fica separado — na dúvida, o sistema
 * prefere o erro que a pessoa consegue desfazer.
 */
export async function vincularCasal(
  admin: ClienteAdmin,
  euId: string,
  outroId: string,
  resolucoes: ResolucaoDuplicata[] = []
) {
  if (euId === outroId) throw new Error('Não é possível vincular a própria conta')

  await Promise.all([
    admin.from('profiles').update({ conjuge_id: outroId }).eq('id', euId),
    admin.from('profiles').update({ conjuge_id: euId }).eq('id', outroId),
  ])

  const analise = await analisarVinculo(admin, euId, outroId)

  // Idênticos: sobra a minha linha, com o cônjuge como segundo responsável.
  for (const par of analise.automaticos) {
    await mesclar(admin, par.meu, par.dele, euId, outroId, sugerirMesclagem(par.meu, par.dele))
  }

  const porChave = new Map(resolucoes.map((r) => [`${r.meuId}:${r.deleId}`, r]))
  for (const item of analise.confirmar) {
    const escolha = porChave.get(`${item.meu.id}:${item.dele.id}`)
    if (escolha?.mesclar) {
      await mesclar(admin, item.meu, item.dele, euId, outroId, {
        nome: (escolha.nome ?? item.sugestao.nome).trim() || item.sugestao.nome,
        data_nascimento:
          escolha.data_nascimento === undefined
            ? item.sugestao.data_nascimento
            : escolha.data_nascimento || null,
        sexo: escolha.sexo === undefined ? item.sugestao.sexo : escolha.sexo ?? null,
      })
      continue
    }
    // Mantidos separados: ainda assim os dois passam a enxergar os dois.
    await compartilharLinha(admin, item.meu.id, euId, outroId)
    await compartilharLinha(admin, item.dele.id, euId, outroId)
  }

  for (const dep of analise.compartilhar) {
    await compartilharLinha(admin, dep.id, euId, outroId)
  }

  if (analise.conjugeDigitado.length > 0) {
    const { error } = await admin
      .from('dependentes')
      .delete()
      .in('id', analise.conjugeDigitado.map((d) => d.id))
    if (error) throw new Error(error.message)
  }
}

/**
 * Duas linhas viram uma. Sobrevive a que estava no lado de quem vinculou; o
 * dono dela não muda — só ganha o segundo responsável — para não reescrever
 * quem cadastrou o quê no meio de uma operação de limpeza.
 */
async function mesclar(
  admin: ClienteAdmin,
  meu: DependenteResumo,
  dele: DependenteResumo,
  euId: string,
  outroId: string,
  valores: { nome: string; data_nascimento: string | null; sexo: 'M' | 'F' | null }
) {
  const { data } = await admin.from('dependentes').select('profile_id').eq('id', meu.id).single()
  const dono = data?.profile_id as string | undefined
  if (!dono) return
  const co = dono === euId ? outroId : euId

  const { error: upErr } = await admin
    .from('dependentes')
    .update({
      nome: valores.nome,
      data_nascimento: valores.data_nascimento,
      sexo: valores.sexo,
      co_profile_id: co,
    })
    .eq('id', meu.id)
  if (upErr) throw new Error(upErr.message)

  const { error: delErr } = await admin.from('dependentes').delete().eq('id', dele.id)
  if (delErr) throw new Error(delErr.message)
}

/** Marca a linha como do casal, seja qual for o lado que a cadastrou. */
async function compartilharLinha(
  admin: ClienteAdmin,
  depId: number,
  euId: string,
  outroId: string
) {
  const { data } = await admin.from('dependentes').select('profile_id').eq('id', depId).single()
  const dono = data?.profile_id as string | undefined
  if (!dono) return
  const co = dono === euId ? outroId : dono === outroId ? euId : null
  if (!co) return
  const { error } = await admin.from('dependentes').update({ co_profile_id: co }).eq('id', depId)
  if (error) throw new Error(error.message)
}

/**
 * Desfaz o vínculo. Os filhos ficam com quem os cadastrou: desfazer um vínculo
 * errado não pode virar exclusão de cadastro, e duplicar as linhas de volta
 * recriaria exatamente o problema que a mesclagem resolveu.
 */
export async function desvincularCasal(admin: ClienteAdmin, euId: string, outroId: string | null) {
  await Promise.all([
    admin.from('profiles').update({ conjuge_id: null }).eq('id', euId),
    outroId
      ? admin.from('profiles').update({ conjuge_id: null }).eq('id', outroId)
      : Promise.resolve(),
  ])

  if (!outroId) return

  await Promise.all([
    admin
      .from('dependentes')
      .update({ co_profile_id: null })
      .eq('profile_id', euId)
      .eq('co_profile_id', outroId),
    admin
      .from('dependentes')
      .update({ co_profile_id: null })
      .eq('profile_id', outroId)
      .eq('co_profile_id', euId),
  ])
}
