import { redirect, notFound } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { InfoSection } from '@/components/encontro/info-section'
import { EncontroCapaUpload } from '@/components/encontro/encontro-capa-upload'
import { EscalaSection } from '@/components/encontro/escala-section'
import { LancheSection } from '@/components/encontro/lanche-section'
import { FotosEncontroSection } from '@/components/encontro/fotos-encontro-section'
import { EncontroTabs } from '@/components/encontro/encontro-tabs'
import { WhatsAppSection } from '@/components/encontro/whatsapp-section'
import { ResumoCultoCard } from '@/components/encontro/resumo-culto-card'
import { PresencaSection } from '@/components/encontro/presenca-section'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { FuncaoEscala } from '@/lib/supabase/types'
import { buscarPresencasEncontroAction, buscarMinhaPresencaAction } from '@/app/actions/presenca'
import { FUNCOES_ESCALA as funcoes } from '@/lib/escala-funcoes'

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
  if (!user) redirect(loginCom(`/encontro/${params.id}`))

  const { data: encontro } = await supabase
    .from('encontros')
    .select('id, celula_id, data_hora, local, local_maps_url, avisos, edificacao_resumo, resumo_culto_id, status, card_imagem_url')
    .eq('id', params.id)
    .single()

  if (!encontro) notFound()

  const admin = createAdminClient()
  const encontroDate = encontro.data_hora.split('T')[0]

  // Fetch in parallel: celula, membership, profile, escalas, lanches, membros da celula
  const [
    { data: celula },
    { data: membroCelula },
    { data: profile },
    { data: escalasData },
    { data: lancheData },
    { data: membrosData },
    { data: fotosData },
  ] = await Promise.all([
    supabase.from('celulas').select('id, nome').eq('id', encontro.celula_id).single(),
    supabase
      .from('celula_membros')
      .select('papel')
      .eq('celula_id', encontro.celula_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('profiles').select('role, igreja_id').eq('id', user.id).single(),
    supabase
      .from('escalas')
      .select('funcao, responsavel_id, observacao, com_conjuge')
      .eq('encontro_id', params.id),
    supabase
      .from('lanches')
      .select('id, emoji, item, responsavel, responsavel_id, ordem')
      .eq('encontro_id', params.id)
      .order('ordem', { ascending: true }),
    supabase
      .from('celula_membros')
      .select('user_id, profiles(nome, endereco, endereco_maps)')
      .eq('celula_id', encontro.celula_id),
    supabase
      .from('fotos_comunidade')
      .select('id, url, criado_por')
      .eq('encontro_id', params.id)
      .order('criado_em', { ascending: false }),
  ])

  const fotosEncontro = (fotosData ?? []) as { id: string; url: string; criado_por: string | null }[]

  // Sugestões de lanches usados em encontros anteriores desta célula
  const { data: lanchesSugestoes } = await admin
    .from('lanches')
    .select('emoji, item')
    .in('encontro_id',
      (await admin
        .from('encontros')
        .select('id')
        .eq('celula_id', encontro.celula_id)
        .neq('id', params.id)
        .order('data_hora', { ascending: false })
        .limit(10)
      ).data?.map((e) => e.id) ?? []
    )
    .order('item')

  const sugestoesDedupadas = Array.from(
    new Map((lanchesSugestoes ?? []).map((l) => [l.item.toLowerCase(), { emoji: l.emoji ?? '', item: l.item }])).values()
  ).slice(0, 20)

  // Fetch conjuge info for current user
  const { data: myProfileFull } = await admin
    .from('profiles').select('conjuge_id').eq('id', user.id).single()

  let conjugeNome: string | null = null
  if (myProfileFull?.conjuge_id) {
    const { data: conjugeProfile } = await admin
      .from('profiles').select('nome').eq('id', myProfileFull.conjuge_id).single()
    conjugeNome = conjugeProfile?.nome?.split(' ')[0] ?? null
  } else {
    const { data: dep } = await admin
      .from('dependentes').select('nome').eq('profile_id', user.id).eq('tipo', 'cônjuge').maybeSingle()
    conjugeNome = dep?.nome?.split(' ')[0] ?? null
  }

  // Fetch tem filhos
  const { data: filhosDep } = await admin
    .from('dependentes').select('id').eq('profile_id', user.id).eq('tipo', 'filho').limit(1)
  const temFilhos = (filhosDep?.length ?? 0) > 0

  // Fetch presença
  const [minhaPresenca, presencas] = await Promise.all([
    buscarMinhaPresencaAction(params.id),
    buscarPresencasEncontroAction(params.id),
  ])

  // Fetch available resumos for this church (recent ones)
  const { data: resumosDisponiveis } = profile?.igreja_id
    ? await admin
        .from('resumos_culto')
        .select('id, titulo, conteudo, pdf_url, data_culto, validade_ate, created_by, publicado_por')
        .eq('igreja_id', profile.igreja_id)
        .order('data_culto', { ascending: false })
        .limit(8)
    : { data: [] }

  // Quem publicou: o roteiro importado da planilha traz o nome escrito lá; o
  // publicado pelo app guarda só o uuid, e o nome vem do perfil.
  type ResumoRow = {
    id: string; titulo: string; conteudo: string; pdf_url: string | null
    data_culto: string; validade_ate: string
    created_by: string | null; publicado_por: string | null
  }
  const resumosRaw = (resumosDisponiveis ?? []) as ResumoRow[]
  const autorIds = [...new Set(resumosRaw.map((r) => r.created_by).filter(Boolean))] as string[]

  const { data: autoresResumo } = autorIds.length > 0
    ? await admin.from('profiles').select('id, nome').in('id', autorIds)
    : { data: [] }

  const nomeDoAutor = new Map(
    ((autoresResumo ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome])
  )

  const resumos = resumosRaw.map((r) => ({
    ...r,
    autor: r.publicado_por?.trim() || (r.created_by ? nomeDoAutor.get(r.created_by) ?? null : null),
  }))

  const isMember = !!membroCelula
  const isLider = membroCelula?.papel === 'lider'
  const isAdminRole = profile?.role === 'supervisor' || profile?.role === 'pastor' || profile?.role === 'admin'
  const canEdit = isMember || isAdminRole

  type MembroBasic = { user_id: string; profiles: { nome: string; endereco: string | null; endereco_maps: string | null } | null }
  type EscalaBasic = {
    funcao: FuncaoEscala
    responsavel_id: string | null
    observacao: string | null
    com_conjuge: boolean
  }

  const membros = ((membrosData ?? []) as unknown as MembroBasic[]).map((m) => ({
    user_id: m.user_id,
    nome: m.profiles?.nome ?? 'Membro',
    endereco: m.profiles?.endereco ?? null,
    endereco_maps: m.profiles?.endereco_maps ?? null,
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
      com_conjuge: e?.com_conjuge ?? false,
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
      <Button variant="ghost" size="sm" render={<Link href="/celula" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a célula
      </Button>

      {/* Capa */}
      {(encontro.card_imagem_url || canEdit) && (
        <EncontroCapaUpload encontroId={params.id} capaUrl={encontro.card_imagem_url ?? null} />
      )}

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

      <EncontroTabs
        totalEscalados={escalas.filter((e) => e.responsavel_id).length}
        totalLanches={(lancheData ?? []).length}
        totalFotos={fotosEncontro.length}
        encontro={
          <>
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
            localMapsUrl={encontro.local_maps_url ?? null}
            avisos={encontro.avisos}
            canEdit={canEdit}
            membrosAnfitriao={membros.filter((m) => m.endereco)}
          />
        </CardContent>
      </Card>


      {/* Presença */}
      {isMember && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>Presença</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <PresencaSection
              encontroId={params.id}
              minhaPresenca={minhaPresenca}
              conjuge={conjugeNome ? { id: myProfileFull?.conjuge_id ?? null, nome: conjugeNome } : null}
              temFilhos={temFilhos}
              presencas={presencas}
              canSeeAll={isLider || isAdminRole}
            />
          </CardContent>
        </Card>
      )}
          </>
        }
        programacao={
          <>
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
            resumosDisponiveis={resumos}
            resumoCultoId={encontro.resumo_culto_id ?? null}
            currentUserId={user.id}
            conjugeNome={conjugeNome}
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
            conjugeNome={conjugeNome}
            sugestoes={sugestoesDedupadas}
          />
        </CardContent>
      </Card>
          </>
        }
        registro={
          <>
      {/* Fotos do dia */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Fotos do encontro</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <FotosEncontroSection
            encontroId={params.id}
            fotosInit={fotosEncontro}
            currentUserId={user.id}
            canUpload={canEdit}
            canModerar={isLider || isAdminRole}
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
              localMapsUrl={encontro.local_maps_url ?? null}
              avisos={encontro.avisos}
              escalas={escalas}
              lanches={(lancheData ?? []).map((l) => ({
                emoji: l.emoji,
                item: l.item,
                responsavel: l.responsavel,
              }))}
              cardImagemUrl={encontro.card_imagem_url ?? null}
            />
          </CardContent>
        </Card>
      )}
          </>
        }
      />
    </div>
  )
}
