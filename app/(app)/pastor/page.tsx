import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ChevronRight, Church, Shield } from 'lucide-react'
import { CriarRedeDialog } from '@/components/pastor/criar-rede-dialog'
import { CriarEventoDialog } from '@/components/shared/criar-evento-dialog'

export default async function PastorPage() {
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
            <Church className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-base font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Esta área é exclusiva para pastores.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [
    { data: igreja },
    { data: redes },
    { count: totalMembros },
  ] = await Promise.all([
    supabase.from('igrejas').select('nome, logo_url').eq('id', profile.igreja_id).single(),
    supabase.from('redes').select('id, nome, descricao, cor').eq('igreja_id', profile.igreja_id).order('nome'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('igreja_id', profile.igreja_id),
  ])

  type RedeRow = { id: string; nome: string; descricao: string | null; cor: string }
  const redeIds = (redes ?? []).map((r) => (r as RedeRow).id)

  // Fetch celulas and supervisors only if there are redes
  const [celulasData, redeSupervisoresData] = await Promise.all([
    redeIds.length > 0
      ? supabase.from('celulas').select('id, rede_id, ativa').in('rede_id', redeIds)
      : Promise.resolve({ data: [] }),
    redeIds.length > 0
      ? supabase
          .from('rede_supervisores')
          .select('rede_id, supervisor_id, profiles(nome)')
          .in('rede_id', redeIds)
      : Promise.resolve({ data: [] }),
  ])

  type CelulaBasic = { id: string; rede_id: string; ativa: boolean }
  type RedeSupervisorRow = {
    rede_id: string
    supervisor_id: string
    profiles: { nome: string } | null
  }

  const celulas = (celulasData.data ?? []) as CelulaBasic[]
  const redeSupervisores = (redeSupervisoresData.data ?? []) as unknown as RedeSupervisorRow[]

  // Count active celulas per rede
  const celulasPorRede = new Map<string, number>()
  celulas.forEach((c) => {
    if (c.ativa) {
      celulasPorRede.set(c.rede_id, (celulasPorRede.get(c.rede_id) ?? 0) + 1)
    }
  })

  // Supervisors per rede
  const supervisoresPorRede = new Map<string, string[]>()
  redeSupervisores.forEach((rs) => {
    const nome = rs.profiles?.nome ?? 'Supervisor'
    supervisoresPorRede.set(rs.rede_id, [...(supervisoresPorRede.get(rs.rede_id) ?? []), nome])
  })

  const totalRedes = (redes ?? []).length
  const totalCelulas = celulas.filter((c) => c.ativa).length

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{igreja?.nome ?? 'Painel da igreja'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Visão geral</p>
        </div>
        <div className="flex gap-2">
          <CriarEventoDialog tipoFixo="culto" label="Criar evento" />
          <CriarRedeDialog />
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalRedes}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Redes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalCelulas}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Células ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalMembros ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Membros</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de redes */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Redes
        </p>

        {totalRedes === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma rede criada ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique em &quot;Nova rede&quot; para começar
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {((redes ?? []) as RedeRow[]).map((rede) => {
              const numCelulas = celulasPorRede.get(rede.id) ?? 0
              const supervisores = supervisoresPorRede.get(rede.id) ?? []

              return (
                <Link key={rede.id} href="/supervisor">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: `${rede.cor}20` }}
                        >
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: rede.cor }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{rede.nome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {numCelulas} {numCelulas === 1 ? 'célula' : 'células'}
                            {supervisores.length > 0 && ` · ${supervisores.join(', ')}`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
