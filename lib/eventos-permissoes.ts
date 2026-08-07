/**
 * Quem pode gerenciar as inscrições e os pagamentos de um evento.
 *
 * Regra da igreja: evento é criado de líder para cima, e quem cria cuida do
 * seu. Como nem sempre quem organiza é quem controla o dinheiro, o responsável
 * pode delegar a gestão a outra pessoa — inclusive a um membro sem cargo —
 * registrando-a em `evento_organizadores`.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Cargos que podem criar evento — e, por consequência, gerenciar o seu. */
export const CARGOS_CRIACAO_EVENTO = [
  'admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider',
]

export interface AcessoEvento {
  userId: string
  role: string
  /** Abrir o acompanhamento e conferir números — vale para a liderança toda. */
  podeVer: boolean
  /** Lançar pagamento, cadastrar e editar inscritos. */
  pode: boolean
  /** Escolher quem mais gerencia este evento. */
  podeDelegar: boolean
  /** Verdadeiro quando o acesso vem de uma delegação, não do cargo. */
  delegado: boolean
}

/**
 * Resolve o acesso da pessoa logada a um evento.
 *
 * Devolve `null` sem sessão. Com sessão, `pode` é falso para quem não tem
 * nenhum vínculo com o evento — quem chama decide entre esconder o painel e
 * recusar a ação.
 */
export async function acessoAoEvento(eventoId: string): Promise<AcessoEvento | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role: string } | null)?.role ?? ''
  const admin = createAdminClient()

  const [{ data: eventoData }, { data: delegacao }] = await Promise.all([
    admin.from('eventos').select('created_by, rede_id, celula_id').eq('id', eventoId).maybeSingle(),
    admin
      .from('evento_organizadores')
      .select('id')
      .eq('evento_id', eventoId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const evento = eventoData as {
    created_by: string | null; rede_id: string | null; celula_id: string | null
  } | null

  const criador = evento?.created_by === user.id
  const delegado = Boolean(delegacao)
  // Pastor e admin cuidam da igreja inteira; abaixo disso, o vínculo com o
  // evento é que decide.
  const direcao = role === 'pastor' || role === 'admin'

  // Evento de rede é da supervisão daquela rede — um líder de outra rede não
  // tem por que mexer no dinheiro dele.
  let supervisorDaRede = false
  if (!direcao && !criador && !delegado && evento?.rede_id && role.startsWith('supervisor')) {
    const { data } = await admin
      .from('rede_supervisores')
      .select('supervisor_id')
      .eq('rede_id', evento.rede_id)
      .eq('supervisor_id', user.id)
      .maybeSingle()
    supervisorDaRede = Boolean(data)
  }

  // Evento de célula segue o mesmo raciocínio: quem lidera a célula cuida dele.
  let liderDaCelula = false
  if (!direcao && !criador && !delegado && !supervisorDaRede && evento?.celula_id) {
    const { data } = await admin
      .from('celula_membros')
      .select('papel')
      .eq('celula_id', evento.celula_id)
      .eq('user_id', user.id)
      .eq('papel', 'lider')
      .maybeSingle()
    liderDaCelula = Boolean(data)
  }

  const pode = direcao || criador || delegado || supervisorDaRede || liderDaCelula

  return {
    userId: user.id,
    role,
    // Conferir números continua aberto à liderança: é o relatório que a
    // supervisão acompanha. Mexer no dinheiro é que ficou restrito.
    podeVer: pode || CARGOS_CRIACAO_EVENTO.includes(role),
    pode,
    podeDelegar: direcao || criador || supervisorDaRede,
    delegado,
  }
}

/** Versão que interrompe a ação: para usar dentro das server actions. */
export async function exigirGestaoDoEvento(eventoId: string): Promise<AcessoEvento> {
  const acesso = await acessoAoEvento(eventoId)
  if (!acesso) throw new Error('Faça login para gerenciar este evento.')
  if (!acesso.pode) throw new Error('Você não gerencia este evento.')
  return acesso
}
