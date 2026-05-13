import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { ShieldOff } from 'lucide-react'
import { UsuariosLista } from './_components/usuarios-lista'

export default async function UsuariosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  if (profile.role !== 'pastor' && profile.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldOff className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-base font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Esta área é exclusiva para pastores.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: usuarios } = await supabase
    .from('profiles')
    .select('id, nome, email, avatar_url, role, created_at')
    .eq('igreja_id', profile.igreja_id)
    .order('nome')

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie os membros e cargos da sua igreja
        </p>
      </div>

      <UsuariosLista
        usuarios={usuarios ?? []}
        currentUserId={user.id}
      />
    </div>
  )
}
