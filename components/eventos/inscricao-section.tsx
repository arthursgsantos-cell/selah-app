'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import { PixDisplay } from '@/components/eventos/pix-display'
import { cancelarInscricaoAction } from '@/app/actions/inscricoes'
import { CheckCircle2, ClipboardList, X } from 'lucide-react'
import Link from 'next/link'
import type { TipoInscricao, TipoChavePix } from '@/lib/supabase/types'

interface Props {
  eventoId: string
  tipoInscricao: TipoInscricao
  whatsappInscricao?: string | null
  pixChave?: string | null
  pixTipo?: TipoChavePix | null
  pixNome?: string | null
  pixValor?: number | null
  formularioId?: string | null
  minhaInscricao?: { id: string; status: string } | null
}

export function InscricaoSection({
  eventoId,
  tipoInscricao,
  whatsappInscricao,
  pixChave,
  pixTipo,
  pixNome,
  pixValor,
  formularioId,
  minhaInscricao: minhaInscricaoInit,
}: Props) {
  const [minhaInscricao, setMinhaInscricao] = useState(minhaInscricaoInit)
  const [mostrarPix, setMostrarPix] = useState(false)
  const [isPending, startTransition] = useTransition()

  function cancelar() {
    if (!minhaInscricao) return
    startTransition(async () => {
      await cancelarInscricaoAction(minhaInscricao.id)
      setMinhaInscricao(null)
    })
  }

  // Evento aberto — sem seção extra (RSVP normal)
  if (tipoInscricao === 'aberto') return null

  // Já inscrito
  if (minhaInscricao && minhaInscricao.status !== 'cancelado') {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-3 space-y-2">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">Inscrição realizada!</span>
        </div>
        {tipoInscricao === 'pix' && pixChave && pixTipo && pixNome && (
          <button
            type="button"
            onClick={() => setMostrarPix((v) => !v)}
            className="text-xs text-primary underline"
          >
            {mostrarPix ? 'Ocultar' : 'Ver'} QR code PIX
          </button>
        )}
        {mostrarPix && pixChave && pixTipo && pixNome && (
          <PixDisplay chave={pixChave} tipo={pixTipo} nome={pixNome} valor={pixValor} />
        )}
        <button
          type="button"
          onClick={cancelar}
          disabled={isPending}
          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
        >
          <X className="h-3 w-3" />
          Cancelar inscrição
        </button>
      </div>
    )
  }

  // WhatsApp
  if (tipoInscricao === 'whatsapp' && whatsappInscricao) {
    const msg = encodeURIComponent('Olá! Gostaria de me inscrever no evento.')
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Para se inscrever, entre em contato via WhatsApp:
        </p>
        <a
          href={`https://wa.me/${whatsappInscricao}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 h-10 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#20bb5a] transition-colors w-full"
        >
          <WhatsAppIcon className="h-4 w-4" />
          Fazer inscrição via WhatsApp
        </a>
      </div>
    )
  }

  // Formulário
  if (tipoInscricao === 'formulario' && formularioId) {
    return (
      <Link
        href={`/inscricao/${eventoId}`}
        className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors w-full"
      >
        <ClipboardList className="h-4 w-4" />
        Fazer inscrição
      </Link>
    )
  }

  // PIX (sem inscrição prévia — usuário vai ao form de inscrição e paga depois)
  if (tipoInscricao === 'pix' && pixChave && pixTipo && pixNome) {
    return (
      <div className="space-y-3">
        <Link
          href={`/inscricao/${eventoId}`}
          className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors w-full"
        >
          <ClipboardList className="h-4 w-4" />
          Fazer inscrição e pagar
        </Link>
        <button
          type="button"
          onClick={() => setMostrarPix((v) => !v)}
          className="text-xs text-primary underline w-full text-center"
        >
          {mostrarPix ? 'Ocultar' : 'Ver'} QR code PIX
        </button>
        {mostrarPix && (
          <PixDisplay chave={pixChave} tipo={pixTipo} nome={pixNome} valor={pixValor} />
        )}
      </div>
    )
  }

  return null
}
