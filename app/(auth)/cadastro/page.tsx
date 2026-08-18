'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { destinoSeguro, comDestino, guardarDestino, limparDestino } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AvisoEmail } from '@/components/auth/aviso-email'
import { BotaoGoogle } from '@/components/auth/botao-google'

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

  // Só o cliente conhece a query; montar o link com ela durante a renderização
  // faria servidor e cliente discordarem na hidratação.
  const [hrefLogin, setHrefLogin] = useState('/login')

  // Mesma rede de segurança do login: o destino precisa sobreviver à ida ao
  // Google e ao onboarding, que não carregam a query.
  useEffect(() => {
    guardarDestino()
    setHrefLogin(comDestino('/login'))
  }, [])

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
      // Conta criada: já leva para a página que a pessoa tentou abrir.
      const destino = destinoSeguro() ?? '/home'
      limparDestino()
      router.push(destino)
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
        <CardContent>
          <AvisoEmail assunto="Confirm Your Signup" />
        </CardContent>
        <CardFooter>
          <Link href={hrefLogin} className="text-sm text-primary hover:underline">
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

        <BotaoGoogle acao="cadastrar" onErro={setErro} />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href={hrefLogin} className="ml-1 text-primary hover:underline font-medium">
          Entrar
        </Link>
      </CardFooter>
    </Card>
  )
}
