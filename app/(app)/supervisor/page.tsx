import { redirect } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Shield } from 'lucide-react'
import { CriarEventoDialog } from '@/components/shared/criar-evento-dialog'
import { PageSearch } from '@/components/shared/page-search'
import { SolicitacoesPanel } from '@/components/pastor/solicitacoes-panel'
import { Suspense } from 'react'
import { isThisWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createAdminClient } from '@/lib/supabase/admin'
import { CalendarioRede } from '@/components/rede/calendario-rede'
import {
  montarAgendaRede,
  type EncontroExistente,
  type EscalaRowBanco,
} from '@/lib/calendario-celula'
import type { Frequencia } from '@/lib/supabase/types'
import { carregarSaudeRede, type Granularidade } from '@/lib/saude-rede'
import { SaudeAlertas } from '@/components/rede/saude-alertas'
import { PresencaHistorico } from '@/components/rede/presenca-historico'

type RedeRow = { id: string; nome: string; descricao: string | null; cor: string }

const GRANULARIDADES: Granularidade[] = ['semana', 'mes', 'ano']

export default async function SupervisorPage({
  searchParams,
}: {
  searchParams: { q?: string; periodo?: string }
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/supervisor'))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const isSupervisor = ['supervisor', 'supervisor_treinamento', 'pastor', 'admin'].includes(profile.role)
  if (!isSupervisor) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-base font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Esta área é exclusiva para supervisores e pastores.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  let redeIds: string[] = []

  if (profile.role === 'supervisor' || profile.role === 'supervisor_treinamento') {
    const { data: redeSup } = await supabase
      .from('rede_supervisores')
      .select('rede_id')
      .eq('supervisor_id', user.id)
    redeIds = (redeSup ?? []).map((r) => (r as { rede_id: string }).rede_id)
  } else {
    const { data: todasRedes } = await supabase
      .from('redes')
      .select('id')
      .eq('igreja_id', profile.igreja_id)
    redeIds = (todasRedes ?? []).map((r) => (r as { id: string }).id)
  }

  if (redeIds.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-xl font-bold">Painel da rede</h1>
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Nenhuma rede atribuída ainda.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: redesData } = await supabase
    .from('redes')
    .select('id, nome, descricao, cor')
    .in('id', redeIds)
    .order('nome')

  const redes = (redesData ?? []) as RedeRow[]

  const { data: celulasData } = await supabase
    .from('celulas')
    .select('id, rede_id, ativa, nome, dia_semana, frequencia, horario')
    .in('rede_id', redeIds)
    .neq('ativa', false)

  type CelulaBasic = {
    id: string
    rede_id: string
    ativa: boolean
    nome: string
    dia_semana: number | null
    frequencia: Frequencia
    horario: string | null
  }
  const celulas = (celulasData ?? []) as CelulaBasic[]
  const celulaIds = celulas.map((c) => c.id)

  const { data: membrosData } = celulaIds.length > 0
    ? await supabase.from('celula_membros').select('celula_id').in('celula_id', celulaIds)
    : { data: [] }

  const { data: encontrosData } = celulaIds.length > 0
    ? await supabase
        .from('encontros')
        .select('celula_id, data_hora')
        .in('celula_id', celulaIds)
        .eq('status', 'agendado')
        .gte('data_hora', new Date().toISOString())
    : { data: [] }

  // ── Calendário da rede: encontros + escalas de todas as células
  const [{ data: encontrosCal }, { data: escalasCal }] = celulaIds.length > 0
    ? await Promise.all([
        supabase
          .from('encontros')
          .select('id, celula_id, data_hora, local, status')
          .in('celula_id', celulaIds),
        supabase
          .from('escalas')
          .select('celula_id, funcao, responsavel_id, data_prevista, encontro_id, encontros(data_hora)')
          .in('celula_id', celulaIds),
      ])
    : [{ data: [] }, { data: [] }]

  const responsavelIds = [...new Set(
    ((escalasCal ?? []) as { responsavel_id: string | null }[])
      .map((e) => e.responsavel_id)
      .filter((id): id is string => !!id)
  )]

  const { data: perfisEscalados } = responsavelIds.length > 0
    ? await supabase.from('profiles').select('id, nome').in('id', responsavelIds)
    : { data: [] }

  const nomePorUsuario = new Map(
    ((perfisEscalados ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome])
  )

  const diasRede = montarAgendaRede(
    celulas.map((c) => ({
      id: c.id,
      nome: c.nome,
      dia_semana: c.dia_semana,
      frequencia: c.frequencia,
      horario: c.horario,
    })),
    (encontrosCal ?? []) as unknown as (EncontroExistente & { celula_id: string })[],
    (escalasCal ?? []) as unknown as (EscalaRowBanco & { celula_id: string })[],
    nomePorUsuario,
  )

  const celulasPorRede = new Map<string, number>()
  celulas.forEach((c) => celulasPorRede.set(c.rede_id, (celulasPorRede.get(c.rede_id) ?? 0) + 1))

  const membrosPorRede = new Map<string, number>()
  const celulaRedeMap = new Map(celulas.map((c) => [c.id, c.rede_id]))
  ;(membrosData ?? []).forEach((m: { celula_id: string }) => {
    const redeId = celulaRedeMap.get(m.celula_id)
    if (redeId) membrosPorRede.set(redeId, (membrosPorRede.get(redeId) ?? 0) + 1)
  })

  const encontrosSemanaPorRede = new Map<string, number>()
  ;(encontrosData ?? []).forEach((e: { celula_id: string; data_hora: string }) => {
    if (!isThisWeek(new Date(e.data_hora), { locale: ptBR })) return
    const redeId = celulaRedeMap.get(e.celula_id)
    if (redeId) encontrosSemanaPorRede.set(redeId, (encontrosSemanaPorRede.get(redeId) ?? 0) + 1)
  })

  const totalCelulas = celulas.length
  const totalMembros = (membrosData ?? []).length
  const totalSemana = [...encontrosSemanaPorRede.values()].reduce((a, b) => a + b, 0)

  const { data: profileSup } = await supabase
    .from('profiles')
    .select('igreja_id')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()
  const [{ data: solicitacoesData }, { data: lideresData }] = await Promise.all([
    admin
      .from('solicitacoes_celula')
      .select('id, nome, telefone, email, idade, estado_civil, tem_filhos, filhos_detalhes, bairro, tipo_membro, melhor_dia, status, criado_em, lider_encaminhado_id')
      .eq('igreja_id', profileSup?.igreja_id ?? '')
      .neq('status', 'atendido')
      .order('criado_em', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, nome')
      .eq('igreja_id', profileSup?.igreja_id ?? '')
      .in('role', ['lider', 'lider_treinamento'])
      .order('nome'),
  ])

  const periodo = GRANULARIDADES.includes(searchParams.periodo as Granularidade)
    ? (searchParams.periodo as Granularidade)
    : 'semana'

  const saude = await carregarSaudeRede(redeIds, periodo)

  const q = (searchParams.q ?? '').toLowerCase().trim()
  const redesFiltradas = q ? redes.filter((r) => r.nome.toLowerCase().includes(q)) : redes

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Painel da rede</h1>
        <CriarEventoDialog tipoFixo="rede" label="Criar evento" />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalCelulas}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Células ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalMembros}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Membros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalSemana}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Saúde da rede: onde olhar primeiro */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Precisam de atenção
        </p>
        <SaudeAlertas
          inatingiveis={saude.inatingiveis}
          semSupervisao={saude.semSupervisao}
          multiplicandoEmBreve={saude.multiplicandoEmBreve}
          totalCelulas={saude.celulas.length}
        />
      </section>

      {/* Para onde a rede está indo */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Histórico
        </p>
        <PresencaHistorico serie={saude.serie} granularidade={periodo} basePath="/supervisor" />
      </section>

      {/* Calendário da rede */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Calendário da rede
        </p>
        <CalendarioRede dias={diasRede} />
      </section>

      {/* Solicitações de célula */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Solicitações de célula
            {(solicitacoesData ?? []).filter(s => s.status === 'pendente').length > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {(solicitacoesData ?? []).filter(s => s.status === 'pendente').length} novas
              </span>
            )}
          </p>
        </div>
        <SolicitacoesPanel
          solicitacoes={(solicitacoesData ?? []) as Parameters<typeof SolicitacoesPanel>[0]['solicitacoes']}
          lideres={(lideresData ?? []) as { id: string; nome: string }[]}
        />
      </section>

      {/* Lista de redes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Redes
          </p>
          <Suspense>
            <PageSearch placeholder="Buscar rede..." />
          </Suspense>
        </div>
        {redesFiltradas.length === 0 && q ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma rede encontrada para &quot;{searchParams.q}&quot;</p>
        ) : (
          <div className="space-y-2">
            {redesFiltradas.map((rede) => {
              const numCelulas = celulasPorRede.get(rede.id) ?? 0
              const numMembros = membrosPorRede.get(rede.id) ?? 0
              const numSemana = encontrosSemanaPorRede.get(rede.id) ?? 0

              return (
                <Link key={rede.id} href={`/rede/${rede.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: `${rede.cor}20` }}
                        >
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: rede.cor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{rede.nome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {numCelulas} {numCelulas === 1 ? 'célula' : 'células'} · {numMembros} membros
                            {numSemana > 0 && ` · ${numSemana} esta semana`}
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
      </div>
    </div>
  )
}
