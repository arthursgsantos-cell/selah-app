import { redirect, notFound } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Users, Wallet, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CampoFormulario } from '@/lib/supabase/types'
import {
  GestaoInscritos,
  type InscritoGestao,
  type PagamentoGestao,
} from '@/components/eventos/gestao-inscritos'
import { OrganizadoresEvento } from '@/components/eventos/organizadores-evento'
import { acessoAoEvento } from '@/lib/eventos-permissoes'
import { formatarBRL, type ParcelaEvento, type PagamentoInscricao } from '@/lib/evento-cobranca'
import { resumoDoEvento } from '@/lib/eventos-resumo'
import { carregarRelatorio } from '@/lib/inscricoes-relatorio'
import { RelatorioInscricoes } from '@/components/eventos/relatorio-inscricoes'

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  const admin = createAdminClient()

  // A URL aceita o slug ("/inscricoes/1-retiro-rede-one") para poder ser
  // compartilhada; o UUID continua valendo porque links antigos já circulam.
  // Filtrar `id` com algo que não é UUID faria o Postgres devolver erro, então
  // o formato decide a coluna.
  const consultaEvento = admin
    .from('eventos')
    .select('id, titulo, slug, data_hora, formulario_id, local, inscricoes_planilha_url, created_by, igreja_id')

  const { data: evento } = await (PADRAO_UUID.test(params.eventoId)
    ? consultaEvento.eq('id', params.eventoId)
    : consultaEvento.eq('slug', params.eventoId)
  ).maybeSingle()

  if (!evento) notFound()

  const eventoId = evento.id

  // Quem enxerga esta página é quem gerencia o evento: a liderança da igreja,
  // quem o criou e quem recebeu a delegação.
  const acesso = await acessoAoEvento(eventoId)
  if (!acesso?.podeVer) redirect('/home')

  const [{ data: inscritosRaw }, { data: parcelasData }, resumo] = await Promise.all([
    admin.from('inscricoes_evento')
      .select('id, nome, telefone, dados, status, criado_em, valor_total, observacao, origem')
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
        .select('id, inscricao_id, valor, pago_em, metodo, observacao, comprovante_path')
        .in('inscricao_id', inscricaoIds)
        .order('pago_em')
    : { data: [] }

  const pagamentosPorInscricao = new Map<string, PagamentoGestao[]>()
  for (const p of (pagamentosData ?? []) as unknown as (PagamentoInscricao & {
    inscricao_id: string; comprovante_path: string | null
  })[]) {
    const lista = pagamentosPorInscricao.get(p.inscricao_id) ?? []
    lista.push({
      id: p.id,
      valor: Number(p.valor),
      pago_em: p.pago_em,
      metodo: p.metodo,
      observacao: p.observacao,
      comprovante: Boolean(p.comprovante_path),
    })
    pagamentosPorInscricao.set(p.inscricao_id, lista)
  }

  let campos: CampoFormulario[] = []
  if (evento.formulario_id) {
    const { data: form } = await admin.from('formularios').select('campos').eq('id', evento.formulario_id).single()
    campos = (form?.campos ?? []) as CampoFormulario[]
  }

  const inscritos = (inscritosRaw ?? []) as unknown as {
    id: string; nome: string; telefone: string | null; dados: Record<string, string>
    status: string; criado_em: string; valor_total: number | null
    observacao: string | null; origem: string | null
  }[]

  const inscritosGestao: InscritoGestao[] = inscritos.map((i) => ({
    id: i.id,
    nome: i.nome,
    telefone: i.telefone,
    status: i.status,
    origem: i.origem ?? 'app',
    observacao: i.observacao,
    valorTotal: i.valor_total !== null ? Number(i.valor_total) : null,
    criadoEm: i.criado_em,
    dados: (i.dados ?? {}) as Record<string, string>,
    pagamentos: pagamentosPorInscricao.get(i.id) ?? [],
  }))

  // Preço único do evento, usado como sugestão ao cadastrar alguém à mão.
  const { data: valoresData } = await admin
    .from('evento_valores')
    .select('valor, campo_id')
    .eq('evento_id', eventoId)
    .order('ordem')

  const valorPadrao =
    ((valoresData ?? []) as { valor: number; campo_id: string | null }[])
      .find((v) => !v.campo_id)?.valor ?? null

  // Organizadores delegados e candidatos à delegação.
  const { data: organizadoresData } = await admin
    .from('evento_organizadores')
    .select('user_id')
    .eq('evento_id', eventoId)

  const organizadorIds = ((organizadoresData ?? []) as { user_id: string }[]).map((o) => o.user_id)
  const idsParaNome = [...new Set([...organizadorIds, evento.created_by].filter(Boolean))] as string[]

  const [{ data: nomesData }, { data: membrosData }] = await Promise.all([
    idsParaNome.length > 0
      ? admin.from('profiles').select('id, nome').in('id', idsParaNome)
      : Promise.resolve({ data: [] }),
    // A lista de candidatos só é carregada para quem pode delegar.
    acesso.podeDelegar && evento.igreja_id
      ? admin.from('profiles').select('id, nome, role').eq('igreja_id', evento.igreja_id).order('nome').limit(500)
      : Promise.resolve({ data: [] }),
  ])

  const nomePorId = new Map(((nomesData ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))

  const criador = evento.created_by
    ? { id: evento.created_by as string, nome: nomePorId.get(evento.created_by as string) ?? 'Organizador' }
    : null

  const organizadores = organizadorIds.map((id) => ({ id, nome: nomePorId.get(id) ?? 'Membro' }))

  const candidatos = ((membrosData ?? []) as { id: string; nome: string; role: string }[])
    .map((p) => ({ id: p.id, nome: p.nome, detalhe: p.role.replace(/_/g, ' ') }))

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
          <h1 className="text-xl font-bold">{acesso.pode ? 'Gerenciar evento' : 'Acompanhamento'}</h1>
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

      {/* Gestão manual: cadastrar inscrito, lançar pagamento, anexar
          comprovante. É o que substitui a planilha do organizador. */}
      <GestaoInscritos
        eventoId={eventoId}
        eventoTitulo={evento.titulo}
        inscritos={inscritosGestao}
        parcelas={parcelas}
        campos={campos}
        valorPadrao={valorPadrao}
        somenteLeitura={!acesso.pode}
      />

      {acesso.podeDelegar && (
        <OrganizadoresEvento
          eventoId={eventoId}
          criador={criador}
          organizadores={organizadores}
          candidatos={candidatos}
        />
      )}

    </div>
  )
}
