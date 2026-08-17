import { Suspense } from 'react'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/shared/header'
import { RetomarDestino } from '@/components/auth/retomar-destino'
import { BoasVindasPerfil } from '@/components/auth/boas-vindas-perfil'
import { pendenciasDoPerfil } from '@/lib/perfil-pendencias'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  let profile: {
    nome: string; role: string; avatar_url: string | null; igreja_id: string
    perfil_completado_em: string | null
    telefone: string | null; data_nascimento_1: string | null; endereco: string | null
  } | null = null
  let churchLogoUrl: string | null = null
  let churchName: string | null = null
  let notificacoesNaoLidas = 0
  let recebeNotificacoes = false

  if (user) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('nome, role, avatar_url, igreja_id, perfil_completado_em, telefone, data_nascimento_1, endereco')
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

  // Não basta ter passado pela tela de perfil uma vez: o que decide o convite é
  // o dado estar lá ou não. Quem se cadastrou há meses e nunca deu o telefone
  // continua sendo lembrado.
  const pendencias = profile ? pendenciasDoPerfil(profile) : []

  return (
    /* `dvh` em vez de `vh`: no Safari do iPhone a barra de endereço faz o
       `100vh` passar da área visível e cortar o rodapé da tela. */
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Só para quem entrou: um visitante na home não tem destino a retomar. */}
      {user && <RetomarDestino />}

      {/* Cadastro incompleto: o convite lista o que falta e leva para o perfil,
          com o caminho de volta para onde a pessoa estava indo. */}
      {profile && pendencias.length > 0 && (
        <Suspense fallback={null}>
          <BoasVindasPerfil
            primeiroNome={profile.nome.split(' ')[0] ?? ''}
            pendencias={pendencias}
            primeiroAcesso={!profile.perfil_completado_em}
          />
        </Suspense>
      )}
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
        {/* O padding de baixo soma a barra de gestos para o último cartão da
            página não ficar embaixo dela. */}
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </div>
  )
}
