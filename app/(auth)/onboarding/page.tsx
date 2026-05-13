'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { criarPerfilAdmin } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const ADMIN_EMAILS = ['arthursgsantos@gmail.com']

export default function OnboardingPage() {
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) setNome(user.user_metadata.full_name)
      if (ADMIN_EMAILS.includes(user?.email ?? '')) setIsAdmin(true)
    })
  }, [])

  async function concluir(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    if (isAdmin) {
      const resultado = await criarPerfilAdmin()
      if (!resultado.sucesso) {
        setErro(resultado.erro ?? 'Erro ao criar perfil.')
        setCarregando(false)
        return
      }
      router.push('/home')
      router.refresh()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: igreja } = await supabase
      .from('igrejas')
      .select('id')
      .eq('codigo_convite', codigo.trim().toLowerCase())
      .single()

    if (!igreja) {
      setErro('Código de convite inválido. Verifique com o seu líder.')
      setCarregando(false)
      return
    }

    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      igreja_id: igreja.id,
      nome: nome.trim(),
      email: user.email,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      role: 'membro',
    })

    if (error) {
      setErro('Erro ao criar perfil. Tente novamente.')
      setCarregando(false)
      return
    }

    router.push('/home')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bem-vindo ao Selah!</CardTitle>
        <CardDescription>
          {isAdmin
            ? 'Acesso de administrador. Clique em continuar para entrar.'
            : 'Para finalizar, confirme seu nome e informe o código de convite da sua igreja.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={concluir} className="space-y-4">
          {!isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="nome">Seu nome</Label>
              <Input
                id="nome"
                placeholder="Como você quer ser chamado"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
          )}

          {!isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código de convite</Label>
              <Input
                id="codigo"
                placeholder="Ex: selah2024"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Peça ao seu líder ou pastor
              </p>
            </div>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? 'Salvando...' : isAdmin ? 'Continuar' : 'Entrar na igreja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
