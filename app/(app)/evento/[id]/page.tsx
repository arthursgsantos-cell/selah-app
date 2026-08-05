import { FundoGaleria } from '@/components/shared/fundo-galeria'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CalendarDays, MapPin, Users, ClipboardList, Wallet, Receipt } from 'lucide-react'
import { CobrancaEditor } from '@/components/eventos/cobranca-editor'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { InscricaoSection } from '@/components/eventos/inscricao-section'
import { EventoVideo } from '@/components/eventos/evento-video'
import { EventoGaleria, type FotoEvento } from '@/components/eventos/evento-galeria'
import { EventoCapa } from '@/components/eventos/evento-capa'
import { EventoFundo } from '@/components/eventos/evento-fundo'
import { EventoDescricao } from '@/components/eventos/evento-descricao'
import { EventoBotoes } from '@/components/eventos/evento-botoes'
import { EventoCards } from '@/components/eventos/evento-cards'
import { EventoContagem } from '@/components/eventos/evento-contagem'
import { InscritosPlanilha } from '@/components/eventos/inscritos-planilha'
import { DestaqueBtn } from '@/components/eventos/destaque-btn'
import { SecaoChrome } from '@/components/eventos/secao-chrome'
import { AdicionarSecao } from '@/components/eventos/adicionar-secao'
import type { BotaoEvento, CardEvento } from '@/app/actions/evento-pagina'
import type { SecaoEvento } from '@/app/actions/evento-secoes'
import { contarInscritos } from '@/lib/inscricoes-planilha'
import { RedeShareButton } from '@/components/rede/rede-share-button'
import type { TipoInscricao, TipoChavePix, CampoFormulario } from '@/lib/supabase/types'

const CARGOS_EDICAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider']

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A URL usa o slug (`/evento/1-retiro-rede-one`), mas o UUID continua valendo:
 * links já compartilhados no WhatsApp não podem quebrar. Filtrar por `id` com
 * um valor que não é UUID faria o Postgres devolver erro, então o formato
 * decide qual coluna consultar.
 */
function porSlugOuId<T extends { eq: (coluna: string, valor: string) => T }>(
  query: T,
  chave: string
): T {
  return PADRAO_UUID.test(chave) ? query.eq('id', chave) : query.eq('slug', chave)
}

/**
 * Sem estas tags, WhatsApp e a folha de compartilhamento do celular não têm o
 * que exibir e caem no ícone genérico da hospedagem. Com elas, o link do
 * evento abre com o nome, a data e a arte do próprio evento.
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data } = await porSlugOuId(
    createAdminClient()
      .from('eventos')
      .select('titulo, descricao, local, data_hora, imagem_url, capa_pagina_url'),
    params.id
  ).maybeSingle()

  if (!data) return { title: 'Evento não encontrado' }

  const evento = data as {
    titulo: string; descricao: string | null; local: string | null
    data_hora: string; imagem_url: string | null; capa_pagina_url: string | null
  }

  const quando = format(new Date(evento.data_hora), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
  const descricao =
    evento.descricao?.trim() ||
    [quando, evento.local].filter(Boolean).join(' · ')

  // A capa da página tem prioridade; sem ela, vale o card do evento.
  const imagem = evento.capa_pagina_url ?? evento.imagem_url

  return {
    title: evento.titulo,
    description: descricao,
    openGraph: {
      type: 'article',
      title: evento.titulo,
      description: descricao,
      ...(imagem ? { images: [{ url: imagem, alt: evento.titulo }] } : {}),
    },
    twitter: {
      card: imagem ? 'summary_large_image' : 'summary',
      title: evento.titulo,
      description: descricao,
      ...(imagem ? { images: [imagem] } : {}),
    },
  }
}

export default async function EventoPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Página pública: qualquer pessoa com o link vê o evento.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  const { data: eventoData } = await porSlugOuId(
    admin
      .from('eventos')
      .select('id, slug, titulo, descricao, data_hora, local, imagem_url, capa_pagina_url, inscricoes_planilha_url, cor, cor_secundaria, fundo_tipo, fundo_imagem_url, fundo_opacidade, fundo_galeria, fundo_galeria_opacidade, fundo_auto_cor, fundo_auto_cor_origem, destaque, comprovantes_pasta_url, tipo, video_url, tipo_inscricao, whatsapp_inscricao, pix_chave, pix_tipo, pix_nome, pix_valor, formulario_id, link_inscricao_url, data_hora_fim'),
    params.id
  ).maybeSingle()

  if (!eventoData) notFound()
  const evento = eventoData as {
    id: string; slug: string | null; titulo: string; descricao: string | null; data_hora: string
    local: string | null; imagem_url: string | null; capa_pagina_url: string | null
    inscricoes_planilha_url: string | null
    cor: string | null; cor_secundaria: string | null; fundo_tipo: string | null
    fundo_imagem_url: string | null; fundo_opacidade: number | null
    tipo: string; video_url: string | null
    tipo_inscricao: TipoInscricao; whatsapp_inscricao: string | null
    pix_chave: string | null; pix_tipo: string | null; pix_nome: string | null
    pix_valor: number | null; formulario_id: string | null
    link_inscricao_url: string | null; data_hora_fim: string | null
  }

  // Link antigo (com UUID) continua abrindo, mas troca para a URL bonita —
  // assim o que for compartilhado a partir daqui já sai com o slug.
  if (evento.slug && params.id !== evento.slug) redirect(`/evento/${evento.slug}`)

  const [
    { data: fotosData },
    { data: presencasData },
    { data: formulario },
    { data: botoesData },
    { data: cardsData },
    { data: secoesData },
    inscritos,
  ] = await Promise.all([
    admin.from('evento_fotos').select('id, url, secao_id, criado_em').eq('evento_id', evento.id).order('ordem').order('criado_em'),
    admin.from('evento_presencas').select('user_id, resposta').eq('evento_id', evento.id),
    eventoData.formulario_id
      ? admin.from('formularios').select('campos').eq('id', eventoData.formulario_id).single()
      : Promise.resolve({ data: null }),
    admin.from('evento_botoes').select('id, rotulo, url, ordem, secao_id').eq('evento_id', evento.id).order('ordem').order('criado_em'),
    admin.from('evento_cards').select('id, titulo, descricao, imagem_url, valor, ordem, secao_id').eq('evento_id', evento.id).order('ordem').order('criado_em'),
    admin.from('evento_secoes').select('id, tipo, titulo, descricao, video_url, ordem').eq('evento_id', evento.id).order('ordem').order('criado_em'),
    // A planilha de respostas é a única fonte real de inscritos quando a
    // inscrição acontece fora do app.
    evento.inscricoes_planilha_url
      ? contarInscritos(evento.inscricoes_planilha_url)
      : Promise.resolve(null),
  ])

  const { data: minhaInscricao } = user
    ? await admin
        .from('inscricoes_evento')
        .select('id, status')
        .eq('evento_id', evento.id)
        .eq('user_id', user.id)
        .neq('status', 'cancelado')
        .maybeSingle()
    : { data: null }

  const totalVou = (presencasData ?? []).filter((p) => p.resposta === 'vou').length

  const canEdit = CARGOS_EDICAO.includes(profile?.role ?? '')
  const data = new Date(evento.data_hora)
  const jaPassou = data.getTime() < Date.now()

  const secoes = (secoesData ?? []) as unknown as SecaoEvento[]
  const fotos = (fotosData ?? []) as unknown as (FotoEvento & { secao_id: string | null; criado_em: string })[]

  // As seções mantêm a ordem escolhida pelo pastor; o fundo quer a mais
  // recente primeiro, então é uma ordenação à parte.
  const aparencia = evento as unknown as {
    fundo_galeria?: boolean; fundo_galeria_opacidade?: number
    fundo_auto_cor?: boolean; fundo_auto_cor_origem?: string | null
  }
  const fotosDoFundo = [...fotos]
    .sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''))
    .map((f) => f.url)
  const galeriaAtiva = aparencia.fundo_galeria ?? true
  const galeriaOpacidade = aparencia.fundo_galeria_opacidade ?? 15
  const botoes = (botoesData ?? []) as unknown as (BotaoEvento & { secao_id: string | null })[]
  const cards = (cardsData ?? []) as unknown as (CardEvento & { secao_id: string | null })[]

  /** Conteúdo de cada seção, montado pelo tipo. */
  function conteudoDaSecao(secao: SecaoEvento) {
    if (secao.tipo === 'inscricao') {
      return (
        <div className="space-y-3">
          {/* Atalho para a própria inscrição. Só faz sentido com planilha —
              é dela que sai o acompanhamento de pagamento — e com login, já
              que quem identifica a pessoa é a sessão, não a URL. */}
          {user && evento.inscricoes_planilha_url && (
            <Link
              href={`/minha-inscricao/${evento.slug ?? evento.id}`}
              className="flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-primary/30 bg-primary/5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <Receipt className="h-4 w-4" />
              Minha inscrição
            </Link>
          )}

          {evento.tipo_inscricao === 'link' && (
            <InscritosPlanilha
              eventoId={evento.id}
              planilhaUrl={evento.inscricoes_planilha_url}
              pastaComprovantesUrl={(evento as { comprovantes_pasta_url?: string | null }).comprovantes_pasta_url ?? null}
              eventoSlug={evento.slug ?? evento.id}
              inscricoes={inscritos?.inscricoes ?? null}
              pessoas={inscritos?.pessoas ?? null}
              canEdit={canEdit}
            />
          )}

          {!jaPassou && (
            user ? (
              <InscricaoSection
                eventoId={evento.id}
                tipoInscricao={evento.tipo_inscricao}
                whatsappInscricao={evento.whatsapp_inscricao}
                pixChave={evento.pix_chave}
                pixTipo={evento.pix_tipo as TipoChavePix | null}
                pixNome={evento.pix_nome}
                pixValor={evento.pix_valor}
                formularioId={evento.formulario_id}
                linkUrl={evento.link_inscricao_url}
                minhaInscricao={minhaInscricao as { id: string; status: string } | null}
              />
            ) : evento.tipo_inscricao !== 'aberto' ? (
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors w-full"
              >
                <ClipboardList className="h-4 w-4" />
                Entrar para se inscrever
              </Link>
            ) : null
          )}
        </div>
      )
    }

    if (secao.tipo === 'botoes') {
      return (
        <EventoBotoes
          eventoId={evento.id}
          secaoId={secao.id}
          botoes={botoes.filter((b) => b.secao_id === secao.id)}
          canEdit={canEdit}
        />
      )
    }

    if (secao.tipo === 'cards') {
      return (
        <EventoCards
          eventoId={evento.id}
          secaoId={secao.id}
          cards={cards.filter((c) => c.secao_id === secao.id)}
          canEdit={canEdit}
        />
      )
    }

    if (secao.tipo === 'video') {
      return (
        <EventoVideo
          eventoId={evento.id}
          secaoId={secao.id}
          videoUrl={secao.video_url}
          canEdit={canEdit}
        />
      )
    }

    return (
      <EventoGaleria
        eventoId={evento.id}
        secaoId={secao.id}
        fotos={fotos.filter((f) => f.secao_id === secao.id)}
        canEdit={canEdit}
      />
    )
  }

  /**
   * Seção sem conteúdo não aparece para o visitante — só para quem pode
   * editar, que precisa do ponto de entrada para preenchê-la.
   */
  function temConteudo(secao: SecaoEvento): boolean {
    if (secao.tipo === 'botoes') return botoes.some((b) => b.secao_id === secao.id)
    if (secao.tipo === 'cards') return cards.some((c) => c.secao_id === secao.id)
    if (secao.tipo === 'fotos') return fotos.some((f) => f.secao_id === secao.id)
    if (secao.tipo === 'video') return Boolean(secao.video_url)
    // A seção de inscrição some depois que o evento passa.
    return !jaPassou || Boolean(evento.inscricoes_planilha_url)
  }

  const visiveis = canEdit ? secoes : secoes.filter(temConteudo)

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-8">
      <FundoGaleria fotos={fotosDoFundo} opacidade={galeriaOpacidade} ativo={galeriaAtiva} />

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/eventos" />} className="-ml-1">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <DestaqueBtn eventoId={evento.id} destaqueInicial={(evento as { destaque?: boolean }).destaque ?? false} />
          )}
          <EventoFundo
            eventoId={evento.id}
            cor={evento.cor}
            corSecundaria={evento.cor_secundaria}
            fundoTipo={evento.fundo_tipo}
            fundoImagemUrl={evento.fundo_imagem_url}
            fundoOpacidade={evento.fundo_opacidade}
            galeriaAtiva={galeriaAtiva}
            galeriaOpacidade={galeriaOpacidade}
            totalFotos={fotosDoFundo.length}
            capaUrl={evento.capa_pagina_url ?? evento.imagem_url}
            autoCorAtivo={aparencia.fundo_auto_cor ?? true}
            autoCorOrigem={aparencia.fundo_auto_cor_origem ?? null}
            canEdit={canEdit}
          />
          <RedeShareButton nome={evento.titulo} prefixo="" />
        </div>
      </div>

      {/* ── Capa da página (cai no card do evento quando não há capa própria) ── */}
      <EventoCapa
        eventoId={evento.id}
        titulo={evento.titulo}
        imagemUrl={evento.imagem_url}
        capaPaginaUrl={evento.capa_pagina_url}
        canEdit={canEdit}
      />

      {/* ── Título e informações ──
          Fundo próprio: com um fundo de página personalizado atrás, o texto
          solto fica ilegível. O bloco branco é o mesmo tratamento das demais
          páginas do app. */}
      <div className="space-y-2 rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight">{evento.titulo}</h1>
          {jaPassou && <Badge variant="outline" className="shrink-0 text-muted-foreground">Encerrado</Badge>}
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 capitalize">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {format(data, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH'h'mm", { locale: ptBR })}
            {evento.data_hora_fim && (() => {
              const fim = new Date(evento.data_hora_fim!)
              const mesmoDia = fim.toDateString() === data.toDateString()
              return ` até ${mesmoDia ? format(fim, "HH'h'mm") : format(fim, "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })}`
            })()}
          </p>
          {evento.local && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              {evento.local}
            </p>
          )}
          {/* Com inscrição por link externo, quem se inscreve não passa pelo
              app — o contador mostraria um número muito menor que o real e
              enganaria quem lê. Melhor não mostrar nada. */}
          {totalVou > 0 && evento.tipo_inscricao !== 'link' && (
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              {totalVou} {totalVou === 1 ? 'confirmado' : 'confirmados'}
            </p>
          )}
        </div>

        <EventoDescricao eventoId={evento.id} descricao={evento.descricao} canEdit={canEdit} />
      </div>

      {/* ── Contagem regressiva (some sozinha depois que o evento começa) ── */}
      {!jaPassou && <EventoContagem dataHora={evento.data_hora} />}

      {/* ── Seções, na ordem definida pelo pastor ── */}
      {visiveis.map((secao, i) => (
        <SecaoChrome
          key={secao.id}
          secaoId={secao.id}
          eventoId={evento.id}
          tipo={secao.tipo}
          titulo={secao.titulo}
          descricao={secao.descricao}
          canEdit={canEdit}
          primeira={i === 0}
          ultima={i === visiveis.length - 1}
        >
          {conteudoDaSecao(secao)}
        </SecaoChrome>
      ))}

      {canEdit && <AdicionarSecao eventoId={evento.id} />}

      {/* ── Gestão ── */}
      {/* Cobrança e lista de inscritos só existem quando o app controla a
          inscrição (formulário/PIX) — link externo não gera registro aqui. */}
      {canEdit && ['formulario', 'pix'].includes(evento.tipo_inscricao) && (
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Cobrança</h2>
          </div>

          <CobrancaEditor
            eventoId={evento.id}
            campos={((formulario as { campos?: CampoFormulario[] } | null)?.campos ?? []) as CampoFormulario[]}
          />

          <Button variant="outline" size="sm" render={<Link href={`/inscricoes/${evento.id}`} />} className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Ver inscrições e pagamentos
          </Button>
        </section>
      )}
    </div>
  )
}
