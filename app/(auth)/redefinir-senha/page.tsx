'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })

    if (error) {
      setErro('Não foi possível redefinir a senha. O link pode ter expirado.')
      setCarregando(false)
      return
    }

    setSucesso(true)
    setTimeout(() => router.replace('/home'), 2500)
  }

  if (sucesso) {
    return (
      <div className="p-6 text-center space-y-3 py-10">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
        <p className="font-semibold text-gray-800">Senha redefinida!</p>
        <p className="text-sm text-gray-500">Redirecionando para o app...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Nova senha</h2>
        <p className="text-sm text-gray-500 mt-1">Escolha uma senha segura para sua conta.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="senha" className="text-gray-700">Nova senha</Label>
          <div className="relative">
            <Input
              id="senha"
              type={mostrar ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmar" className="text-gray-700">Confirmar senha</Label>
          <Input
            id="confirmar"
            type={mostrar ? 'text' : 'password'}
            placeholder="Repita a senha"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
          />
        </div>

        {erro && <p className="text-sm text-red-500">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#A21CAF] hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {carregando ? 'Salvando...' : 'Redefinir senha'}
        </button>
      </form>
    </div>
  )
}
