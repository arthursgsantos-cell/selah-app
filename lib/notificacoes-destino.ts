/**
 * Para onde cada notificação leva.
 *
 * Notificação que só informa obriga a pessoa a procurar sozinha o que acabou
 * de ser avisado — o pedido de inscrição está numa tela, o membro novo em
 * outra. Aqui cada aviso vira atalho.
 *
 * O `href` gravado em `dados` manda: quem cria a notificação sabe melhor que
 * ninguém para onde ela aponta. O mapa por tipo é a rede de segurança para as
 * notificações antigas, gravadas antes de o campo existir.
 */

export function destinoNotificacao(
  tipo: string,
  dados: Record<string, string> | null | undefined
): string | null {
  const href = dados?.href
  // Só caminho interno: um `href` externo virado link viraria redirecionamento
  // aberto a partir de um registro do banco.
  if (href && href.startsWith('/') && !href.startsWith('//')) return href

  const profileId = dados?.profile_id

  switch (tipo) {
    // Alguém entrou pela primeira vez ou se identificou na lista: quem recebe
    // o aviso quer conferir o cadastro dessa pessoa.
    case 'novo_login':
    case 'match_confirmado':
    case 'match_sugerido':
      return profileId ? `/usuarios?u=${profileId}` : '/usuarios'
    case 'solicitacao_celula':
      return '/solicitacoes'
    case 'solicitacao_cargo':
    case 'pre_cadastro':
      return '/pendencias'
    default:
      return null
  }
}
