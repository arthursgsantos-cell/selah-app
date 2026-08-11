import { redirect } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Church } from 'lucide-react'
import { CriarRedeDialog } from '@/components/pastor/criar-rede-dialog'
import { CriarEventoDialog } from '@/components/shared/criar-evento-dialog'
import { ResumoCultoSection } from '@/components/pastor/resumo-culto-section'
import { ImportacaoSection, type RegistroImportacao } from '@/components/pastor/importacao-section'
import { IgrejaLogoUpload } from '@/components/pastor/igreja-logo-upload'
import { IgrejaInfoForm } from '@/components/pastor/igreja-info-form'
import { SolicitacoesPanel } from '@/components/pastor/solicitacoes-panel'
import { SolicitacoesGeralPanel, type SolicitacaoGeral } from '@/components/pastor/solicitacoes-geral-panel'
import { GaleriaComunidadeSection } from '@/components/pastor/galeria-comunidade-section'
import { carregarSaudeRede, type Granularidade } from '@/lib/saude-rede'
import { SaudeAlertas } from '@/components/rede/saude-alertas'
import { PresencaHistorico } from '@/components/rede/presenca-historico'

const GRANULARIDADES: Granularidade[] = ['semana', 'mes', 'ano']

export default async function PastorPage({
  searchParams,
}: {
  searchParams: { periodo?: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/pastor'))

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

  const admin = createAdminClient()

  const [
    { data: igreja },
    { data: redes },
    { count: totalMembros },
    { data: resumosData },
    { data: solicitacoesData },
    { data: lideresData },
    { data: fotosData },
    { data: encontroFotosData },
    { data: importacoesData },
    { data: pedidosData },
  ] = await Promise.all([
    supabase.from('igrejas').select('nome, logo_url, descricao, horario_culto, endereco, fundada_em, instagram_url, facebook_url, youtube_url, spotify_url, pastor_nome, pastor_titulo, pix_chave, pix_tipo, pix_nome, pix_cidade, contribuicao_texto, dados_bancarios, contribuicao_ativa, ao_vivo_url, ao_vivo_ativo').eq('id', profile.igreja_id).single(),
    supabase.from('redes').select('id, nome, descricao, cor').eq('igreja_id', profile.igreja_id).order('nome'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('igreja_id', profile.igreja_id),
    admin
      .from('resumos_culto')
      .select('id, titulo, conteudo, pdf_url, data_culto, validade_ate, created_by, publicado_por')
      .eq('igreja_id', profile.igreja_id)
      .order('data_culto', { ascending: false })
      .limit(5),
    admin
      .from('solicitacoes_celula')
      .select('id, nome, telefone, email, idade, estado_civil, tem_filhos, filhos_detalhes, bairro, tipo_membro, melhor_dia, status, criado_em, lider_encaminhado_id')
      .eq('igreja_id', profile.igreja_id)
      .neq('status', 'atendido')
      .order('criado_em', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, nome')
      .eq('igreja_id', profile.igreja_id)
      .in('role', ['lider', 'lider_treinamento'])
      .order('nome'),
    admin
      .from('fotos_comunidade')
      .select('id, url, criado_em, celulas(nome, redes(nome))')
      .eq('igreja_id', profile.igreja_id)
      .order('criado_em', { ascending: false })
      .limit(60),
    admin
      .from('encontros')
      .select('card_imagem_url, data_hora')
      .eq('igreja_id', profile.igreja_id)
      .not('card_imagem_url', 'is', null)
      .order('data_hora', { ascending: false })
      .limit(40),
    admin
      .from('importacoes')
      .select('tipo, chave, arquivo_nome, grupo_origem, status, motivo, importado_em')
      .eq('igreja_id', profile.igreja_id)
      .order('importado_em', { ascending: false })
      .limit(100),
    // Voluntariado e membresia. Atendido e arquivado ficam de fora: o painel
    // é fila de trabalho, não arquivo morto.
    admin
      .from('solicitacoes')
      .select('id, tipo, nome, telefone, email, dados, mensagem, status, criado_em, responsavel_id')
      .eq('igreja_id', profile.igreja_id)
      .in('status', ['pendente', 'em_andamento'])
      .order('criado_em', { ascending: false })
      .limit(50),
  ])

  const pedidos = (pedidosData ?? []) as unknown as SolicitacaoGeral[]
  const pedidosNovos = pedidos.filter((p) => p.status === 'pendente').length

  // Quem publicou cada resumo: os importados da planilha trazem o nome escrito
  // lá (`publicado_por`); os publicados pelo app guardam só o uuid de quem
  // operou, então o nome vem do perfil.
  type ResumoRow = {
    id: string; titulo: string; conteudo: string; pdf_url: string | null
    data_culto: string; validade_ate: string
    created_by: string | null; publicado_por: string | null
  }
  const resumosRaw = (resumosData ?? []) as ResumoRow[]
  const autorIds = [...new Set(resumosRaw.map((r) => r.created_by).filter(Boolean))] as string[]

  const { data: autoresData } = autorIds.length > 0
    ? await admin.from('profiles').select('id, nome').in('id', autorIds)
    : { data: [] }

  const nomePorId = new Map(
    ((autoresData ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome])
  )

  const resumos = resumosRaw.map((r) => ({
    ...r,
    autor: r.publicado_por?.trim() || (r.created_by ? nomePorId.get(r.created_by) ?? null : null),
  }))

  const redeIds = (redes ?? []).map((r) => r.id)

  const { data: celulasData } = redeIds.length > 0
    ? await supabase.from('celulas').select('id, rede_id, ativa').in('rede_id', redeIds)
    : { data: [] }

  type CelulaBasic = { id: string; rede_id: string; ativa: boolean }

  const celulas = (celulasData ?? []) as CelulaBasic[]
  const totalRedes = (redes ?? []).length
  const totalCelulas = celulas.filter((c) => c.ativa).length

  const periodo = GRANULARIDADES.includes(searchParams.periodo as Granularidade)
    ? (searchParams.periodo as Granularidade)
    : 'semana'

  // Pastor enxerga a igreja inteira: todas as redes de uma vez.
  const saude = await carregarSaudeRede(redeIds, periodo)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <IgrejaLogoUpload
            igrejaId={profile.igreja_id}
            logoUrl={igreja?.logo_url ?? null}
            nomeIgreja={igreja?.nome ?? 'Igreja'}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{igreja?.nome ?? 'Painel da igreja'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Visão geral</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
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

      {/* Saúde da rede — a igreja inteira, não uma rede só */}
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

      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Histórico
        </p>
        <PresencaHistorico serie={saude.serie} granularidade={periodo} basePath="/pastor" />
      </section>

      {/* Informações da igreja */}
      <IgrejaInfoForm
        igrejaId={profile.igreja_id}
        info={{
          nome: igreja?.nome ?? '',
          descricao: (igreja as any)?.descricao ?? null,
          horario_culto: (igreja as any)?.horario_culto ?? null,
          endereco: (igreja as any)?.endereco ?? null,
          fundada_em: (igreja as any)?.fundada_em ?? null,
          instagram_url: (igreja as any)?.instagram_url ?? null,
          facebook_url: (igreja as any)?.facebook_url ?? null,
          youtube_url: (igreja as any)?.youtube_url ?? null,
          spotify_url: (igreja as any)?.spotify_url ?? null,
          pastor_nome: (igreja as any)?.pastor_nome ?? null,
          pastor_titulo: (igreja as any)?.pastor_titulo ?? null,
          pix_chave: (igreja as any)?.pix_chave ?? null,
          pix_tipo: (igreja as any)?.pix_tipo ?? null,
          pix_nome: (igreja as any)?.pix_nome ?? null,
          pix_cidade: (igreja as any)?.pix_cidade ?? null,
          contribuicao_texto: (igreja as any)?.contribuicao_texto ?? null,
          dados_bancarios: (igreja as any)?.dados_bancarios ?? null,
          contribuicao_ativa: (igreja as any)?.contribuicao_ativa ?? false,
          ao_vivo_url: (igreja as any)?.ao_vivo_url ?? null,
          ao_vivo_ativo: (igreja as any)?.ao_vivo_ativo ?? false,
        }}
      />

      {/* Resumo do culto */}
      <ResumoCultoSection resumos={resumos} />

      {/* Importação de roteiros, fotos e eventos a partir da planilha */}
      <ImportacaoSection registros={(importacoesData ?? []) as RegistroImportacao[]} />

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
          {(solicitacoesData ?? []).length > 0 && (
            <Link href="/solicitacoes" className="text-xs text-primary hover:underline font-medium">
              Ver todas ({(solicitacoesData ?? []).length})
            </Link>
          )}
        </div>
        <SolicitacoesPanel
          solicitacoes={(solicitacoesData ?? []).slice(0, 3) as Parameters<typeof SolicitacoesPanel>[0]['solicitacoes']}
          lideres={(lideresData ?? []) as { id: string; nome: string }[]}
        />
        {(solicitacoesData ?? []).length > 3 && (
          <Link
            href="/solicitacoes"
            className="mt-2 flex w-full items-center justify-center py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Ver mais {(solicitacoesData ?? []).length - 3} solicitações
          </Link>
        )}
      </section>

      {/* Voluntariado e membresia */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Voluntariado e membresia
          {pedidosNovos > 0 && (
            <span className="ml-2 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pedidosNovos} {pedidosNovos === 1 ? 'novo' : 'novos'}
            </span>
          )}
        </p>
        <SolicitacoesGeralPanel solicitacoes={pedidos} />
      </section>

      {/* Galeria da comunidade */}
      <GaleriaComunidadeSection
        // Achata o `celulas(nome, redes(nome))` da consulta para a assinatura
        // que a marca d'água usa.
        fotosInit={((fotosData ?? []) as unknown as {
          id: string; url: string; criado_em: string
          celulas: { nome: string; redes: { nome: string } | null } | null
        }[]).map((f) => ({
          id: f.id,
          url: f.url,
          criado_em: f.criado_em,
          celula: f.celulas?.nome ?? null,
          rede: f.celulas?.redes?.nome ?? null,
        }))}
        fotosEncontro={(encontroFotosData ?? []).filter((e) => e.card_imagem_url).map((e) => ({ url: e.card_imagem_url!, criado_em: e.data_hora }))}
      />

    </div>
  )
}
