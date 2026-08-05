import { redirect, notFound } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, Users, Phone, User, Wallet, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CampoFormulario } from '@/lib/supabase/types'
import { PagamentosInscrito } from '@/components/eventos/pagamentos-inscrito'
import { formatarBRL, type ParcelaEvento, type PagamentoInscricao } from '@/lib/evento-cobranca'
import { resumoDoEvento } from '@/lib/eventos-resumo'
import { carregarRelatorio } from '@/lib/inscricoes-relatorio'
import { RelatorioInscricoes } from '@/components/eventos/relatorio-inscricoes'

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const statusConfig = {
  pendente:   { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-700' },
  confirmado: { label: 'Confirmado', className: 'bg-green-100 text-green-700'  },
  cancelado:  { label: 'Cancelado',  className: 'bg-red-100 text-red-700'      },
}

function Indicador({
  rotulo, valor, icone, classe,
}: {
  rotulo: string
  valor: number
  icone?: React.ReactNode
  classe?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-muted-foreground h-4">{icone}</div>
      <p className={`text-xl font-bold leading-none mt-1.5 ${classe ?? ''}`}>{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{rotulo}</p>
    </div>
  )
}

export default async function InscritosList({ params }: { params: { eventoId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom(`/inscricoes/${params.eventoId}`))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canView = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento', 'lider'].includes(profile?.role ?? '')
  if (!canView) redirect('/home')

  const admin = createAdminClient()

  // A URL aceita o slug ("/inscricoes/1-retiro-rede-one") para poder ser
  // compartilhada; o UUID continua valendo porque links antigos já circulam.
  // Filtrar `id` com algo que não é UUID faria o Postgres devolver erro, então
  // o formato decide a coluna.
  const consultaEvento = admin
    .from('eventos')
    .select('id, titulo, slug, data_hora, formulario_id, local, inscricoes_planilha_url')

  const { data: evento } = await (PADRAO_UUID.test(params.eventoId)
    ? consultaEvento.eq('id', params.eventoId)
    : consultaEvento.eq('slug', params.eventoId)
  ).maybeSingle()

  if (!evento) notFound()

  const eventoId = evento.id

  const [{ data: inscritosRaw }, { data: parcelasData }, resumo] = await Promise.all([
    admin.from('inscricoes_evento')
      .select('id, nome, telefone, dados, status, criado_em, valor_total')
      .eq('evento_id', eventoId)
      .order('criado_em', { ascending: true }),
    admin.from('evento_parcelas')
      .select('id, numero, vencimento, percentual')
      .eq('evento_id', eventoId)
      .order('numero'),
    resumoDoEvento(eventoId),
  ])

  // Quando o evento recebe inscrição por link, as pessoas estão na planilha e
  // não em `inscricoes_evento` — o relatório lê a fonte certa sozinho.
  const relatorio = await carregarRelatorio(
    evento as unknown as { id: string; formulario_id: string | null; inscricoes_planilha_url: string | null }
  )

  const parcelas = (parcelasData ?? []) as ParcelaEvento[]

  // Pagamentos de todos os inscritos, agrupados por inscrição
  const inscricaoIds = (inscritosRaw ?? []).map((i) => i.id)
  const { data: pagamentosData } = inscricaoIds.length > 0
    ? await admin
        .from('inscricao_pagamentos')
        .select('id, inscricao_id, valor, pago_em, metodo, observacao')
        .in('inscricao_id', inscricaoIds)
        .order('pago_em')
    : { data: [] }

  const pagamentosPorInscricao = new Map<string, PagamentoInscricao[]>()
  for (const p of (pagamentosData ?? []) as (PagamentoInscricao & { inscricao_id: string })[]) {
    const lista = pagamentosPorInscricao.get(p.inscricao_id) ?? []
    lista.push(p)
    pagamentosPorInscricao.set(p.inscricao_id, lista)
  }

  let campos: CampoFormulario[] = []
  if (evento.formulario_id) {
    const { data: form } = await admin.from('formularios').select('campos').eq('id', evento.formulario_id).single()
    campos = (form?.campos ?? []) as CampoFormulario[]
  }

  const inscritos = inscritosRaw ?? []
  const ativos = inscritos.filter((i) => i.status !== 'cancelado')

  // O relatório da planilha traz os próprios totais; o do app usa o resumo já
  // calculado. Uma variável só para a tela não precisar saber a origem.
  const totais = relatorio && relatorio.fonte === 'planilha'
    ? {
        inscritos: relatorio.totais.inscritos,
        previsto: relatorio.totais.valorPrevisto,
        pago: relatorio.totais.valorPago,
        saldo: relatorio.totais.saldo,
      }
    : {
        inscritos: resumo.total - resumo.cancelados,
        previsto: resumo.valorPrevisto,
        pago: resumo.valorPago,
        saldo: resumo.saldo,
      }

  const percentualPago = totais.previsto > 0
    ? Math.round((totais.pago / totais.previsto) * 100)
    : null

  return (
    <div className="max-w-4xl mx-auto space-y-5 area-impressao">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/eventos" />}
        className="-ml-1 nao-imprimir"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Acompanhamento</h1>
          <p className="text-sm text-muted-foreground">{evento.titulo}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {format(new Date(evento.data_hora), "EEE, d 'de' MMM 'às' HH'h'mm", { locale: ptBR })}
            {evento.local && ` · ${evento.local}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 nao-imprimir"
          render={<Link href={`/evento/${(evento as { slug: string | null }).slug ?? eventoId}`} />}
        >
          <ExternalLink className="h-4 w-4" />
          Página do evento
        </Button>
      </div>

      {/* Consolidado — o que o tesoureiro e a liderança querem de relance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Indicador rotulo="inscritos" valor={totais.inscritos} icone={<Users className="h-4 w-4" />} />
        {relatorio?.fonte === 'planilha' ? (
          <>
            <Indicador rotulo="previsto (R$)" valor={Math.round(totais.previsto)} />
            <Indicador
              rotulo="recebido (R$)"
              valor={Math.round(totais.pago)}
              classe={totais.pago > 0 ? 'text-green-600' : undefined}
            />
            <Indicador
              rotulo="a receber (R$)"
              valor={Math.round(totais.saldo)}
              classe={totais.saldo > 0 ? 'text-amber-600' : undefined}
            />
          </>
        ) : (
          <>
            <Indicador
              rotulo="confirmados"
              valor={resumo.confirmados}
              classe={resumo.confirmados > 0 ? 'text-green-600' : undefined}
            />
            <Indicador
              rotulo="pendentes"
              valor={resumo.pendentes}
              classe={resumo.pendentes > 0 ? 'text-amber-600' : undefined}
            />
            <Indicador rotulo="cancelados" valor={resumo.cancelados} />
          </>
        )}
      </div>

      {/* A planilha não pôde ser lida: avisar é melhor que mostrar tabela vazia
          dando a entender que ninguém se inscreveu. */}
      {relatorio === null && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não consegui ler a planilha de inscrições. Confira em Arquivo → Compartilhar →
          Publicar na web se o documento inteiro continua publicado.
        </p>
      )}

      {/* Gráficos, filtros e tabela */}
      {relatorio && relatorio.registros.length > 0 && (
        <RelatorioInscricoes
          colunas={relatorio.colunas}
          registros={relatorio.registros}
          colunasCategoricas={relatorio.colunasCategoricas}
          historicoPagamentos={relatorio.historicoPagamentos}
          eventoTitulo={evento.titulo}
        />
      )}

      {totais.previsto > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Pagamentos
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Previsto</p>
              <p className="font-semibold">{formatarBRL(totais.previsto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="font-semibold text-green-600">{formatarBRL(totais.pago)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A receber</p>
              <p className={`font-semibold ${totais.saldo > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {formatarBRL(totais.saldo)}
              </p>
            </div>
          </div>

          {percentualPago !== null && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.min(100, percentualPago)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right tabular-nums">
                {percentualPago}% recebido
              </p>
            </div>
          )}
        </div>
      )}

      {/* Só quando não há relatório nenhum: com planilha, dizer "nenhuma
          inscrição" seria mentira — elas estão na tabela acima. */}
      {inscritos.length === 0 && (relatorio?.registros.length ?? 0) === 0 && relatorio !== null && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma inscrição ainda.
          </CardContent>
        </Card>
      )}

      {/* Fichas com controle de pagamento — só existem para inscrição pelo
          app, e ficam fora do PDF por causa dos botões. */}
      {inscritos.length > 0 && (
        <div className="space-y-3 nao-imprimir">
          <h2 className="text-sm font-semibold">Fichas e pagamentos</h2>
          {inscritos.map((inscrito, i) => {
            const status = statusConfig[inscrito.status as keyof typeof statusConfig] ?? statusConfig.pendente
            const dados = inscrito.dados as Record<string, string>
            return (
              <Card key={inscrito.id} className="overflow-hidden">
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">{inscrito.nome}</p>
                        </div>
                        {inscrito.telefone && (
                          <a
                            href={`https://wa.me/${inscrito.telefone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-[#25D366] hover:underline mt-0.5"
                          >
                            <Phone className="h-3 w-3" />
                            {inscrito.telefone}
                          </a>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>

                  {/* Respostas do formulário */}
                  {campos.filter((c) => c.id !== 'nome' && c.id !== 'telefone').map((campo) => {
                    const resposta = dados[campo.id]
                    if (!resposta) return null
                    return (
                      <div key={campo.id} className="text-xs">
                        <span className="text-muted-foreground">{campo.label}: </span>
                        <span className="font-medium">{resposta}</span>
                      </div>
                    )
                  })}

                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(inscrito.criado_em), "d/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </CardContent>

                {/* Controle de pagamentos (tesoureiro) */}
                <PagamentosInscrito
                  inscricaoId={inscrito.id}
                  eventoId={eventoId}
                  nome={inscrito.nome}
                  valorTotal={inscrito.valor_total as number | null}
                  parcelas={parcelas}
                  pagamentos={pagamentosPorInscricao.get(inscrito.id) ?? []}
                />
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
