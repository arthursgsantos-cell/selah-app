import { FundoGaleria } from '@/components/shared/fundo-galeria'
import { loginCom } from '@/lib/destino-login'
import { PAINEL } from '@/lib/estilos'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CelulaTabs } from '@/components/celula/celula-tabs'
import { FrequenciaIrmaos } from '@/components/rede/frequencia-irmaos'
import { carregarFrequenciaIrmaos } from '@/lib/frequencia-irmaos'
import { CelulaLogoUpload } from '@/components/celula/celula-logo-upload'
import { CelulaCapaUpload } from '@/components/celula/celula-capa-upload'
import { CelulaFundoPagina } from '@/components/celula/celula-fundo-pagina'
import { EditarCelulaDialog } from '@/components/supervisor/editar-celula-dialog'
import { projetarDatasCelula, montarEscalasCalendario, type EscalaRowBanco } from '@/lib/calendario-celula'

type MembroComProfile = {
  user_id: string
  papel: 'lider' | 'membro'
  profiles: { nome: string; avatar_url: string | null; conjuge_id: string | null; data_nascimento_1: string | null; data_nascimento_2: string | null; data_casamento: string | null; endereco: string | null; endereco_maps: string | null } | null
}

type EncontroRow = {
  id: string
  data_hora: string
  local: string | null
  local_maps_url: string | null
  status: string
  card_imagem_url: string | null
}

export default async function CelulaDetalhesPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(loginCom(`/celula/${params.id}`))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const canView = ['supervisor', 'supervisor_treinamento', 'pastor', 'admin'].includes(profile.role)
  if (!canView) redirect('/celula')

  const admin = createAdminClient()

  const [
    { data: celula },
    { data: membrosData },
    { data: encontrosData },
    { data: fotosData },
    { data: escalasData },
    { data: preCadastradosData },
    { data: celulasDisponiveisData },
  ] = await Promise.all([
    admin
      .from('celulas')
      .select('id, nome, descricao, logo_url, capa_url, cor, cor_secundaria, fundo_tipo, fundo_imagem_url, fundo_opacidade, fundo_galeria, fundo_galeria_opacidade, fundo_auto_cor, fundo_auto_cor_origem, capa_automatica, frequencia, local_padrao, dia_semana, horario, rede_id, celula_mae_id, multiplicacao_prevista')
      .eq('id', params.id)
      .single(),
    admin
      .from('celula_membros')
      .select('user_id, papel, profiles(nome, avatar_url, conjuge_id, data_nascimento_1, data_nascimento_2, data_casamento, endereco, endereco_maps)')
      .eq('celula_id', params.id),
    admin
      .from('encontros')
      .select('id, data_hora, local, local_maps_url, status, card_imagem_url')
      .eq('celula_id', params.id)
      .order('data_hora', { ascending: false })
      .limit(20),
    admin
      .from('fotos_comunidade')
      .select('id, url, criado_em')
      .eq('celula_id', params.id)
      .order('criado_em', { ascending: false }),
    // Escalas da célula: as já ligadas a um encontro e as ainda "de sobre aviso".
    admin
      .from('escalas')
      .select('funcao, responsavel_id, data_prevista, encontro_id, encontros(data_hora)')
      .eq('celula_id', params.id),
    // Pessoas já organizadas nesta célula que ainda não criaram conta.
    admin
      .from('membros_pre_cadastro')
      .select('id, nome, email, telefone, cargo, celula_id')
      .eq('celula_id', params.id)
      .is('profile_id', null)
      .order('nome'),
    // Todas as células, para poder mover um pré-cadastrado entre elas.
    admin.from('celulas').select('id, nome').neq('ativa', false).order('nome'),
  ])

  if (!celula) notFound()

  const membros = ((membrosData ?? []) as unknown as MembroComProfile[]).map((m) => ({
    user_id: m.user_id,
    nome: m.profiles?.nome ?? 'Membro',
    avatar_url: m.profiles?.avatar_url ?? null,
    conjuge_id: m.profiles?.conjuge_id ?? null,
    data_nascimento_1: m.profiles?.data_nascimento_1 ?? null,
    data_nascimento_2: m.profiles?.data_nascimento_2 ?? null,
    data_casamento: m.profiles?.data_casamento ?? null,
    endereco: m.profiles?.endereco ?? null,
    endereco_maps: m.profiles?.endereco_maps ?? null,
    papel: m.papel,
  }))

  const lideres = membros.filter((m) => m.papel === 'lider')

  const encontros = ((encontrosData ?? []) as EncontroRow[]).map((e) => ({
    id: e.id,
    data_hora: e.data_hora,
    local: e.local,
    local_maps_url: e.local_maps_url,
    status: e.status,
    card_imagem_url: e.card_imagem_url,
  }))

  // ── Calendário: datas futuras + escalas (ligadas ao encontro ou de sobre aviso)
  const datasCalendario = projetarDatasCelula(
    { dia_semana: celula.dia_semana, frequencia: celula.frequencia, horario: celula.horario },
    encontros,
  )

  const escalasCalendario = montarEscalasCalendario(
    (escalasData ?? []) as unknown as EscalaRowBanco[],
    membros,
  )

  const membroIds = membros.map((m) => m.user_id)
  const { data: dependentesData } = membroIds.length
    ? await admin
        .from('dependentes')
        .select('profile_id, co_profile_id, nome, data_nascimento, tipo, sexo')
        // Ver a nota em `celula/page.tsx`: o cadastro do casal tem um dono só.
        .or(`profile_id.in.(${membroIds.join(',')}),co_profile_id.in.(${membroIds.join(',')})`)
    : { data: [] }

  const iniciais = celula.nome
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()

  const frequenciaLabel = celula.frequencia === 'semanal' ? 'Semanal' : 'Quinzenal'

  // Fotos da própria célula, já em ordem decrescente de data na consulta.
  const aparencia = celula as unknown as {
    fundo_galeria?: boolean; fundo_galeria_opacidade?: number
    fundo_auto_cor?: boolean; fundo_auto_cor_origem?: string | null
    capa_automatica?: boolean
  }
  const fotosDoFundo = ((fotosData ?? []) as { url: string }[]).map((f) => f.url)

  // Nome da rede: entra na marca d'água do visualizador de fotos.
  const { data: redeDaCelula } = (celula as { rede_id?: string | null }).rede_id
    ? await admin.from('redes').select('nome').eq('id', (celula as { rede_id: string }).rede_id).maybeSingle()
    : { data: null }
  const redeNome = (redeDaCelula as { nome: string } | null)?.nome ?? null

  // Frequência desta célula. A página inteira já é só de supervisão para cima
  // (ver `canView` acima), então não há gate a repetir aqui.
  const frequenciaCelula = await carregarFrequenciaIrmaos([
    {
      id: params.id,
      nome: celula.nome,
      redeNome: redeNome ?? '',
      redeCor: celula.cor ?? '#6366f1',
      liderNome: lideres.map((l) => l.nome).join(' e ') || null,
      liderTelefone: null,
    },
  ])

  // Lista para transferir a célula de rede. Só a gestão recebe (a lista
  // vazia esconde o campo no diálogo).
  const { data: redesData } = await admin.from('redes').select('id, nome').order('nome')
  const redesDisponiveis = (redesData ?? []) as { id: string; nome: string }[]
  const galeriaAtiva = aparencia.fundo_galeria ?? true
  const galeriaOpacidade = aparencia.fundo_galeria_opacidade ?? 15

  // A capa automática usa a foto mais recente da galeria; os cards de encontro
  // ficam de fora porque são artes com texto.
  const capaAutomatica = aparencia.capa_automatica ?? true
  const fotoMaisRecente = fotosDoFundo[0] ?? null
  const capaExibida = capaAutomatica ? fotoMaisRecente ?? celula.capa_url : celula.capa_url

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <FundoGaleria fotos={fotosDoFundo} opacidade={galeriaOpacidade} ativo={galeriaAtiva} />

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/supervisor" />} className="-ml-1">
          <ArrowLeft className="h-4 w-4" />
          Voltar para a rede
        </Button>
        <CelulaFundoPagina
          celulaId={params.id}
          cor={celula.cor ?? '#6366f1'}
          corSecundaria={celula.cor_secundaria}
          fundoTipo={celula.fundo_tipo ?? 'cor'}
          fundoImagemUrl={celula.fundo_imagem_url}
          fundoOpacidade={celula.fundo_opacidade}
          galeriaAtiva={galeriaAtiva}
          galeriaOpacidade={galeriaOpacidade}
          totalFotos={fotosDoFundo.length}
          capaUrl={capaExibida}
          autoCorAtivo={aparencia.fundo_auto_cor ?? true}
          autoCorOrigem={aparencia.fundo_auto_cor_origem ?? null}
          canEdit={true}
        />
      </div>

      <CelulaCapaUpload
        celulaId={params.id}
        capaUrl={celula.capa_url}
        fotoMaisRecente={fotoMaisRecente}
        capaAutomatica={capaAutomatica}
        cor={celula.cor ?? '#6366f1'}
        canEdit={true}
      />

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <CelulaLogoUpload celulaId={params.id} logoUrl={celula.logo_url} iniciais={iniciais} cor={null} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-bold leading-tight">{celula.nome}</h1>
                <EditarCelulaDialog
                  celulaId={params.id}
                  nome={celula.nome}
                  descricao={celula.descricao}
                  localPadrao={celula.local_padrao}
                  frequencia={celula.frequencia}
                  diaSemana={celula.dia_semana}
                  horario={celula.horario}
                  cor={null}
                  canDelete={true}
                  redeId={(celula as { rede_id?: string | null }).rede_id ?? null}
                  redes={canView ? redesDisponiveis : []}
                  celulaMaeId={celula.celula_mae_id}
                  multiplicacaoPrevista={celula.multiplicacao_prevista}
                  celulasParaMae={(celulasDisponiveisData ?? [])
                    .filter((c) => c.id !== params.id) as { id: string; nome: string }[]}
                />
              </div>
              {celula.descricao && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{celula.descricao}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="secondary" className="text-xs">{frequenciaLabel}</Badge>
                {celula.local_padrao && (
                  <Badge variant="outline" className="text-xs">{celula.local_padrao}</Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {membros.length} {membros.length === 1 ? 'membro' : 'membros'}
                </Badge>
              </div>
            </div>
          </div>

          {lideres.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">{lideres.length === 1 ? 'Líder' : 'Líderes'}</p>
              <div className="flex flex-wrap gap-2">
                {lideres.map((lider) => (
                  <div key={lider.user_id} className="flex items-center gap-1.5 bg-muted rounded-full pl-0.5 pr-3 py-0.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={lider.avatar_url ?? undefined} alt={lider.nome} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {lider.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{lider.nome.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CelulaTabs
        encontros={encontros}
        membros={membros}
        celulaId={params.id}
        celulaNome={celula.nome}
        localPadrao={celula.local_padrao}
        diaSemana={celula.dia_semana}
        horarioPadrao={celula.horario}
        dependentes={dependentesData ?? []}
        celulaColor={null}
        fotosInit={(fotosData ?? []) as { id: string; url: string; criado_em: string }[]}
        redeNome={redeNome}
        canUpload={true}
        datasCalendario={datasCalendario}
        escalasCalendario={escalasCalendario}
        canEditEscala={true}
        preCadastrados={preCadastradosData ?? []}
        celulasDisponiveis={(celulasDisponiveisData ?? []) as { id: string; nome: string }[]}
        frequencia={<FrequenciaIrmaos {...frequenciaCelula} ocultarCelula />}
      />
    </div>
  )
}
