import { createClient, getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/shared/header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  let profile: { nome: string; role: string; avatar_url: string | null; igreja_id: string } | null = null
  let churchLogoUrl: string | null = null
  let churchName: string | null = null
  let notificacoesNaoLidas = 0
  let recebeNotificacoes = false

  if (user) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('nome, role, avatar_url, igreja_id')
      .eq('id', user.id)
      .single()

    if (!data) redirect('/onboarding')
    profile = data

    const isAdminOrPastor = profile.role === 'admin' || profile.role === 'pastor'

    // Professor também precisa do sino: é por ele que chega o pedido de
    // inscrição nas turmas dele.
    const { data: equipeEnsino } = await supabase
      .from('ensino_equipe')
      .select('profile_id')
      .eq('profile_id', user.id)
      .maybeSingle()

    recebeNotificacoes = isAdminOrPastor || equipeEnsino !== null

    const [igrejaRes, notifRes] = await Promise.all([
      supabase.from('igrejas').select('logo_url, nome').eq('id', profile.igreja_id).single(),
      recebeNotificacoes
        ? (supabase as any)
            .from('notificacoes')
            .select('id', { count: 'exact', head: true })
            .eq('destinatario_id', user.id)
            .eq('lida', false)
        : Promise.resolve({ count: 0 }),
    ])

    churchLogoUrl = (igrejaRes as any)?.data?.logo_url ?? null
    churchName = (igrejaRes as any)?.data?.nome ?? null
    notificacoesNaoLidas = (notifRes as any)?.count ?? 0
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={profile?.nome}
          userRole={(profile?.role as any) ?? undefined}
          avatarUrl={profile?.avatar_url ?? undefined}
          churchLogoUrl={churchLogoUrl}
          churchName={churchName}
          isGuest={!user}
          notificacoesNaoLidas={notificacoesNaoLidas}
          recebeNotificacoes={recebeNotificacoes}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
