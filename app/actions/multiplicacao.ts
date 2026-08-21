'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { nomeProvisorioDe, juntarNomes, MAX_FILHAS } from '@/lib/multiplicacao'
import type { PessoaDaIgreja } from '@/app/actions/pessoas'

const CARGOS_GESTAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento']

/** Os líderes num texto só, para a coluna `lider_nome`. */
function nomesDeLideres(lideres: PessoaDaIgreja[] | undefined): string | null {
  return juntarNomes((lideres ?? []).map((l) => l.nome))
}

export interface FilhaNova {
  /**
   * Célula que já existe no app e passa a constar como filha desta
   * multiplicação. Quando vem preenchido, nada é criado: a célula existente é
   * que ganha a linhagem, porque duas fichas para a mesma célula é o estrago
   * que este campo evita.
   */
  celulaExistenteId?: string | null
  /** Vazio = a célula nasce com nome provisório e a árvore passa a pedir o nome. */
  nome?: string
  /**
   * Quem vai liderar, quando já está definido.
   *
   * Lista, e não um campo só: célula liderada por casal é a regra, e o líder
   * em treinamento entra junto. Vem do seletor de pessoas da igreja — perfil
   * de quem já usa o app ou ficha de quem ainda não entrou —, e não como texto
   * solto: líder digitado à mão vira um nome que o app não reconhece em lugar
   * nenhum.
   */
  lideres?: PessoaDaIgreja[]
}

export interface ResultadoMultiplicacao {
  ok: boolean
  erro?: string
  /** Ids das células criadas, na ordem em que foram informadas. */
  criadas?: string[]
}

/**
 * Registra que uma célula multiplicou.
 *
 * O que era só uma data-alvo vira fato: as filhas entram no banco como células
 * de verdade — página, calendário, galeria, tudo —, já ligadas à mãe pela
 * linhagem e com a rede e a identidade visual herdadas. A mãe perde a
 * data-alvo, porque ela acabou de ser cumprida.
 *
 * Três filhas de uma vez é caso real (célula grande que se divide em três), e
 * por isso a entrada é uma lista e não um par de campos. Nome é opcional: a
 * multiplicação acontece antes do batismo da célula.
 */
export async function registrarMultiplicacaoAction(dados: {
  celulaMaeId: string
  /** Dia em que a multiplicação aconteceu, em ISO (`2026-08-16`). */
  data: string
  filhas: FilhaNova[]
}): Promise<ResultadoMultiplicacao> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Mesma régua da célula-mãe em `editCelulaAction`: linhagem é estrutural,
  // quem mexe é quem gerencia a rede.
  if (!CARGOS_GESTAO.includes(profile?.role ?? '')) {
    return { ok: false, erro: 'Só a supervisão registra multiplicação.' }
  }

  const filhas = dados.filhas.slice(0, MAX_FILHAS)
  if (filhas.length === 0) return { ok: false, erro: 'Informe ao menos uma célula nova.' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) {
    return { ok: false, erro: 'Data inválida.' }
  }

  const admin = createAdminClient()

  const { data: mae } = await admin
    .from('celulas')
    .select('id, nome, rede_id, cor, cor_secundaria, fundo_tipo, frequencia, dia_semana, horario')
    .eq('id', dados.celulaMaeId)
    .maybeSingle()

  if (!mae) return { ok: false, erro: 'Célula-mãe não encontrada.' }

  const existentes = filhas
    .map((f) => f.celulaExistenteId)
    .filter((id): id is string => !!id)

  if (existentes.includes(mae.id)) {
    return { ok: false, erro: 'Uma célula não pode ser filha de si mesma.' }
  }
  if (new Set(existentes).size !== existentes.length) {
    return { ok: false, erro: 'A mesma célula foi escolhida duas vezes.' }
  }

  // Pendurar a mãe debaixo de uma descendente dela fecharia um ciclo, e a
  // árvore passaria a se desenhar para sempre. A checagem sobe a linhagem da
  // mãe: se a candidata está lá em cima, ela é ancestral e não pode ser filha.
  if (existentes.length > 0) {
    const ancestrais = await linhagemAcima(mae.id)
    const conflito = existentes.find((id) => ancestrais.includes(id))
    if (conflito) {
      return { ok: false, erro: 'Essa célula já é origem desta linhagem — seria um ciclo.' }
    }
  }

  // O id de cada filha é sorteado aqui, e não deixado para o banco: é ele que
  // amarra a linha inserida ao líder escolhido para ela. Confiar na ordem em
  // que o PostgREST devolve as linhas arriscaria ligar o líder na célula errada.
  const novas = filhas.filter((f) => !f.celulaExistenteId)
  const linhas = novas.map((f, i) => {
    const nome = (f.nome ?? '').trim()
    const semNome = nome.length === 0
    return {
      id: crypto.randomUUID(),
      rede_id: mae.rede_id,
      nome: semNome ? nomeProvisorioDe(mae.nome, i, novas.length) : nome,
      nome_provisorio: semNome,
      celula_mae_id: mae.id,
      multiplicada_em: dados.data,
      // O nome também vai para a coluna solta: é o que a árvore e as listas
      // mostram antes de a pessoa criar a conta.
      lider_nome: nomesDeLideres(f.lideres),
      // A filha estreia parecida com a mãe: mesma rede, mesmas cores, mesmo
      // ritmo de encontro. É o ponto de partida mais provável, e cada uma
      // muda o que quiser depois na própria página.
      cor: mae.cor,
      cor_secundaria: mae.cor_secundaria,
      fundo_tipo: mae.fundo_tipo,
      frequencia: mae.frequencia,
      dia_semana: mae.dia_semana,
      horario: mae.horario,
      ativa: true,
    }
  })

  if (linhas.length > 0) {
    const { error } = await admin.from('celulas').insert(linhas as never)
    if (error) return { ok: false, erro: error.message }
  }

  // A célula que já existia não é recriada: ela só passa a constar como filha,
  // guardando o nome, a página e o histórico que já tinha.
  const adotadas = filhas.filter((f) => f.celulaExistenteId)
  for (const f of adotadas) {
    const { error: erroAdocao } = await admin
      .from('celulas')
      .update({
        celula_mae_id: mae.id,
        multiplicada_em: dados.data,
        // O nome do líder só é escrito quando um foi escolhido agora: apagar o
        // que já estava lá seria perder informação por omissão.
        ...(f.lideres && f.lideres.length > 0
          ? { lider_nome: nomesDeLideres(f.lideres) }
          : {}),
      } as never)
      .eq('id', f.celulaExistenteId!)
    if (erroAdocao) return { ok: false, erro: erroAdocao.message }
  }

  // Um id por filha, na ordem em que elas foram informadas — inclusive as que
  // já existiam, porque o líder escolhido vale para as duas situações.
  let proximaNova = 0
  const ids = filhas.map((f) => f.celulaExistenteId ?? linhas[proximaNova++]?.id ?? '')

  // Cada líder escolhido é ligado de verdade à célula nova, do jeito que o
  // resto do app entende: quem tem conta vira membro com papel de líder;
  // quem ainda não tem passa a apontar para a célula na lista da igreja, e o
  // vínculo se completa sozinho quando ela criar a conta.
  const vinculos: PromiseLike<unknown>[] = []
  filhas.forEach((f, i) => {
    const celulaId = ids[i]
    if (!celulaId) return

    ;(f.lideres ?? []).forEach((lider) => {
      if (lider.tipo === 'profile') {
        vinculos.push(
          admin
            .from('celula_membros')
            .upsert(
              { celula_id: celulaId, user_id: lider.id, papel: 'lider' } as never,
              { onConflict: 'celula_id,user_id' },
            ),
        )
        return
      }

      vinculos.push(
        admin
          .from('membros_pre_cadastro')
          .update({ celula_id: celulaId, updated_at: new Date().toISOString() } as never)
          .eq('id', lider.id),
      )
    })
  })

  await Promise.all(vinculos)

  // A data-alvo da mãe já foi cumprida. Deixá-la no lugar faria a célula
  // reaparecer no alerta de multiplicação atrasada no dia seguinte.
  const { error: erroMae } = await admin
    .from('celulas')
    .update({ multiplicacao_prevista: null } as never)
    .eq('id', mae.id)

  if (erroMae) return { ok: false, erro: erroMae.message }

  revalidatePath('/celula')
  revalidatePath(`/celula/${mae.id}`)
  revalidatePath('/supervisor')
  revalidatePath('/pastor')
  revalidatePath(`/rede/${mae.rede_id}`)

  revalidatePath('/usuarios')

  return { ok: true, criadas: ids }
}

/**
 * Os ancestrais de uma célula, da mãe para cima.
 *
 * Vai subindo com um teto de passos: linhagem quebrada por um ciclo antigo no
 * banco não pode transformar a checagem num laço infinito.
 */
async function linhagemAcima(celulaId: string, teto = 20): Promise<string[]> {
  const admin = createAdminClient()
  const acima: string[] = []
  let atual: string | null = celulaId

  for (let i = 0; i < teto && atual; i++) {
    const passo: { data: { celula_mae_id: string | null } | null } = await admin
      .from('celulas')
      .select('celula_mae_id')
      .eq('id', atual)
      .maybeSingle()

    const mae: string | null = passo.data?.celula_mae_id ?? null
    if (!mae || acima.includes(mae)) break
    acima.push(mae)
    atual = mae
  }

  return acima
}

/**
 * Dá nome à célula que nasceu sem um.
 *
 * Existe separado de `editCelulaAction` porque é um campo só, disparado de
 * dentro da árvore — quem batiza a célula na reunião de supervisão não quer
 * abrir a página dela para isso.
 */
export async function batizarCelulaAction(
  celulaId: string,
  nome: string,
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado.' }

  const limpo = nome.trim()
  if (limpo.length < 2) return { ok: false, erro: 'Escolha um nome com pelo menos duas letras.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const gestao = CARGOS_GESTAO.includes(profile?.role ?? '')

  if (!gestao) {
    const { data: membro } = await supabase
      .from('celula_membros')
      .select('papel')
      .eq('celula_id', celulaId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (membro?.papel !== 'lider') return { ok: false, erro: 'Sem permissão.' }
  }

  const admin = createAdminClient()
  const { data: celula, error } = await admin
    .from('celulas')
    .update({ nome: limpo, nome_provisorio: false } as never)
    .eq('id', celulaId)
    .select('rede_id')
    .maybeSingle()

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')
  revalidatePath('/pastor')
  const redeId = (celula as { rede_id: string } | null)?.rede_id
  if (redeId) revalidatePath(`/rede/${redeId}`)

  return { ok: true }
}
