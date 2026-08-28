import { redirect } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { carregarPerfil } from '@/lib/auth/perfil'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, ClipboardList, MapPin, Users, Wallet } from 'lucide-react'
import { PainelAbas } from '@/components/shared/painel-abas'
import { FormulariosLista, type FormularioItem } from '@/components/formularios/formularios-lista'
import { formatarBRL } from '@/lib/evento-cobranca'
import { CriarEventoDialog } from '@/components/shared/criar-evento-dialog'
import { EditarEventoDialog } from '@/components/shared/editar-evento-dialog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Suspense } from 'react'
import { PageSearch } from '@/components/shared/page-search'
import {
  resumosDeEventos, acompanhaInscricoes, CARGOS_ACOMPANHAMENTO, type ResumoEvento,
} from '@/lib/eventos-resumo'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_ORDER } from '@/lib/nav-items'
import type { CampoFormulario, Role } from '@/lib/supabase/types'

/**
 * Os formulários da igreja, com quantos eventos usam cada um — o número é o
 * que impede apagar por engano algo que está no ar.
 */
async function carregarFormularios(igrejaId: string): Promise<FormularioItem[]> {
  const admin = createAdminClient()
  const [{ data: formulariosData }, { data: eventosData }] = await Promise.all([
    admin
      .from('formularios')
      .select('id, nome, descricao, campos, template')
      .eq('igreja_id', igrejaId)
      .order('criado_em', { ascending: false }),
    admin.from('eventos').select('formulario_id').not('formulario_id', 'is', null),
  ])

  const uso = new Map<string, number>()
  for (const e of (eventosData ?? []) as { formulario_id: string }[]) {
    uso.set(e.formulario_id, (uso.get(e.formulario_id) ?? 0) + 1)
  }

  return ((formulariosData ?? []) as {
    id: string; nome: string; descricao: string | null
    campos: CampoFormulario[] | null; template: boolean | null
  }[]).map((f) => ({
    id: f.id,
    nome: f.nome,
    descricao: f.descricao,
    campos: f.campos ?? [],
    template: f.template ?? false,
    emUso: uso.get(f.id) ?? 0,
  }))
}

/**
 * Evento "outro" mostra o nome que quem criou deu a ele ("Vigília", "Batismo");
 * os demais usam o rótulo fixo do tipo.
 */
function rotuloTipo(evento: { tipo: string; tipo_outro?: string | null }, padrao: string) {
  return evento.tipo === 'outro' && evento.tipo_outro ? evento.tipo_outro : padrao
}

const tipoConfig: Record<string, { label: string; className: string }> = {
  culto: { label: 'Culto', className: 'bg-purple-100 text-purple-700' },
  igreja: { label: 'Igreja', className: 'bg-blue-100 text-blue-700' },
  rede: { label: 'Rede', className: 'bg-green-100 text-green-700' },
  celula: { label: 'Célula', className: 'bg-yellow-100 text-yellow-700' },
  outro: { label: 'Outro', className: 'bg-gray-100 text-gray-600' },
}

const TIPO_OPTS = [
  { value: '',        label: 'Todos os tipos' },
  { value: 'culto',   label: 'Culto'  },
  { value: 'igreja',  label: 'Igreja' },
  { value: 'rede',    label: 'Rede'   },
  { value: 'celula',  label: 'Célula' },
  { value: 'outro',   label: 'Outro'  },
]

const SORT_OPTS = [
  { value: 'asc',  label: 'Mais próximos' },
  { value: 'desc', label: 'Mais recentes' },
  { value: 'az',   label: 'A → Z'         },
]

/**
 * Linha de resumo no card: quantos se inscreveram e quanto já entrou.
 *
 * `resumo` indefinido significa que quem está vendo não acompanha inscrições —
 * nesse caso não mostra nada, em vez de mostrar zero.
 */
function ResumoInscricoes({
  resumo,
  recebeInscricoes,
}: {
  resumo?: ResumoEvento
  recebeInscricoes: boolean
}) {
  if (!resumo || !recebeInscricoes) return null

  const ativos = resumo.total - resumo.cancelados

  return (
    <div className="flex items-center gap-2.5 flex-wrap mt-2 text-xs">
      <span className="inline-flex items-center gap-1 font-medium">
        <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
        {ativos} {ativos === 1 ? 'inscrito' : 'inscritos'}
      </span>
      {resumo.pendentes > 0 && (
        <span className="text-amber-600 font-medium">{resumo.pendentes} pendentes</span>
      )}
      {resumo.percentualPago !== null && (
        <span className="inline-flex items-center gap-1">
          <Wallet className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className={resumo.percentualPago >= 100 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
            {formatarBRL(resumo.valorPago)} de {formatarBRL(resumo.valorPrevisto)}
          </span>
        </span>
      )}
    </div>
  )
}

export default async function EventosPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; tipo?: string; aba?: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/eventos'))

  const profile = await carregarPerfil(() =>
    supabase.from('profiles').select('id, role, igreja_id').eq('id', user.id).maybeSingle()
  )

  if (!profile) redirect('/onboarding')

  const canCreate = profile.role === 'pastor' || profile.role === 'supervisor' || profile.role === 'admin'
  // Líder também acompanha inscrições, mesmo sem poder criar evento.
  const podeAcompanhar = CARGOS_ACOMPANHAMENTO.includes(profile.role)

  const q = (searchParams.q ?? '').toLowerCase().trim()
  const tipoFiltro = searchParams.tipo ?? ''
  const sort = searchParams.sort ?? 'asc'

  // Formulários passam a ser aba daqui: são a matéria-prima da inscrição, e
  // viviam numa página solta que só quem sabia do caminho encontrava.
  const podeFormularios = ROLE_ORDER[profile.role as Role] >= ROLE_ORDER.lider
  const formularios = podeFormularios ? await carregarFormularios(profile.igreja_id) : []

  let proximosQuery = supabase
    .from('eventos')
    .select('id, slug, inscricoes_planilha_url, titulo, descricao, data_hora, local, tipo, tipo_outro, rede_id, celula_id, imagem_url, capa_pagina_url, recorrencia_id, recorrencia_tipo, tipo_inscricao, whatsapp_inscricao, pix_chave, pix_tipo, pix_nome, pix_valor, formulario_id, link_inscricao_url, data_hora_fim')
    .eq('igreja_id', profile.igreja_id)
    .gte('data_hora', new Date().toISOString())
    .limit(50)

  if (tipoFiltro) proximosQuery = proximosQuery.eq('tipo', tipoFiltro as import('@/lib/supabase/types').TipoEvento)

  const { data: proximosRaw } = await proximosQuery

  let proximos = (proximosRaw ?? []).filter((e) =>
    !q || e.titulo.toLowerCase().includes(q) || e.local?.toLowerCase().includes(q) || e.descricao?.toLowerCase().includes(q)
  )

  if (sort === 'az') proximos.sort((a, b) => a.titulo.localeCompare(b.titulo))
  else if (sort === 'desc') proximos.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
  else proximos.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

  const { data: passados } = await supabase
    .from('eventos')
    .select('id, slug, inscricoes_planilha_url, titulo, data_hora, local, tipo, tipo_outro, rede_id, celula_id, imagem_url, capa_pagina_url, recorrencia_id, recorrencia_tipo, tipo_inscricao, whatsapp_inscricao, pix_chave, pix_tipo, pix_nome, pix_valor, formulario_id, link_inscricao_url, data_hora_fim')
    .eq('igreja_id', profile.igreja_id)
    .lt('data_hora', new Date().toISOString())
    .order('data_hora', { ascending: false })
    .limit(10)

  const passadosFiltrados = (passados ?? []).filter((e) =>
    (!q || e.titulo.toLowerCase().includes(q) || e.local?.toLowerCase().includes(q)) &&
    (!tipoFiltro || e.tipo === tipoFiltro)
  )

  // Resumo de inscrições e pagamentos por evento. Só para quem acompanha —
  // para os demais, a consulta nem acontece.
  const resumos = podeAcompanhar
    ? await resumosDeEventos([
        ...proximos.map((e) => e.id),
        ...passadosFiltrados.map((e) => e.id),
      ])
    : {}

  /**
   * Para quem acompanha, clicar no evento abre a lista de inscritos — é o que
   * a liderança quer ver. Os demais vão para a página pública do evento.
   */
  type EventoCard = {
    id: string
    slug?: string | null
    tipo_inscricao?: string | null
    inscricoes_planilha_url?: string | null
  }

  /**
   * O evento tem inscritos que o app consegue mostrar? Vale para os dois
   * caminhos: formulário/PIX gravam em `inscricoes_evento`, e a inscrição por
   * link externo tem a planilha publicada.
   */
  function temInscritos(evento: EventoCard): boolean {
    return acompanhaInscricoes(evento.tipo_inscricao) || Boolean(evento.inscricoes_planilha_url)
  }

  function destinoDoCard(evento: EventoCard) {
    // Slug quando existe: a URL vira compartilhável em vez de um UUID.
    if (podeAcompanhar && temInscritos(evento)) return `/inscricoes/${evento.slug ?? evento.id}`
    return `/evento/${evento.slug ?? evento.id}`
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Eventos</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Suspense>
            <PageSearch placeholder="Buscar evento..." sortOptions={SORT_OPTS} defaultSort="asc" />
          </Suspense>
          {canCreate && <CriarEventoDialog label="Criar evento" />}
        </div>
      </div>

      <PainelAbas
        inicial={searchParams.aba === 'formularios' && podeFormularios ? 'formularios' : 'agenda'}
        abas={[
          {
            id: 'agenda',
            titulo: 'Agenda',
            descricao: 'Tudo o que a igreja tem marcado.',
            icone: <CalendarDays className="h-5 w-5" />,
            conteudo: (
              <>
      {/* Filtro por tipo */}
      <div className="flex gap-1.5 flex-wrap">
        {TIPO_OPTS.map((opt) => (
          <Link
            key={opt.value}
            href={`/eventos?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), ...(opt.value ? { tipo: opt.value } : {}), ...(searchParams.sort ? { sort: searchParams.sort } : {}) }).toString()}`}
            className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
              tipoFiltro === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Próximos eventos */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Próximos
        </p>

        {proximos && proximos.length > 0 ? (
          <div className="space-y-3">
            {proximos.map((evento) => {
              const tipo = tipoConfig[evento.tipo] ?? tipoConfig.outro
              const data = new Date(evento.data_hora)

              return (
                <Card key={evento.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      {evento.imagem_url ? (
                        <img
                          src={evento.imagem_url}
                          alt={evento.titulo}
                          className="h-14 w-14 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                          <CalendarDays className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm leading-snug">{evento.titulo}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipo.className}`}>
                              {rotuloTipo(evento, tipo.label)}
                            </span>
                            {canCreate && (
                              <EditarEventoDialog
                                evento={{
                                  id: evento.id,
                                  titulo: evento.titulo,
                                  descricao: evento.descricao ?? null,
                                  data_hora: evento.data_hora,
                                  data_hora_fim: evento.data_hora_fim ?? null,
                                  local: evento.local ?? null,
                                  tipo: evento.tipo,
                                  tipo_outro: evento.tipo_outro ?? null,
                                  rede_id: evento.rede_id ?? null,
                                  celula_id: evento.celula_id ?? null,
                                  imagem_url: evento.imagem_url ?? null,
                                  capa_pagina_url: evento.capa_pagina_url ?? null,
                                  recorrencia_id: evento.recorrencia_id ?? null,
                                  recorrencia_tipo: evento.recorrencia_tipo ?? null,
                                  tipo_inscricao: evento.tipo_inscricao ?? null,
                                  whatsapp_inscricao: evento.whatsapp_inscricao ?? null,
                                  pix_chave: evento.pix_chave ?? null,
                                  pix_tipo: evento.pix_tipo ?? null,
                                  pix_nome: evento.pix_nome ?? null,
                                  pix_valor: evento.pix_valor ?? null,
                                  formulario_id: evento.formulario_id ?? null,
                                  link_inscricao_url: evento.link_inscricao_url ?? null,
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {format(data, "EEEE, d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })}
                        </p>
                        {evento.local && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {evento.local}
                          </p>
                        )}
                        {evento.descricao && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                            {evento.descricao}
                          </p>
                        )}

                        <ResumoInscricoes
                          resumo={resumos[evento.id]}
                          recebeInscricoes={acompanhaInscricoes(evento.tipo_inscricao)}
                        />
                      </div>
                    </div>
                  </CardContent>

                  {/* O card inteiro leva ao acompanhamento; o botão à direita
                      abre a página pública, que é o outro destino esperado. */}
                  <div className="flex items-center border-t divide-x">
                    <Link
                      href={destinoDoCard(evento)}
                      className="flex-1 px-4 py-2.5 text-xs font-medium text-primary hover:bg-accent transition-colors text-center"
                    >
                      {podeAcompanhar && temInscritos(evento)
                        ? 'Ver inscrições'
                        : 'Abrir evento'}
                    </Link>
                    {podeAcompanhar && temInscritos(evento) && (
                      <Link
                        href={`/evento/${evento.slug ?? evento.id}`}
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                      >
                        Página do evento
                      </Link>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum evento próximo</p>
              {canCreate && (
                <div className="mt-3">
                  <CriarEventoDialog label="Criar evento" />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Eventos passados */}
      {passadosFiltrados.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Anteriores
          </p>
          <div className="space-y-2">
            {passadosFiltrados.map((evento) => {
              const tipo = tipoConfig[evento.tipo] ?? tipoConfig.outro
              return (
                <Card key={evento.id} className="opacity-60 hover:opacity-100 transition-opacity">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      {/* Só o conteúdo é link: o botão de editar não pode ficar
                          dentro de uma âncora. */}
                      <Link href={destinoDoCard(evento)} className="flex items-center gap-3 min-w-0 flex-1">
                        {evento.imagem_url && (
                          <img
                            src={evento.imagem_url}
                            alt={evento.titulo}
                            className="h-10 w-10 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{evento.titulo}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {format(new Date(evento.data_hora), "d 'de' MMMM", { locale: ptBR })}
                            {evento.local && ` · ${evento.local}`}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipo.className}`}>
                          {rotuloTipo(evento, tipo.label)}
                        </span>
                        {canCreate && (
                          <EditarEventoDialog
                            evento={{
                              id: evento.id,
                              titulo: evento.titulo,
                              descricao: null,
                              data_hora: evento.data_hora,
                                  data_hora_fim: evento.data_hora_fim ?? null,
                              local: evento.local ?? null,
                              tipo: evento.tipo,
                              tipo_outro: evento.tipo_outro ?? null,
                              rede_id: evento.rede_id ?? null,
                              celula_id: evento.celula_id ?? null,
                              imagem_url: evento.imagem_url ?? null,
                              capa_pagina_url: evento.capa_pagina_url ?? null,
                              recorrencia_id: evento.recorrencia_id ?? null,
                              recorrencia_tipo: evento.recorrencia_tipo ?? null,
                              tipo_inscricao: evento.tipo_inscricao ?? null,
                              whatsapp_inscricao: evento.whatsapp_inscricao ?? null,
                              pix_chave: evento.pix_chave ?? null,
                              pix_tipo: evento.pix_tipo ?? null,
                              pix_nome: evento.pix_nome ?? null,
                              pix_valor: evento.pix_valor ?? null,
                              formulario_id: evento.formulario_id ?? null,
                              link_inscricao_url: evento.link_inscricao_url ?? null,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}
              </>
            ),
          },
          // Formulário é matéria-prima de inscrição: mora junto dos eventos, e
          // não numa página solta que só quem sabia do caminho encontrava.
          ...(podeFormularios
            ? [{
                id: 'formularios',
                titulo: 'Formulários',
                descricao: 'As perguntas que a inscrição faz — e os modelos que você reaproveita.',
                icone: <ClipboardList className="h-5 w-5" />,
                conteudo: <FormulariosLista formularios={formularios} />,
              }]
            : []),
        ]}
      />
    </div>
  )
}
