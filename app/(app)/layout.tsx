import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/shared/sidebar'
import { Header } from '@/components/shared/header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, role, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex md:shrink-0">
        <Sidebar role={profile.role} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={profile.nome}
          userRole={profile.role}
          avatarUrl={profile.avatar_url ?? undefined}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
