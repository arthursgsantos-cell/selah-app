/**
 * Para onde mandar a pessoa depois de entrar.
 *
 * O middleware anexa `?next=` sempre que barra alguém numa página protegida,
 * e o link de acompanhamento da inscrição chega de fora do app com o mesmo
 * parâmetro. Sem honrar isso, quem faz login cai na home e precisa procurar
 * de novo a página que pediu.
 */

/**
 * Só caminho interno. Um `next` apontando para outro domínio viraria
 * redirecionamento aberto, e `//` é URL relativa a protocolo — que o navegador
 * também trata como externa.
 */
export function destinoSeguro(): string | null {
  if (typeof window === 'undefined') return null
  const alvo = new URLSearchParams(window.location.search).get('next')
  if (!alvo) return null
  return alvo.startsWith('/') && !alvo.startsWith('//') ? alvo : null
}

/**
 * Mantém o destino ao trocar entre login e cadastro: quem foi mandado para o
 * login, clicou em "Criar conta" e voltou não pode perder o caminho no meio.
 */
export function comDestino(caminho: string): string {
  const destino = destinoSeguro()
  return destino ? `${caminho}?next=${encodeURIComponent(destino)}` : caminho
}

/**
 * URL de login que devolve a pessoa para `destino`.
 *
 * Usada nos `redirect()` das páginas protegidas — são elas, e não o
 * middleware, que barram quem não está logado.
 */
export function loginCom(destino: string): string {
  return `/login?next=${encodeURIComponent(destino)}`
}
