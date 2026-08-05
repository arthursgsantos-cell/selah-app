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

  const [{ data: evento }, { data: inscritosRaw }, { data: parcelasData }, resumo] = await Promise.all([
    admin.from('eventos').select('titulo, slug, data_hora, formulario_id, local').eq('id', params.eventoId).single(),
    admin.from('inscricoes_evento')
      .select('id, nome, telefone, dados, status, criado_em, valor_total')
      .eq('evento_id', params.eventoId)
      .order('criado_em', { ascending: true }),
    admin.from('evento_parcelas')
      .select('id, numero, vencimento, percentual')
      .eq('evento_id', params.eventoId)
      .order('numero'),
    resumoDoEvento(params.eventoId),
  ])

  if (!evento) notFound()

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

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" render={<Link href="/eventos" />} className="-ml-1">
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
          className="shrink-0"
          render={<Link href={`/evento/${(evento as { slug: string | null }).slug ?? params.eventoId}`} />}
        >
          <ExternalLink className="h-4 w-4" />
          Página do evento
        </Button>
      </div>

      {/* Consolidado — o que o tesoureiro e a liderança querem de relance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Indicador rotulo="inscritos" valor={resumo.total - resumo.cancelados} icone={<Users className="h-4 w-4" />} />
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
      </div>

      {resumo.valorPrevisto > 0 && (
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
              <p className="font-semibold">{formatarBRL(resumo.valorPrevisto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="font-semibold text-green-600">{formatarBRL(resumo.valorPago)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A receber</p>
              <p className={`font-semibold ${resumo.saldo > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {formatarBRL(resumo.saldo)}
              </p>
            </div>
          </div>

          {resumo.percentualPago !== null && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.min(100, resumo.percentualPago)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right tabular-nums">
                {resumo.percentualPago}% recebido
              </p>
            </div>
          )}
        </div>
      )}

      {inscritos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma inscrição ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
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
                  eventoId={params.eventoId}
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
