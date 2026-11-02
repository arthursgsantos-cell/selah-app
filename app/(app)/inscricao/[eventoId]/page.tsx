import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FormularioInscricao } from '@/components/eventos/formulario-inscricao'
import { PixDisplay } from '@/components/eventos/pix-display'
import type { TipoChavePix } from '@/lib/supabase/types'

export default async function InscricaoPage({ params }: { params: { eventoId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: evento } = await admin
    .from('eventos')
    .select('id, titulo, data_hora, local, tipo_inscricao, formulario_id, pix_chave, pix_tipo, pix_nome, pix_valor, link_pagamento, pix_copia_cola, whatsapp_inscricao')
    .eq('id', params.eventoId)
    .single()

  if (!evento) notFound()
  if (evento.tipo_inscricao === 'aberto') redirect('/home')
  if (evento.tipo_inscricao === 'whatsapp') redirect('/home')

  // Verifica inscrição existente
  const { data: jaInscrito } = await supabase
    .from('inscricoes_evento')
    .select('id, status')
    .eq('evento_id', params.eventoId)
    .eq('user_id', user.id)
    .neq('status', 'cancelado')
    .maybeSingle()

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

  const temPix = Boolean(evento.pix_chave && evento.pix_tipo && evento.pix_nome)
  const temPagamento = temPix || Boolean(evento.link_pagamento) || Boolean(evento.pix_copia_cola)

  const pagamento = temPagamento ? (
    <PixDisplay
      chave={evento.pix_chave}
      tipo={evento.pix_tipo as TipoChavePix | null}
      nome={evento.pix_nome}
      valor={evento.pix_valor}
      link={evento.link_pagamento}
      copiaCola={evento.pix_copia_cola}
    />
  ) : null

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
        <div className="space-y-5">
          <div className="rounded-2xl bg-green-50 border border-green-200 p-5 text-center">
            <p className="text-green-700 font-semibold">Você já está inscrito!</p>
          </div>
          {pagamento && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Falta só o pagamento para confirmar sua inscrição:
              </p>
              {pagamento}
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

          {pagamento && (
            <div className="space-y-4 border-t border-border pt-5">
              <p className="text-sm text-muted-foreground">
                {formulario
                  ? 'Depois de enviar o formulário, realize o pagamento para confirmar sua inscrição:'
                  : 'Realize o pagamento para confirmar sua inscrição:'}
              </p>
              {pagamento}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
