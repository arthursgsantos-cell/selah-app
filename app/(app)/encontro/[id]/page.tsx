import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoSection } from '@/components/encontro/info-section'
import { EscalaSection } from '@/components/encontro/escala-section'
import { LancheSection } from '@/components/encontro/lanche-section'
import { WhatsAppSection } from '@/components/encontro/whatsapp-section'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { FuncaoEscala } from '@/lib/supabase/types'

const funcoes: FuncaoEscala[] = ['louvor', 'quebra_gelo', 'edificacao', 'compartilhar']

const statusConfig = {
  agendado: { label: 'Agendado', className: 'bg-blue-100 text-blue-700' },
  realizado: { label: 'Realizado', className: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
}

export default async function EncontroPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: encontro } = await supabase
    .from('encontros')
    .select('id, celula_id, data_hora, local, avisos, edificacao_resumo, status, card_imagem_url')
    .eq('id', params.id)
    .single()

  if (!encontro) notFound()

  // Fetch in parallel: celula, membership, profile, escalas, lanches, membros da celula
  const [
    { data: celula },
    { data: membroCelula },
    { data: profile },
    { data: escalasData },
    { data: lancheData },
    { data: membrosData },
  ] = await Promise.all([
    supabase.from('celulas').select('id, nome').eq('id', encontro.celula_id).single(),
    supabase
      .from('celula_membros')
      .select('papel')
      .eq('celula_id', encontro.celula_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('escalas')
      .select('funcao, responsavel_id, observacao')
      .eq('encontro_id', params.id),
    supabase
      .from('lanches')
      .select('id, emoji, item, responsavel, responsavel_id, ordem')
      .eq('encontro_id', params.id)
      .order('ordem', { ascending: true }),
    supabase
      .from('celula_membros')
      .select('user_id, profiles(nome)')
      .eq('celula_id', encontro.celula_id),
  ])

  const isMember = !!membroCelula
  const isLider = membroCelula?.papel === 'lider'
  const isAdminRole = profile?.role === 'supervisor' || profile?.role === 'pastor' || profile?.role === 'admin'
  const canEdit = isMember || isAdminRole

  type MembroBasic = { user_id: string; profiles: { nome: string } | null }
  type EscalaBasic = {
    funcao: FuncaoEscala
    responsavel_id: string | null
    observacao: string | null
  }

  const membros = ((membrosData ?? []) as unknown as MembroBasic[]).map((m) => ({
    user_id: m.user_id,
    nome: m.profiles?.nome ?? 'Membro',
  }))

  const escalasMap = new Map(
    ((escalasData ?? []) as EscalaBasic[]).map((e) => [e.funcao, e])
  )

  const escalas = funcoes.map((funcao) => {
    const e = escalasMap.get(funcao)
    const responsavelNome = e?.responsavel_id
      ? (membros.find((m) => m.user_id === e.responsavel_id)?.nome ?? null)
      : null
    return {
      funcao,
      responsavel_id: e?.responsavel_id ?? null,
      responsavel_nome: responsavelNome,
      observacao: e?.observacao ?? null,
    }
  })

  const isEscaladoEdificacao = escalasMap.get('edificacao')?.responsavel_id === user.id
  const canSeeEdificacaoResumo = isLider || isAdminRole || isEscaladoEdificacao

  const status = encontro.status as keyof typeof statusConfig
  const statusInfo = statusConfig[status] ?? statusConfig.agendado

  const dataFormatada = format(
    new Date(encontro.data_hora),
    "EEEE, d 'de' MMMM",
    { locale: ptBR }
  )

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          {celula?.nome ?? 'Célula'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold capitalize">{dataFormatada}</h1>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`}
          >
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Informações */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <InfoSection
            encontroId={params.id}
            dataHora={encontro.data_hora}
            local={encontro.local}
            avisos={encontro.avisos}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      {/* Escala */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Escala</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <EscalaSection
            encontroId={params.id}
            escalas={escalas}
            membros={membros}
            canEdit={canEdit}
            canSeeEdificacaoResumo={canSeeEdificacaoResumo}
            edificacaoResumo={encontro.edificacao_resumo}
          />
        </CardContent>
      </Card>

      {/* Lista de lanche */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Lista de lanche</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <LancheSection
            encontroId={params.id}
            lanches={lancheData ?? []}
            currentUserId={user.id}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      {/* Compartilhar */}
      {canEdit && (
        <Card>
          <CardContent className="pt-4">
            <WhatsAppSection
              celulaNome={celula?.nome ?? ''}
              dataHora={encontro.data_hora}
              local={encontro.local}
              avisos={encontro.avisos}
              escalas={escalas}
              lanches={(lancheData ?? []).map((l) => ({
                emoji: l.emoji,
                item: l.item,
                responsavel: l.responsavel,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
