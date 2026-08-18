'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { destinoSeguro } from '@/lib/destino-login'

/**
 * Entrar com Google sem sair do nosso domínio.
 *
 * O caminho antigo (`signInWithOAuth`) redireciona para o servidor de auth do
 * Supabase, e é o endereço dele que o Google mostra na tela de permissão —
 * `kkhzmvcqcljptlntlmwm.supabase.co`, que parece golpe para quem está
 * entrando. Aqui quem fala com o Google é a nossa própria página: ele devolve
 * um token de identidade e o `signInWithIdToken` monta a sessão. A tela do
 * Google passa a exibir o endereço do app.
 *
 * O caminho antigo continua vivo como reserva: dentro de navegadores
 * embutidos (o que abre de dentro do Instagram, por exemplo) o script do
 * Google costuma não rodar, e é melhor uma tela feia do que ninguém entrar.
 */

type Credencial = { credential: string }

type ContaGoogle = {
  id: {
    initialize: (config: Record<string, unknown>) => void
    renderButton: (elemento: HTMLElement, opcoes: Record<string, unknown>) => void
  }
}

declare global {
  interface Window {
    google?: { accounts?: ContaGoogle }
  }
}

const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

/** Largura máxima que o Google aceita para o botão dele. */
const LARGURA_MAXIMA = 400

/**
 * O Supabase espera que o nonce chegue ao Google já embaralhado e a nós em
 * claro — é assim que ele confirma que o token foi emitido para este pedido, e
 * não reaproveitado de outro.
 */
async function gerarNonce(): Promise<[string, string]> {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const digerido = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
  const embaralhado = Array.from(new Uint8Array(digerido))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return [nonce, embaralhado]
}

function carregarScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()

    const existente = document.querySelector<HTMLScriptElement>(
      'script[src="' + SCRIPT_GOOGLE + '"]'
    )
    if (existente) {
      existente.addEventListener('load', () => resolve())
      existente.addEventListener('error', () => reject(new Error('script do Google não carregou')))
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_GOOGLE
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('script do Google não carregou'))
    document.head.appendChild(script)
  })
}

function IconeGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

type Props = {
  /** O Google tem um rótulo próprio para cada intenção. */
  acao?: 'entrar' | 'cadastrar'
  onErro?: (mensagem: string) => void
}

export function BotaoGoogle({ acao = 'entrar', onErro }: Props) {
  const [modo, setModo] = useState<'carregando' | 'google' | 'reserva'>('carregando')
  const [ocupado, setOcupado] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const avisarErro = useCallback(
    (mensagem: string) => {
      if (onErro) onErro(mensagem)
    },
    [onErro]
  )

  /** Caminho de reserva: sai do app e volta pelo `/auth/callback`. */
  const entrarPorRedirecionamento = useCallback(async () => {
    setOcupado(true)
    // O destino viaja no `redirectTo`: o callback do OAuth já sabe honrar
    // `?next=`, mas só recebe o que mandarmos aqui.
    const destino = destinoSeguro()
    const callback = new URL('/auth/callback', window.location.origin)
    if (destino) callback.searchParams.set('next', destino)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    })
    if (error) {
      avisarErro('Não foi possível iniciar o login com Google.')
      setOcupado(false)
    }
  }, [supabase, avisarErro])

  useEffect(() => {
    if (!CLIENT_ID) {
      setModo('reserva')
      return
    }

    let vivo = true

    async function preparar() {
      const [nonce, embaralhado] = await gerarNonce()
      await carregarScript()
      if (!vivo || !caixa.current) return

      const contas = window.google?.accounts?.id
      if (!contas) throw new Error('Google indisponível')

      contas.initialize({
        client_id: CLIENT_ID,
        nonce: embaralhado,
        // Popup em vez de redirecionamento: a pessoa não perde a página onde
        // estava, e é isso que mantém a tela do Google no nosso endereço.
        ux_mode: 'popup',
        itp_support: true,
        callback: async (resposta: Credencial) => {
          setOcupado(true)
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: resposta.credential,
            nonce,
          })
          if (error) {
            avisarErro('Não foi possível entrar com o Google.')
            setOcupado(false)
            return
          }

          // A sessão já está montada aqui no navegador, mas quem sabe se falta
          // onboarding é o servidor. Navegação inteira, e não `router.push`,
          // para os cookies recém-gravados irem junto no pedido.
          const destino = destinoSeguro()
          const proxima = new URL('/auth/pos-login', window.location.origin)
          if (destino) proxima.searchParams.set('next', destino)
          window.location.assign(proxima.toString())
        },
      })

      // A medida sai da raiz, não da caixa: enquanto o botão não desenha a
      // caixa está escondida, e o que está escondido mede zero — o botão
      // nascia com a largura máxima e estourava a coluna no celular.
      const largura = Math.min(raiz.current?.offsetWidth || LARGURA_MAXIMA, LARGURA_MAXIMA)
      contas.renderButton(caixa.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: acao === 'cadastrar' ? 'signup_with' : 'signin_with',
        logo_alignment: 'left',
        locale: 'pt-BR',
        width: largura,
      })

      // `renderButton` não avisa se falhou. Se nada foi desenhado, é sinal de
      // navegador embutido bloqueando o Google — melhor mostrar a reserva.
      if (caixa.current.childElementCount === 0) throw new Error('botão não desenhou')
      if (vivo) setModo('google')
    }

    preparar().catch(() => {
      if (vivo) setModo('reserva')
    })

    return () => {
      vivo = false
    }
  }, [acao, supabase, avisarErro])

  const rotulo = acao === 'cadastrar' ? 'Cadastrar com Google' : 'Entrar com Google'

  return (
    <div ref={raiz}>
      {/* A caixa do Google fica sempre montada: `renderButton` precisa do nó
          existindo no momento em que desenha. */}
      <div
        ref={caixa}
        className={
          'flex justify-center overflow-hidden rounded-xl' +
          (modo === 'google' && !ocupado ? '' : ' hidden')
        }
      />

      {modo !== 'google' && (
        <button
          type="button"
          onClick={entrarPorRedirecionamento}
          disabled={modo === 'carregando' || ocupado}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-60 disabled:active:scale-100"
        >
          <IconeGoogle />
          {ocupado ? 'Abrindo Google...' : rotulo}
        </button>
      )}

      {modo === 'google' && ocupado && (
        <div className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-500">
          <IconeGoogle />
          Entrando...
        </div>
      )}
    </div>
  )
}
