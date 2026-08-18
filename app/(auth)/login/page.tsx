'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { destinoSeguro, comDestino, guardarDestino, limparDestino } from '@/lib/destino-login'
import { BotaoGoogle } from '@/components/auth/botao-google'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
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

      <BotaoGoogle onErro={setErro} />

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
