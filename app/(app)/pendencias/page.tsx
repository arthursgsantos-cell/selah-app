import { redirect } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClipboardList, Users, UserCheck, ArrowRight, CheckCheck, ChevronLeft } from 'lucide-react'
import { SolicitacaoCargoCard } from '@/components/pendencias/solicitacao-cargo-card'
import { PreCadastroCard } from '@/components/pendencias/pre-cadastro-card'

export default async function PendenciasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/pendencias'))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/onboarding')
  if (!['pastor', 'admin'].includes(profile.role)) redirect('/home')

  const admin = createAdminClient()

  const [
    { data: solicitacoesCargo },
    { data: presCadastro },
    { data: solicitacoesCelula },
    { data: todosProfiles },
  ] = await Promise.all([
    admin
      .from('solicitacoes_cargo')
      .select('id, cargo_solicitado, mensagem, criado_em, vinculo, celulas(nome), profiles(nome, avatar_url, role)')
      .eq('igreja_id', profile.igreja_id)
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false }),
    admin
      .from('membros_pre_cadastro')
      .select('id, nome, telefone, obs')
      .eq('igreja_id', profile.igreja_id)
      .eq('status', 'pendente')
      .is('profile_id', null)
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('solicitacoes_celula')
      .select('id, status')
      .eq('igreja_id', profile.igreja_id)
      .neq('status', 'atendido'),
    admin
      .from('profiles')
      .select('id, nome')
      .eq('igreja_id', profile.igreja_id),
  ])

  const totalCargo = solicitacoesCargo?.length ?? 0
  const totalPreCadastro = presCadastro?.length ?? 0
  const celulaPendente = (solicitacoesCelula ?? []).filter((s: any) => s.status === 'pendente').length
  const celulaTotal = solicitacoesCelula?.length ?? 0
  const total = totalCargo + totalPreCadastro + celulaPendente

  const profiles = (todosProfiles ?? []) as { id: string; nome: string }[]

  function similares(nome: string): { id: string; nome: string }[] {
    const words = nome.toLowerCase().split(' ').filter(Boolean)
    return profiles.filter((p) => {
      const pNome = p.nome.toLowerCase()
      return words.some((w) => w.length > 3 && pNome.includes(w))
    }).slice(0, 5)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/home" className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="relative">
          <ClipboardList className="h-5 w-5 text-primary" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </div>
        <div>
          <h1 className="text-lg font-bold">Pendências</h1>
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? 'Nenhuma pendência no momento'
              : `${total} ite${total === 1 ? 'm' : 'ns'} aguardando revisão`}
          </p>
        </div>
      </div>

      {total === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <CheckCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Tudo em dia!</p>
          <p className="text-xs text-muted-foreground mt-1">Nenhuma aprovação ou confirmação pendente.</p>
        </div>
      )}

      {/* Solicitações de cargo */}
      {totalCargo > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Quem se apresentou</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {totalCargo}
            </span>
          </div>
          <div className="space-y-2">
            {(solicitacoesCargo ?? []).map((sol: any) => (
              <SolicitacaoCargoCard key={sol.id} sol={sol} />
            ))}
          </div>
        </section>
      )}

      {/* Compatibilidade de pré-cadastro */}
      {totalPreCadastro > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold">Pré-cadastros sem vínculo</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {totalPreCadastro}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Membros adicionados manualmente que ainda não criaram conta. Vincule ao perfil quando o usuário se cadastrar.
          </p>
          <div className="space-y-2">
            {(presCadastro ?? []).map((entry: any) => (
              <PreCadastroCard
                key={entry.id}
                entry={entry}
                similares={similares(entry.nome)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Solicitações de célula — resumo */}
      <section>
        <Link
          href="/solicitacoes"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-muted shrink-0">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Solicitações de célula</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {celulaTotal === 0
                  ? 'Nenhuma solicitação aberta'
                  : `${celulaTotal} aberta${celulaTotal !== 1 ? 's' : ''}${celulaPendente > 0 ? ` · ${celulaPendente} nova${celulaPendente !== 1 ? 's' : ''}` : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {celulaPendente > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                {celulaPendente} nova{celulaPendente !== 1 ? 's' : ''}
              </span>
            )}
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </section>
    </div>
  )
}
