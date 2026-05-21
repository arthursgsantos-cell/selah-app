'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, MapPin, X, Check, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { responderPresencaEventoAction } from '@/app/actions/evento-presencas'

const tipoConfig: Record<string, { label: string; className: string }> = {
  culto:  { label: 'Culto',   className: 'bg-purple-100 text-purple-700' },
  igreja: { label: 'Igreja',  className: 'bg-blue-100   text-blue-700'   },
  rede:   { label: 'Rede',    className: 'bg-green-100  text-green-700'  },
  celula: { label: 'Célula',  className: 'bg-yellow-100 text-yellow-700' },
  outro:  { label: 'Outro',   className: 'bg-gray-100   text-gray-600'   },
}

interface Evento {
  id: string
  titulo: string
  descricao?: string | null
  data_hora: string
  local: string | null
  tipo: string
  imagem_url: string | null
}

interface Props {
  evento: Evento
  minhaResposta: 'vou' | 'nao_vou' | null
  totalVou: number
}

export function EventoCard({ evento, minhaResposta: minhaRespostaInit, totalVou: totalVouInit }: Props) {
  const [aberto, setAberto] = useState(false)
  const [minhaResposta, setMinhaResposta] = useState(minhaRespostaInit)
  const [totalVou, setTotalVou] = useState(totalVouInit)
  const [isPending, startTransition] = useTransition()

  const tipo = tipoConfig[evento.tipo] ?? tipoConfig.outro
  const data = new Date(evento.data_hora)

  function responder(novaResposta: 'vou' | 'nao_vou') {
    const toggle = minhaResposta === novaResposta ? null : novaResposta

    // optimistic update
    const anterior = minhaResposta
    const anteriorTotal = totalVou
    setMinhaResposta(toggle)
    if (anterior === 'vou' && toggle !== 'vou') setTotalVou((n) => Math.max(0, n - 1))
    if (anterior !== 'vou' && toggle === 'vou') setTotalVou((n) => n + 1)

    startTransition(async () => {
      try {
        await responderPresencaEventoAction(evento.id, toggle)
      } catch {
        // rollback
        setMinhaResposta(anterior)
        setTotalVou(anteriorTotal)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full text-left flex gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-accent/30 transition-colors"
      >
        {evento.imagem_url ? (
          <img src={evento.imagem_url} alt={evento.titulo} className="h-14 w-14 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarDays className="h-6 w-6 text-primary/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-snug">{evento.titulo}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${tipo.className}`}>
              {tipo.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 capitalize">
            {format(data, "EEE, d 'de' MMM 'às' HH'h'mm", { locale: ptBR })}
          </p>
          {evento.local && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              {evento.local}
            </p>
          )}
          {/* Indicador de resposta no card */}
          {minhaResposta && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-1.5 ${
              minhaResposta === 'vou' ? 'text-green-600' : 'text-muted-foreground'
            }`}>
              {minhaResposta === 'vou' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {minhaResposta === 'vou' ? 'Confirmado' : 'Não vou'}
            </span>
          )}
        </div>
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent showCloseButton={false} className="p-0 overflow-hidden max-w-sm w-full gap-0">
          {/* Imagem completa */}
          {evento.imagem_url && (
            <div className="w-full bg-black flex items-center justify-center">
              <img
                src={evento.imagem_url}
                alt={evento.titulo}
                className="w-full max-h-72 object-contain"
              />
            </div>
          )}

          {/* Botão fechar */}
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Conteúdo */}
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <DialogTitle className="flex-1 text-base font-bold leading-snug">
                {evento.titulo}
              </DialogTitle>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 mt-0.5 ${tipo.className}`}>
                {tipo.label}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                <span className="capitalize">
                  {format(data, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH'h'mm", { locale: ptBR })}
                </span>
              </div>
              {evento.local && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span>{evento.local}</span>
                </div>
              )}
            </div>

            {evento.descricao && (
              <p className="text-sm text-foreground/80 leading-relaxed border-t border-border/60 pt-3">
                {evento.descricao}
              </p>
            )}

            {/* RSVP */}
            <div className="border-t border-border/60 pt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => responder('vou')}
                  className={`flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                    minhaResposta === 'vou'
                      ? 'bg-green-500 text-white'
                      : 'border-2 border-green-300 text-green-700 hover:bg-green-50'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  Eu vou
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => responder('nao_vou')}
                  className={`flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                    minhaResposta === 'nao_vou'
                      ? 'bg-gray-400 text-white'
                      : 'border-2 border-gray-200 text-muted-foreground hover:bg-gray-50'
                  }`}
                >
                  <X className="h-4 w-4" />
                  Não vou
                </button>
              </div>

              {totalVou > 0 && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Users className="h-3 w-3" />
                  {totalVou} {totalVou === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
