import { redirect, notFound } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'
import {
  calcularParcelas,
  formatarBRL,
  totalPago,
  type ParcelaEvento,
  type PagamentoInscricao,
} from '@/lib/evento-cobranca'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FormularioInscricao } from '@/components/eventos/formulario-inscricao'
import { PixDisplay } from '@/components/eventos/pix-display'
import type { TipoChavePix } from '@/lib/supabase/types'

export default async function InscricaoPage({ params }: { params: { eventoId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom(`/inscricao/${params.eventoId}`))

  const admin = createAdminClient()
  const { data: evento } = await admin
    .from('eventos')
    .select('id, titulo, data_hora, local, tipo_inscricao, formulario_id, pix_chave, pix_tipo, pix_nome, pix_valor, whatsapp_inscricao')
    .eq('id', params.eventoId)
    .single()

  if (!evento) notFound()
  if (evento.tipo_inscricao === 'aberto') redirect('/home')
  if (evento.tipo_inscricao === 'whatsapp') redirect('/home')

  // Verifica inscrição existente
  const { data: jaInscrito } = await supabase
    .from('inscricoes_evento')
    .select('id, status, valor_total')
    .eq('evento_id', params.eventoId)
    .eq('user_id', user.id)
    .neq('status', 'cancelado')
    .maybeSingle()

  // Situação financeira de quem já está inscrito
  const [{ data: parcelasData }, { data: pagamentosData }] = jaInscrito
    ? await Promise.all([
        admin.from('evento_parcelas').select('id, numero, vencimento, percentual').eq('evento_id', params.eventoId).order('numero'),
        admin.from('inscricao_pagamentos').select('id, valor, pago_em, metodo, observacao').eq('inscricao_id', jaInscrito.id).order('pago_em'),
      ])
    : [{ data: [] }, { data: [] }]

  const parcelas = (parcelasData ?? []) as ParcelaEvento[]
  const pagamentos = (pagamentosData ?? []) as PagamentoInscricao[]
  const valorDevido = (jaInscrito?.valor_total as number | null) ?? 0
  const jaPago = totalPago(pagamentos)
  const linhasParcelas = calcularParcelas(valorDevido, parcelas, pagamentos)

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, telefone')
    .eq('id', user.id)
    .single()

  let formulario = null
  if (evento.formulario_id) {
    const { data } = await admin
      .from('formularios')
      .select('id, nome, campos')
      .eq('id', evento.formulario_id)
      .single()
    formulario = data
  }

  const data = new Date(evento.data_hora)

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div>
        <h1 className="text-xl font-bold">{evento.titulo}</h1>
        <p className="text-sm text-muted-foreground capitalize mt-1">
          {format(data, "EEEE, d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })}
        </p>
        {evento.local && (
          <p className="text-sm text-muted-foreground">{evento.local}</p>
        )}
      </div>

      {jaInscrito ? (
        <div className="space-y-4">
        <div className="rounded-2xl bg-green-50 border border-green-200 p-5 text-center space-y-3">
          <p className="text-green-700 font-semibold">Você já está inscrito!</p>
          {evento.tipo_inscricao === 'pix' && evento.pix_chave && evento.pix_tipo && evento.pix_nome && (
            <PixDisplay
              chave={evento.pix_chave}
              tipo={evento.pix_tipo as TipoChavePix}
              nome={evento.pix_nome}
              valor={evento.pix_valor}
            />
          )}
        </div>

        {/* Acompanhamento do pagamento */}
        {valorDevido > 0 && (
          <div className="rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Seu pagamento</h2>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatarBRL(jaPago)}</span>
              <span className="text-sm text-muted-foreground">de {formatarBRL(valorDevido)}</span>
            </div>

            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${Math.min(100, (jaPago / valorDevido) * 100)}%` }}
              />
            </div>

            {jaPago >= valorDevido ? (
              <p className="text-sm text-green-700 font-medium">Pagamento quitado. Obrigado!</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Faltam <span className="font-semibold text-foreground">{formatarBRL(valorDevido - jaPago)}</span>
              </p>
            )}

            {linhasParcelas.length > 0 && (
              <div className="space-y-1 border-t border-border/60 pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Parcelas</p>
                {linhasParcelas.map((l) => (
                  <div key={l.numero} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-6">{l.numero}ª</span>
                    <span className="text-muted-foreground w-20">
                      {l.vencimento.split('-').reverse().join('/')}
                    </span>
                    <span className="font-medium">{formatarBRL(l.valor)}</span>
                    <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      l.status === 'paga' ? 'bg-green-100 text-green-700'
                      : l.status === 'vencida' ? 'bg-red-100 text-red-700'
                      : l.status === 'parcial' ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                    }`}>
                      {l.status === 'paga' ? 'Paga' : l.status === 'vencida' ? 'Vencida' : l.status === 'parcial' ? 'Parcial' : 'Aberta'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {pagamentos.length > 0 && (
              <div className="space-y-1 border-t border-border/60 pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Pagamentos confirmados</p>
                {pagamentos.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-20">{p.pago_em.split('-').reverse().join('/')}</span>
                    <span className="font-medium">{formatarBRL(Number(p.valor))}</span>
                    {p.observacao && <span className="text-muted-foreground truncate">{p.observacao}</span>}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-3">
              Os pagamentos aparecem aqui depois que a tesouraria confirmar o recebimento.
            </p>
          </div>
        )}
        </div>
      ) : (
        <div className="space-y-5">
          {formulario && (
            <FormularioInscricao
              eventoId={params.eventoId}
              formularioId={formulario.id}
              campos={formulario.campos}
              nomeInicial={profile?.nome ?? ''}
              telefoneInicial={profile?.telefone ?? ''}
            />
          )}

          {!formulario && evento.tipo_inscricao === 'pix' && evento.pix_chave && evento.pix_tipo && evento.pix_nome && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Realize o pagamento via PIX para confirmar sua inscrição:</p>
              <PixDisplay
                chave={evento.pix_chave}
                tipo={evento.pix_tipo as TipoChavePix}
                nome={evento.pix_nome}
                valor={evento.pix_valor}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
