import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Bell, CheckCheck, Inbox, ArrowLeft } from 'lucide-react'
import { SolicitacaoNotificacaoCard } from '@/components/home/solicitacao-notificacao-card'
import { SolicitacoesPanel } from '@/components/pastor/solicitacoes-panel'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function SolicitacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nome, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const canView = ['lider', 'lider_treinamento', 'supervisor', 'supervisor_treinamento', 'pastor', 'admin'].includes(profile.role)
  if (!canView) redirect('/home')

  const isAdmin = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento'].includes(profile.role)

  // ── Admin / Supervisor view: all church solicitações ───────────────────
  if (isAdmin) {
    const adminClient = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ data: todasSolicitacoes }, { data: lideresData }] = await Promise.all([
      (adminClient as any)
        .from('solicitacoes_celula')
        .select('id, nome, telefone, email, idade, estado_civil, tem_filhos, filhos_detalhes, bairro, tipo_membro, melhor_dia, status, criado_em, lider_encaminhado_id')
        .eq('igreja_id', profile.igreja_id)
        .neq('status', 'atendido')
        .order('criado_em', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, nome')
        .eq('igreja_id', profile.igreja_id)
        .in('role', ['lider', 'lider_treinamento'])
        .order('nome'),
    ])

    const solicitacoes = (todasSolicitacoes ?? []) as Parameters<typeof SolicitacoesPanel>[0]['solicitacoes']
    const lideres = (lideresData ?? []) as { id: string; nome: string }[]
    const pendentes = solicitacoes.filter((s) => s.status === 'pendente').length

    return (
      <div className="space-y-6 max-w-2xl mx-auto pb-8">
        <Button variant="ghost" size="sm" render={<Link href="/pastor" />} className="-ml-1">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="h-5 w-5 text-primary" />
            {pendentes > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold">Solicitações de célula</h1>
            <p className="text-xs text-muted-foreground">
              Todas as solicitações da igreja
              {pendentes > 0 && (
                <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendentes} novas
                </span>
              )}
            </p>
          </div>
        </div>
        <SolicitacoesPanel solicitacoes={solicitacoes} lideres={lideres} />
      </div>
    )
  }

  // ── Lider view: only solicitações assigned to this leader ──────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: todasSolicitacoes } = await (supabase as any)
    .from('solicitacoes_celula')
    .select('id, nome, telefone, email, idade, bairro, melhor_dia, estado_civil, tem_filhos, filhos_detalhes, tipo_membro, criado_em, status')
    .eq('lider_encaminhado_id', user.id)
    .order('criado_em', { ascending: false })

  const solicitacoes = (todasSolicitacoes ?? []) as any[]
  const ativas = solicitacoes.filter((s) => s.status === 'encaminhado')
  const atendidas = solicitacoes.filter((s) => s.status === 'atendido')

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Bell className="h-5 w-5 text-primary" />
          {ativas.length > 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </div>
        <div>
          <h1 className="text-lg font-bold">Solicitações de célula</h1>
          <p className="text-xs text-muted-foreground">
            Pessoas encaminhadas para você
          </p>
        </div>
      </div>

      {/* Pendentes */}
      {ativas.length > 0 ? (
        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Pendentes · {ativas.length}
          </p>
          <div className="space-y-2">
            {ativas.map((sol) => (
              <SolicitacaoNotificacaoCard key={sol.id} sol={sol} />
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma solicitação pendente</p>
          <p className="text-xs text-muted-foreground mt-1">
            Quando o supervisor encaminhar alguém para você, aparecerá aqui.
          </p>
        </div>
      )}

      {/* Atendidas */}
      {atendidas.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCheck className="h-3.5 w-3.5 text-green-600" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Atendidas · {atendidas.length}
            </p>
          </div>
          <div className="space-y-2 opacity-60">
            {atendidas.map((sol) => (
              <SolicitacaoNotificacaoCard key={sol.id} sol={sol} showAtendido={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
