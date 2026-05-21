'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

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

const inviteRoleMap = {
  admin: 'admin',
  pastor: 'pastor',
  supervisor: 'supervisor',
  lider: 'lider',
  membro: 'membro',
} as const

type InviteRole = (typeof inviteRoleMap)[keyof typeof inviteRoleMap]

function parseInviteCode(code: string) {
  const normalized = code.trim().toLowerCase()
  const parts = normalized.split('-')

  if (parts.length > 1 && inviteRoleMap[parts[0] as keyof typeof inviteRoleMap]) {
    return {
      role: inviteRoleMap[parts[0] as keyof typeof inviteRoleMap],
      churchCode: parts.slice(1).join('-'),
    }
  }

  return {
    role: 'membro' as InviteRole,
    churchCode: normalized,
  }
}

export default function CadastroPage() {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', codigo: '' })
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function entrarComGoogle() {
    setErro(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setErro('Não foi possível iniciar o cadastro com Google.')
  }

  function atualizar(campo: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [campo]: e.target.value }))
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    let role: InviteRole = 'membro'
    let igreja: { id: string; nome: string } | null = null

    if (form.codigo.trim()) {
      // Valida o código de convite fornecido
      const parsed = parseInviteCode(form.codigo)
      role = parsed.role
      const { data: ig, error: erroIgreja } = await supabase
        .from('igrejas')
        .select('id, nome')
        .eq('codigo_convite', parsed.churchCode)
        .single()
      if (erroIgreja || !ig) {
        setErro('Código de convite inválido. Verifique com o seu líder.')
        setCarregando(false)
        return
      }
      igreja = ig
    } else {
      // Sem código — associa à única igreja do sistema como membro
      const { data: ig } = await supabase
        .from('igrejas')
        .select('id, nome')
        .limit(1)
        .single()
      if (!ig) {
        setErro('Não foi possível localizar a igreja. Tente novamente.')
        setCarregando(false)
        return
      }
      igreja = ig
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
        role,
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
        <CardDescription>
          Se tiver um código de convite da sua igreja, use-o abaixo. Caso contrário, entre sem código e alguém da liderança irá te atribuir a uma célula.
        </CardDescription>
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
            <Label htmlFor="codigo">Código de convite <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              id="codigo"
              placeholder="Código recebido do seu líder"
              value={form.codigo}
              onChange={atualizar('codigo')}
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">ou</span>
          </div>
        </div>

        <button
          type="button"
          onClick={entrarComGoogle}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <GoogleIcon />
          Cadastrar com Google
        </button>
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
