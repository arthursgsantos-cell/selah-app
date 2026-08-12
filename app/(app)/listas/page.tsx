import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { carregarPessoas } from '@/lib/listas-servidor'
import { ConstrutorListas } from '@/components/listas/construtor-listas'

export const metadata = { title: 'Listas · IBZS' }

/**
 * Listas dinâmicas.
 *
 * Restrita a supervisor para cima: a página junta telefone, idade e vínculo de
 * toda a igreja numa tela só e exporta em planilha. É a mesma informação que
 * já existe espalhada pelo app, mas reunida assim ela vira um cadastro
 * completo — e isso não é para qualquer cargo.
 */
export default async function ListasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/listas'))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const permitido = ['supervisor', 'supervisor_treinamento', 'pastor', 'admin']
    .includes(profile.role)

  if (!permitido) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-base font-semibold">Acesso restrito</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta área é exclusiva para supervisores e pastores.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const admin = createAdminClient()

  const [pessoas, { data: redesData }, { data: celulasData }] = await Promise.all([
    carregarPessoas(profile.igreja_id),
    admin.from('redes').select('id, nome').eq('igreja_id', profile.igreja_id).order('nome'),
    admin
      .from('celulas')
      .select('id, nome, rede_id, redes!inner(igreja_id)')
      .eq('redes.igreja_id', profile.igreja_id)
      .neq('ativa', false)
      .order('nome'),
  ])

  const redes = (redesData ?? []) as { id: string; nome: string }[]
  const celulas = ((celulasData ?? []) as unknown as {
    id: string; nome: string; rede_id: string
  }[]).map((c) => ({ id: c.id, nome: c.nome, redeId: c.rede_id }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div>
        <h1 className="text-xl font-bold">Listas</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Combine filtros, fale por WhatsApp ou leve para a planilha
        </p>
      </div>

      <ConstrutorListas pessoas={pessoas} redes={redes} celulas={celulas} />
    </div>
  )
}
