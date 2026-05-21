'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, MailCheck } from 'lucide-react'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    })

    if (error) {
      setErro('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
      setCarregando(false)
      return
    }

    setEnviado(true)
    setCarregando(false)
  }

  return (
    <div className="p-6 space-y-5">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao login
      </Link>

      {enviado ? (
        <div className="text-center py-6 space-y-3">
          <MailCheck className="h-12 w-12 text-[#7C3AED] mx-auto" />
          <p className="font-semibold text-gray-800">E-mail enviado!</p>
          <p className="text-sm text-gray-500">
            Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para redefinir sua senha.
          </p>
          <p className="text-xs text-gray-400">
            Não recebeu? Verifique a pasta de spam ou{' '}
            <button
              type="button"
              onClick={() => { setEnviado(false) }}
              className="text-[#7C3AED] hover:underline font-medium"
            >
              tente novamente
            </button>
            .
          </p>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Esqueceu a senha?</h2>
            <p className="text-sm text-gray-500 mt-1">
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {erro && <p className="text-sm text-red-500">{erro}</p>}

            <button
              type="submit"
              disabled={carregando}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#A21CAF] hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {carregando ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
