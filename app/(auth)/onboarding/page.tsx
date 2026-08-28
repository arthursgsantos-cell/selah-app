'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { criarPerfilAdmin } from '@/app/actions/admin'
import { criarPerfilConvidado } from '@/app/actions/onboarding'
import { confirmarMatchPreCadastro, notificarNovoLogin } from '@/app/actions/pre-cadastro'
import { consumirDestino } from '@/lib/destino-login'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserCheck, UserX, Phone, StickyNote } from 'lucide-react'

const ADMIN_EMAILS = ['arthursgsantos@gmail.com']

type MatchCandidate = {
  id: string
  nome: string
  telefone: string | null
  obs: string | null
  similaridade: number
}

export default function OnboardingPage() {
  const [nome, setNome] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [verificando, setVerificando] = useState(true)

  // Passo 2: correspondência
  const [passo, setPasso] = useState<1 | 2>(1)
  const [candidatos, setCandidatos] = useState<MatchCandidate[]>([])
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user?.user_metadata?.full_name) setNome(user.user_metadata.full_name)
      if (ADMIN_EMAILS.includes(user?.email ?? '')) setIsAdmin(true)

      // Quem já tem perfil não tem o que fazer aqui: nem vê a tela de criar
      // conta. Só um perfil realmente ausente abre o formulário — se a consulta
      // falhar, seguimos com ele, que é o caminho de quem chegou de verdade
      // para se cadastrar.
      if (user) {
        const { data: perfil } = await supabase
          .from('profiles').select('id').eq('id', user.id).maybeSingle()
        if (perfil) {
          router.replace(concluirEm())
          router.refresh()
          return
        }
      }
      setVerificando(false)
    })
  }, [])

  /**
   * Onde termina o onboarding. Quem chegou por um link — o de uma turma, por
   * exemplo — volta para ele agora que tem perfil; quem entrou pela porta da
   * frente segue para a home.
   *
   * O onboarding é alcançado por `redirect('/onboarding')`, sem query: o
   * destino só existe aqui porque foi guardado lá na tela de login.
   */
  function concluirEm(): string {
    return consumirDestino() ?? '/home'
  }

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
      router.push(concluirEm())
      router.refresh()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const resultado = await criarPerfilConvidado(nome)
    if (!resultado.sucesso) {
      setErro(resultado.erro ?? 'Erro ao criar perfil. Tente novamente.')
      setCarregando(false)
      return
    }

    // O perfil já existia: não é cadastro nenhum, é alguém que chegou aqui por
    // engano. Segue direto para o app, sem perguntar de pré-cadastro e sem
    // avisar os pastores de um "novo membro" que entrou há meses.
    if (resultado.jaExistia) {
      router.push(concluirEm())
      router.refresh()
      return
    }

    // E-mail encontrado no pré-cadastro: identidade e cargo já resolvidos,
    // não faz sentido perguntar de novo por semelhança de nome.
    if (resultado.cargo && resultado.cargo !== 'convidado') {
      router.push(concluirEm())
      router.refresh()
      return
    }

    // Buscar pré-cadastros com nome semelhante
    const { data: semelhantes } = await (supabase as any).rpc('buscar_pre_cadastro_semelhantes', {
      p_nome: nome.trim(),
    })

    if (semelhantes && (semelhantes as MatchCandidate[]).length > 0) {
      setCandidatos(semelhantes as MatchCandidate[])
      setPasso(2)
      setCarregando(false)
      return
    }

    // Sem matches: notificar admin e ir para home
    await notificarNovoLogin()
    router.push(concluirEm())
    router.refresh()
  }

  async function confirmarMatch(candidatoId: string) {
    setConfirmando(candidatoId)
    await confirmarMatchPreCadastro(candidatoId)
    router.push(concluirEm())
    router.refresh()
  }

  async function pularMatch() {
    setConfirmando('skip')
    await notificarNovoLogin()
    router.push(concluirEm())
    router.refresh()
  }

  if (passo === 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Você já está na nossa lista?</CardTitle>
          <CardDescription>
            Encontramos pessoas com nomes parecidos. Você é alguma delas?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidatos.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{c.nome}</p>
                {c.telefone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />
                    {c.telefone}
                  </p>
                )}
                {c.obs && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <StickyNote className="h-3 w-3" />
                    {c.obs}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => confirmarMatch(c.id)}
                disabled={confirmando !== null}
                className="shrink-0"
              >
                {confirmando === c.id ? (
                  'Confirmando...'
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                    Sou eu
                  </>
                )}
              </Button>
            </div>
          ))}

          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={pularMatch}
            disabled={confirmando !== null}
          >
            {confirmando === 'skip' ? (
              'Aguarde...'
            ) : (
              <>
                <UserX className="h-4 w-4 mr-2" />
                Não sou nenhuma dessas pessoas
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Enquanto não se sabe se há perfil, nada de formulário: a tela de criar
  // conta piscando para quem já é membro é justamente o susto que se quer
  // evitar.
  if (verificando) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Carregando...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bem-vindo à IBZS!</CardTitle>
        <CardDescription>
          {isAdmin
            ? 'Acesso de administrador. Clique em continuar para entrar.'
            : 'Para finalizar, confirme seu nome. Um líder vai liberar seu acesso completo em breve.'}
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

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? 'Salvando...' : isAdmin ? 'Continuar' : 'Entrar na igreja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
