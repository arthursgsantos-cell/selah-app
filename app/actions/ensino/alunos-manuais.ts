'use server'

/**
 * O aluno que o professor cadastra à mão.
 *
 * A igreja é mais analógica que o app: boa parte da turma não vai se inscrever
 * pelo celular, e o professor chega com a lista escrita no papel. Estas ações
 * são a porta para isso — nome basta, o resto é opcional, e o cadastro sai num
 * campo só para dar para digitar a turma inteira de uma sentada.
 *
 * Há três caminhos, e a busca decide qual usar antes de digitar qualquer coisa:
 *
 * 1. a pessoa já tem perfil no app → a inscrição nasce com `user_id`, igual à
 *    que ela mesma faria;
 * 2. já está no pré-cadastro da igreja (veio da planilha, de outra turma, de
 *    outro líder) → reaproveita aquele registro, e a pessoa não vira duas;
 * 3. não existe em lugar nenhum → cria o pré-cadastro e inscreve.
 *
 * Nos casos 2 e 3 a inscrição fica sem `user_id`. Quando a pessoa criar a
 * conta, `vincularInscricoesEnsino` transfere inscrição e presenças para ela.
 *
 * Tudo pelo cliente admin, como no resto do módulo: quem autoriza é
 * `podeLecionar`, não a RLS — a policy de `membros_pre_cadastro` só deixa
 * admin e pastor escrever, e professor da turma também precisa poder.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

/** Um candidato a aluno: alguém do app ou alguém só da lista da igreja. */
export interface PessoaEncontrada {
  /** `profile` tem conta no app; `pre_cadastro` ainda não. */
  tipo: 'profile' | 'pre_cadastro'
  id: string
  nome: string
  telefone: string | null
  email: string | null
  avatarUrl: string | null
  /** Preenchido quando a pessoa já está nesta turma — a linha aparece travada. */
  jaNaTurma: boolean
}

/** Vira `%joão%` sem os caracteres que quebrariam o filtro do PostgREST. */
function curinga(termo: string): string {
  return `%${termo.replace(/[%,()*\\]/g, ' ').trim()}%`
}

function limpar(valor: string | null | undefined): string | null {
  const t = valor?.trim()
  return t ? t : null
}

/**
 * Procura entre os perfis e os pré-cadastros da igreja.
 *
 * Existe para o professor não recadastrar quem o app já conhece: digitar
 * "Maria" e ver a Maria que tem conta evita criar uma segunda Maria sem
 * histórico. Por isso a busca vem antes do formulário na tela, e não depois.
 */
export async function buscarPessoasParaTurma(
  turmaId: string,
  termo: string
): Promise<PessoaEncontrada[]> {
  const acesso = await acessoEnsino()
  if (!acesso || !(await podeLecionar(acesso, turmaId))) return []

  const busca = termo.trim()
  if (busca.length < 2) return []

  const admin = createAdminClient()
  const padrao = curinga(busca)

  const [perfisRes, preRes, inscricoesRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, nome, telefone, email, avatar_url')
      .eq('igreja_id', acesso.igrejaId)
      .or(`nome.ilike.${padrao},email.ilike.${padrao},telefone.ilike.${padrao}`)
      .order('nome')
      .limit(8),
    // Só quem ainda não virou perfil: o pré-cadastro já vinculado seria a mesma
    // pessoa do resultado de cima, duas vezes na lista.
    admin
      .from('membros_pre_cadastro')
      .select('id, nome, telefone, email')
      .eq('igreja_id', acesso.igrejaId)
      .is('profile_id', null)
      .or(`nome.ilike.${padrao},email.ilike.${padrao},telefone.ilike.${padrao}`)
      .order('nome')
      .limit(8),
    admin
      .from('ensino_inscricoes')
      .select('user_id, pre_cadastro_id, status')
      .eq('turma_id', turmaId),
  ])

  // "Já está na turma" ignora recusada e cancelada: essas o professor pode
  // querer inscrever de novo, e travar a linha esconderia o caminho.
  const ativas = ((inscricoesRes.data ?? []) as {
    user_id: string | null; pre_cadastro_id: string | null; status: string
  }[]).filter((i) => ['pendente', 'aprovada', 'concluida'].includes(i.status))

  const usersNaTurma = new Set(ativas.map((i) => i.user_id).filter(Boolean))
  const presNaTurma = new Set(ativas.map((i) => i.pre_cadastro_id).filter(Boolean))

  const perfis: PessoaEncontrada[] = ((perfisRes.data ?? []) as {
    id: string; nome: string; telefone: string | null; email: string | null
    avatar_url: string | null
  }[]).map((p) => ({
    tipo: 'profile',
    id: p.id,
    nome: p.nome,
    telefone: p.telefone,
    email: p.email,
    avatarUrl: p.avatar_url,
    jaNaTurma: usersNaTurma.has(p.id),
  }))

  const pres: PessoaEncontrada[] = ((preRes.data ?? []) as {
    id: string; nome: string; telefone: string | null; email: string | null
  }[]).map((p) => ({
    tipo: 'pre_cadastro',
    id: p.id,
    nome: p.nome,
    telefone: p.telefone,
    email: p.email,
    avatarUrl: null,
    jaNaTurma: presNaTurma.has(p.id),
  }))

  // Quem tem conta primeiro: é o cadastro mais completo dos dois.
  return [...perfis, ...pres].slice(0, 10)
}

/**
 * Confere se ainda cabe mais um aprovado. Devolve a mensagem pronta ou null.
 *
 * A checagem é a mesma da aprovação de um pedido (`decidirInscricaoAction`) —
 * o professor não deveria conseguir estourar a turma por um caminho e não pelo
 * outro.
 */
async function turmaCheia(
  admin: ReturnType<typeof createAdminClient>,
  turmaId: string
): Promise<string | null> {
  const { data: turma } = await admin
    .from('ensino_turmas')
    .select('vagas, status')
    .eq('id', turmaId)
    .maybeSingle()

  if (!turma) return 'Turma não encontrada.'
  if (turma.vagas === null) return null

  const { count } = await admin
    .from('ensino_inscricoes')
    .select('id', { count: 'exact', head: true })
    .eq('turma_id', turmaId)
    .in('status', ['aprovada', 'concluida'])

  return (count ?? 0) >= turma.vagas
    ? 'A turma já está com todas as vagas ocupadas.'
    : null
}

function revalidarTurma(turmaId: string) {
  revalidatePath(`/ensino/turma/${turmaId}`)
  revalidatePath(`/ensino/turma/${turmaId}/alunos`)
  revalidatePath(`/ensino/turma/${turmaId}/presencas`)
  revalidatePath('/ensino/professor')
  revalidatePath('/ensino/alunos')
}

/**
 * Inscreve alguém que o app já conhece — perfil ou pré-cadastro da igreja.
 *
 * Entra direto como `aprovada`: quem cadastrou foi o professor, e um pedido
 * pendente criado por ele mesmo só geraria trabalho de aprovar o próprio ato.
 */
export async function adicionarPessoaTurmaAction(params: {
  turmaId: string
  tipo: 'profile' | 'pre_cadastro'
  pessoaId: string
  observacao?: string | null
}): Promise<{ ok: true; nome: string } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }
  if (!(await podeLecionar(acesso, params.turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const admin = createAdminClient()
  const cheia = await turmaCheia(admin, params.turmaId)
  if (cheia) return { ok: false, erro: cheia }

  const agora = new Date().toISOString()
  const base = {
    turma_id: params.turmaId,
    status: 'aprovada' as const,
    origem: 'manual' as const,
    observacao: limpar(params.observacao),
    decidido_por: acesso.userId,
    decidido_em: agora,
  }

  if (params.tipo === 'profile') {
    const { data: perfil } = await admin
      .from('profiles')
      .select('id, nome, telefone, email, igreja_id')
      .eq('id', params.pessoaId)
      .maybeSingle()

    if (!perfil || perfil.igreja_id !== acesso.igrejaId) {
      return { ok: false, erro: 'Pessoa não encontrada nesta igreja.' }
    }

    // Já teve inscrição aqui? Uma recusada ou cancelada é retomada na mesma
    // linha — é o que a chave `(turma, usuário)` permite, e preserva as
    // presenças de quem já tinha frequentado.
    const { data: existente } = await admin
      .from('ensino_inscricoes')
      .select('id, status')
      .eq('turma_id', params.turmaId)
      .eq('user_id', perfil.id)
      .maybeSingle()

    if (existente && ['pendente', 'aprovada', 'concluida'].includes(existente.status)) {
      return { ok: false, erro: `${perfil.nome} já está nesta turma.` }
    }

    const linha = {
      ...base,
      user_id: perfil.id,
      nome: perfil.nome,
      telefone: perfil.telefone,
      email: perfil.email,
    }

    const { error } = existente
      ? await admin.from('ensino_inscricoes').update(linha).eq('id', existente.id)
      : await admin.from('ensino_inscricoes').insert(linha)

    if (error) return { ok: false, erro: error.message }

    revalidarTurma(params.turmaId)
    return { ok: true, nome: perfil.nome }
  }

  const { data: pre } = await admin
    .from('membros_pre_cadastro')
    .select('id, nome, telefone, email, igreja_id, profile_id')
    .eq('id', params.pessoaId)
    .maybeSingle()

  if (!pre || pre.igreja_id !== acesso.igrejaId) {
    return { ok: false, erro: 'Pessoa não encontrada nesta igreja.' }
  }

  // Criou conta entre a busca e o clique: então é o perfil que entra, para a
  // inscrição já nascer com dono.
  if (pre.profile_id) {
    return adicionarPessoaTurmaAction({
      turmaId: params.turmaId,
      tipo: 'profile',
      pessoaId: pre.profile_id,
      observacao: params.observacao,
    })
  }

  const { data: existente } = await admin
    .from('ensino_inscricoes')
    .select('id, status')
    .eq('turma_id', params.turmaId)
    .eq('pre_cadastro_id', pre.id)
    .maybeSingle()

  const linha = {
    ...base,
    user_id: null,
    pre_cadastro_id: pre.id,
    nome: pre.nome,
    telefone: pre.telefone,
    email: pre.email,
  }

  if (existente && ['pendente', 'aprovada', 'concluida'].includes(existente.status)) {
    return { ok: false, erro: `${pre.nome} já está nesta turma.` }
  }

  const { error } = existente
    ? await admin.from('ensino_inscricoes').update(linha).eq('id', existente.id)
    : await admin.from('ensino_inscricoes').insert(linha)

  if (error) return { ok: false, erro: error.message }

  revalidarTurma(params.turmaId)
  return { ok: true, nome: pre.nome }
}

/**
 * Cadastra alguém que o app não conhece e já põe na turma.
 *
 * Só o nome é obrigatório. É deliberado: o professor está copiando uma lista de
 * papel, e exigir telefone ou e-mail de cada um faria a tarefa parar na
 * primeira pessoa que ele não sabe o contato. O que faltar entra depois, pela
 * própria pessoa quando criar a conta.
 *
 * A pessoa é gravada em `membros_pre_cadastro`, e não numa tabela do Ensino:
 * assim ela existe para a igreja inteira — aparece em `/pendencias`, é
 * reconhecida pelo e-mail no onboarding e pode ser posta em outra turma sem
 * ser digitada de novo.
 */
export async function cadastrarAlunoManualAction(params: {
  turmaId: string
  nome: string
  telefone?: string | null
  email?: string | null
  observacao?: string | null
}): Promise<{ ok: true; nome: string } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }
  if (!(await podeLecionar(acesso, params.turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const nome = params.nome.trim().replace(/\s+/g, ' ')
  if (nome.length < 2) return { ok: false, erro: 'Informe o nome do aluno.' }

  const email = limpar(params.email)?.toLowerCase() ?? null
  const telefone = limpar(params.telefone)
  const admin = createAdminClient()

  const cheia = await turmaCheia(admin, params.turmaId)
  if (cheia) return { ok: false, erro: cheia }

  // E-mail é identidade: se ele já é de alguém no app, a inscrição vai para
  // aquele perfil em vez de criar uma segunda ficha para a mesma pessoa.
  if (email) {
    const { data: perfil } = await admin
      .from('profiles')
      .select('id')
      .eq('igreja_id', acesso.igrejaId)
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (perfil) {
      return adicionarPessoaTurmaAction({
        turmaId: params.turmaId,
        tipo: 'profile',
        pessoaId: perfil.id,
        observacao: params.observacao,
      })
    }

    const { data: pre } = await admin
      .from('membros_pre_cadastro')
      .select('id')
      .eq('igreja_id', acesso.igrejaId)
      .is('profile_id', null)
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (pre) {
      return adicionarPessoaTurmaAction({
        turmaId: params.turmaId,
        tipo: 'pre_cadastro',
        pessoaId: pre.id,
        observacao: params.observacao,
      })
    }
  }

  // Sem cargo: quem entra por aqui é aluno, e definir cargo de membro é
  // decisão da liderança, não efeito colateral de uma matrícula.
  const { data: criado, error: erroPre } = await admin
    .from('membros_pre_cadastro')
    .insert({
      igreja_id: acesso.igrejaId,
      nome,
      telefone,
      email,
      obs: 'Cadastrado pelo Ensino',
      created_by: acesso.userId,
    })
    .select('id')
    .single()

  if (erroPre || !criado) {
    return { ok: false, erro: erroPre?.message ?? 'Não foi possível cadastrar a pessoa.' }
  }

  const agora = new Date().toISOString()
  const { error } = await admin.from('ensino_inscricoes').insert({
    turma_id: params.turmaId,
    user_id: null,
    pre_cadastro_id: criado.id,
    nome,
    telefone,
    email,
    status: 'aprovada',
    origem: 'manual',
    observacao: limpar(params.observacao),
    decidido_por: acesso.userId,
    decidido_em: agora,
  })

  if (error) return { ok: false, erro: error.message }

  revalidarTurma(params.turmaId)
  revalidatePath('/usuarios')
  revalidatePath('/pendencias')
  return { ok: true, nome }
}

/**
 * Corrige o que foi digitado errado na pressa.
 *
 * Mexe só em inscrição manual de quem ainda não tem conta: onde há perfil, o
 * dono do nome e do telefone é a pessoa, e a inscrição é cópia dele.
 */
export async function editarAlunoManualAction(params: {
  inscricaoId: string
  nome: string
  telefone?: string | null
  email?: string | null
  observacao?: string | null
}): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: inscricao } = await admin
    .from('ensino_inscricoes')
    .select('id, turma_id, user_id, pre_cadastro_id')
    .eq('id', params.inscricaoId)
    .maybeSingle()

  if (!inscricao) return { ok: false, erro: 'Inscrição não encontrada.' }
  if (!(await podeLecionar(acesso, inscricao.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }
  if (inscricao.user_id) {
    return { ok: false, erro: 'Este aluno tem conta no app — os dados vêm do perfil dele.' }
  }

  const nome = params.nome.trim().replace(/\s+/g, ' ')
  if (nome.length < 2) return { ok: false, erro: 'Informe o nome do aluno.' }

  const email = limpar(params.email)?.toLowerCase() ?? null
  const telefone = limpar(params.telefone)

  const { error } = await admin
    .from('ensino_inscricoes')
    .update({ nome, telefone, email, observacao: limpar(params.observacao) })
    .eq('id', inscricao.id)

  if (error) return { ok: false, erro: error.message }

  // A ficha da igreja acompanha a correção — é a mesma pessoa nos dois lugares.
  if (inscricao.pre_cadastro_id) {
    await admin
      .from('membros_pre_cadastro')
      .update({ nome, telefone, email, updated_at: new Date().toISOString() })
      .eq('id', inscricao.pre_cadastro_id)
  }

  revalidarTurma(inscricao.turma_id)
  revalidatePath('/usuarios')
  return { ok: true }
}

/**
 * Tira da turma quem entrou por engano.
 *
 * Apaga de verdade, e só o que o professor mesmo criou: linha duplicada ou nome
 * errado não tem por que virar histórico de "cancelada". Inscrição feita pela
 * própria pessoa continua sendo recusada/cancelada pelos botões de sempre, que
 * preservam o registro do pedido.
 *
 * O pré-cadastro sobrevive à remoção: a pessoa continua existindo para a
 * igreja, ainda que não para esta turma.
 */
export async function removerAlunoManualAction(inscricaoId: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: inscricao } = await admin
    .from('ensino_inscricoes')
    .select('id, turma_id, origem')
    .eq('id', inscricaoId)
    .maybeSingle()

  if (!inscricao) return { ok: false, erro: 'Inscrição não encontrada.' }
  if (!(await podeLecionar(acesso, inscricao.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }
  if (inscricao.origem !== 'manual') {
    return { ok: false, erro: 'Só dá para remover aluno que foi cadastrado pelo professor.' }
  }

  // As presenças vão junto pelo `on delete cascade`.
  const { error } = await admin.from('ensino_inscricoes').delete().eq('id', inscricao.id)
  if (error) return { ok: false, erro: error.message }

  revalidarTurma(inscricao.turma_id)
  return { ok: true }
}
