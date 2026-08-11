'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { destinoSeguro, comDestino, guardarDestino, limparDestino } from '@/lib/destino-login'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // O link de "Criar conta" leva o destino junto, mas só o cliente conhece a
  // query — no servidor ele nasce sem ela. Resolver isso durante a renderização
  // faria os dois HTMLs discordarem e o React reclamar de hidratação; por isso
  // o destino entra depois que a tela montou.
  const [hrefCadastro, setHrefCadastro] = useState('/cadastro')

  // Guarda o destino assim que a tela abre. É o que segura o caminho durante a
  // ida ao Google e a passagem pelo onboarding, onde a query não sobrevive.
  useEffect(() => {
    guardarDestino()
    setHrefCadastro(comDestino('/cadastro'))
  }, [])

  async function entrarComGoogle() {
    setErro(null)
    setCarregandoGoogle(true)
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
      setErro('Não foi possível iniciar o login com Google.')
      setCarregandoGoogle(false)
    }
  }

  async function entrarComEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setErro('Preencha o email.'); return }
    if (!senha) { setErro('Preencha a senha.'); return }
    setCarregando(true)
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('Email ou senha incorretos.')
      setCarregando(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single()
      // Sem perfil o onboarding vem primeiro: o destino não faz sentido ainda —
      // mas continua guardado, e o onboarding o entrega no fim.
      if (profile) {
        const destino = destinoSeguro() ?? '/home'
        limparDestino()
        router.push(destino)
      } else {
        router.push('/onboarding')
      }
      router.refresh()
    }
  }

  function entrarComoConvidado() {
    // Escolha explícita de não entrar: o destino guardado morre aqui, senão a
    // pessoa seria jogada de volta para a página que exigia login.
    limparDestino()
    router.push('/home')
  }

  return (
    <div className="p-6 space-y-5">
      <form onSubmit={entrarComEmail} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-gray-700">Email</Label>
          <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="senha" className="text-gray-700">Senha</Label>
          <Input id="senha" type="password" placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <div className="flex justify-end">
            <Link href="/esqueci-senha" className="text-xs text-primary hover:underline font-medium">
              Esqueci minha senha
            </Link>
          </div>
        </div>

        {erro && <p className="text-sm text-red-500">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0B2447] to-[#0F52BA] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:active:scale-100"
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <button
        type="button"
        onClick={entrarComGoogle}
        disabled={carregandoGoogle}
        className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-60 disabled:active:scale-100"
      >
        <GoogleIcon />
        {carregandoGoogle ? 'Abrindo Google...' : 'Entrar com Google'}
      </button>

      <button
        type="button"
        onClick={entrarComoConvidado}
        className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all"
      >
        Continuar como convidado
      </button>

      <p className="text-center text-sm text-gray-500">
        Não tem conta?{' '}
        <Link href={hrefCadastro} className="font-semibold text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
