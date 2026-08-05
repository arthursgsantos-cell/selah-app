'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, XCircle, Loader2, Ban, ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelarMinhaInscricaoAction } from '@/app/actions/ensino/inscricoes'
import type { StatusInscricaoEnsino, TipoInscricaoTurma } from '@/lib/supabase/types'

interface Props {
  turmaId: string
  inscricao: { id: string; status: StatusInscricaoEnsino; observacao: string | null } | null
  /** Falso quando as inscrições estão fechadas, a turma encerrou ou lotou. */
  disponivel: boolean
  motivoIndisponivel: string
  tipo: TipoInscricaoTurma
  linkUrl: string | null
  whatsapp: string | null
}

const APRESENTACAO: Record<
  StatusInscricaoEnsino,
  { icone: React.ReactNode; titulo: string; texto: string; classe: string }
> = {
  pendente: {
    icone: <Clock className="h-5 w-5" />,
    titulo: 'Inscrição enviada',
    texto: 'O professor vai avaliar seu pedido. Você verá o resultado aqui.',
    classe: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  aprovada: {
    icone: <CheckCircle2 className="h-5 w-5" />,
    titulo: 'Inscrição aprovada',
    texto: 'Você está na turma. Os materiais e as aulas já aparecem para você.',
    classe: 'border-green-200 bg-green-50 text-green-800',
  },
  concluida: {
    icone: <CheckCircle2 className="h-5 w-5" />,
    titulo: 'Curso concluído',
    texto: 'Você concluiu esta turma.',
    classe: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  recusada: {
    icone: <XCircle className="h-5 w-5" />,
    titulo: 'Inscrição recusada',
    texto: 'Fale com a coordenação do Ensino para entender os próximos passos.',
    classe: 'border-red-200 bg-red-50 text-red-800',
  },
  cancelada: {
    icone: <Ban className="h-5 w-5" />,
    titulo: 'Inscrição cancelada',
    texto: 'Você cancelou sua inscrição nesta turma.',
    classe: 'border-gray-200 bg-gray-50 text-gray-700',
  },
}

export function InscricaoTurma({
  turmaId, inscricao, disponivel, motivoIndisponivel, tipo, linkUrl, whatsapp,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  // Recusada e cancelada não bloqueiam: a pessoa pode pedir de novo se a turma
  // ainda estiver aberta.
  const ativa =
    inscricao && ['pendente', 'aprovada', 'concluida'].includes(inscricao.status)

  function cancelar() {
    if (!inscricao) return
    setErro(null)
    startTransition(async () => {
      const r = await cancelarMinhaInscricaoAction(inscricao.id)
      if (!r.ok) { setErro(r.erro); return }
      setConfirmando(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {inscricao && (
        <div className={`rounded-2xl border p-4 ${APRESENTACAO[inscricao.status].classe}`}>
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">{APRESENTACAO[inscricao.status].icone}</div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{APRESENTACAO[inscricao.status].titulo}</p>
              <p className="text-xs mt-0.5 opacity-90">{APRESENTACAO[inscricao.status].texto}</p>
              {inscricao.observacao && (
                <p className="text-xs mt-1.5 opacity-90">
                  <span className="font-medium">Observação:</span> {inscricao.observacao}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link externo e WhatsApp levam para fora, e o app não guarda inscrição
          nenhuma — por isso continuam disponíveis mesmo para quem já tem um
          registro antigo aqui dentro. */}
      {disponivel && tipo === 'link' && linkUrl && (
        <Button
          size="lg"
          className="w-full"
          render={<a href={linkUrl} target="_blank" rel="noopener noreferrer" />}
        >
          Fazer inscrição
          <ExternalLink className="h-4 w-4" />
        </Button>
      )}

      {disponivel && tipo === 'whatsapp' && whatsapp && (
        <Button
          size="lg"
          className="w-full"
          render={
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <MessageCircle className="h-4 w-4" />
          Inscrever pelo WhatsApp
        </Button>
      )}

      {!ativa && disponivel && (tipo === 'app' || tipo === 'formulario') && (
        <Button size="lg" className="w-full" render={<Link href={`/ensino/inscricao/${turmaId}`} />}>
          {inscricao ? 'Pedir inscrição de novo' : 'Quero me inscrever'}
        </Button>
      )}

      {!ativa && !disponivel && (
        <p className="rounded-2xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          {motivoIndisponivel}
        </p>
      )}

      {ativa && inscricao?.status !== 'concluida' && (
        <>
          {confirmando ? (
            <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
              <p className="text-sm">
                Cancelar sua inscrição nesta turma? Você pode pedir de novo enquanto houver vaga.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={cancelar} disabled={isPending}>
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Sim, cancelar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)} disabled={isPending}>
                  Manter inscrição
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="w-full text-center text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Cancelar minha inscrição
            </button>
          )}
        </>
      )}

      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  )
}
