'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function CadastroPage() {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', codigo: '' })
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function atualizar(campo: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [campo]: e.target.value }))
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    // 1. Valida o código de convite
    const { data: igreja, error: erroIgreja } = await supabase
      .from('igrejas')
      .select('id, nome')
      .eq('codigo_convite', form.codigo.trim().toLowerCase())
      .single()

    if (erroIgreja || !igreja) {
      setErro('Código de convite inválido. Verifique com o seu líder.')
      setCarregando(false)
      return
    }

    // 2. Cria o usuário no Supabase Auth
    const { data: authData, error: erroAuth } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        data: {
          nome: form.nome,
          igreja_id: igreja.id,
        },
      },
    })

    if (erroAuth) {
      setErro(
        erroAuth.message.includes('already registered')
          ? 'Este email já está cadastrado.'
          : 'Erro ao criar conta. Tente novamente.'
      )
      setCarregando(false)
      return
    }

    // 3. Se confirmação de email está desabilitada, cria o perfil agora
    if (authData.user && !authData.user.identities?.[0]?.identity_data?.email_verified === false) {
      await supabase.from('profiles').insert({
        id: authData.user.id,
        igreja_id: igreja.id,
        nome: form.nome,
        email: form.email,
        role: 'membro',
      })
      router.push('/home')
      return
    }

    // 4. Se confirmação necessária, mostra mensagem
    setSucesso(true)
    setCarregando(false)
  }

  if (sucesso) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verifique seu email</CardTitle>
          <CardDescription>
            Enviamos um link de confirmação para <strong>{form.email}</strong>.
            Clique no link para ativar sua conta.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Voltar para o login
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Você precisa de um código de convite da sua igreja</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={cadastrar} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              placeholder="Seu nome"
              value={form.nome}
              onChange={atualizar('nome')}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={atualizar('email')}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.senha}
              onChange={atualizar('senha')}
              minLength={6}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="codigo">Código de convite</Label>
            <Input
              id="codigo"
              placeholder="Ex: selah2024"
              value={form.codigo}
              onChange={atualizar('codigo')}
              required
            />
            <p className="text-xs text-muted-foreground">
              Peça ao seu líder ou pastor
            </p>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/login" className="ml-1 text-primary hover:underline font-medium">
          Entrar
        </Link>
      </CardFooter>
    </Card>
  )
}
