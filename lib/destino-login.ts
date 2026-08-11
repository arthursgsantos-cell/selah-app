/**
 * Para onde mandar a pessoa depois de entrar.
 *
 * O middleware anexa `?next=` sempre que barra alguém numa página protegida,
 * e o link de acompanhamento da inscrição chega de fora do app com o mesmo
 * parâmetro. Sem honrar isso, quem faz login cai na home e precisa procurar
 * de novo a página que pediu.
 *
 * A URL sozinha não basta, por dois motivos:
 *
 * - **o Google leva o parâmetro embora.** O `redirectTo` do OAuth só volta com
 *   a query intacta se a URL inteira casar com a lista de redirects do
 *   Supabase; quando não casa, o Supabase manda para a Site URL e o `?next=`
 *   evapora no meio do caminho;
 * - **o onboarding fica no meio.** Quem chega sem perfil passa por
 *   `/onboarding`, que é uma navegação nossa e não carrega a query.
 *
 * Por isso o destino também é guardado no `sessionStorage`: some quando a aba
 * fecha, não vaza para outras abas, e sobrevive à ida ao Google.
 */

const CHAVE = 'selah:destino-login'

/**
 * Destino guardado vence em 15 minutos. Sem isso, quem entrou por um link de
 * curso hoje cedo e voltou ao app à tarde seria teleportado para o curso sem
 * ter pedido.
 */
const VALIDADE_MS = 15 * 60 * 1000

/**
 * Só caminho interno. Um `next` apontando para outro domínio viraria
 * redirecionamento aberto, e `//` é URL relativa a protocolo — que o navegador
 * também trata como externa.
 */
function ehCaminhoInterno(alvo: string | null | undefined): alvo is string {
  return !!alvo && alvo.startsWith('/') && !alvo.startsWith('//')
}

/** O `next` da URL atual, se houver e se for interno. */
function destinoDaUrl(): string | null {
  if (typeof window === 'undefined') return null
  const alvo = new URLSearchParams(window.location.search).get('next')
  return ehCaminhoInterno(alvo) ? alvo : null
}

/** O destino guardado nesta aba, se ainda estiver no prazo. */
export function destinoGuardado(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    if (!bruto) return null
    const { alvo, em } = JSON.parse(bruto) as { alvo?: string; em?: number }
    if (!ehCaminhoInterno(alvo) || !em || Date.now() - em > VALIDADE_MS) {
      sessionStorage.removeItem(CHAVE)
      return null
    }
    return alvo
  } catch {
    return null
  }
}

/**
 * Destino a honrar: o da URL manda, o guardado é a rede de segurança.
 */
export function destinoSeguro(): string | null {
  return destinoDaUrl() ?? destinoGuardado()
}

/**
 * Anota o destino da URL atual para sobreviver ao que vier pela frente.
 * Chamado quando a tela de login/cadastro monta com `?next=`.
 */
export function guardarDestino(): void {
  if (typeof window === 'undefined') return
  const alvo = destinoDaUrl()
  if (!alvo) return
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ alvo, em: Date.now() }))
  } catch {
    // Aba anônima com storage bloqueado: o `?next=` da URL ainda resolve o
    // caminho comum. Perder a rede de segurança não é motivo para quebrar o login.
  }
}

/** Lê e apaga o destino guardado — quem consome é quem vai navegar até ele. */
export function consumirDestino(): string | null {
  const alvo = destinoGuardado()
  limparDestino()
  return alvo
}

export function limparDestino(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    // idem
  }
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
