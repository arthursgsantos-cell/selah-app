'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, MapPin, X, Check, Users, Heart, ClipboardList } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { responderPresencaEventoAction } from '@/app/actions/evento-presencas'
import { toggleLikeEventoAction } from '@/app/actions/evento-likes'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import Link from 'next/link'
import type { TipoInscricao, TipoChavePix } from '@/lib/supabase/types'

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
  tipo_inscricao?: TipoInscricao | null
  whatsapp_inscricao?: string | null
  pix_chave?: string | null
  pix_tipo?: TipoChavePix | null
  pix_nome?: string | null
  pix_valor?: number | null
  formulario_id?: string | null
}

interface Props {
  evento: Evento
  minhaResposta: 'vou' | 'nao_vou' | null
  totalVou: number
  redeNome?: string | null
  totalLikes?: number
  euCurtei?: boolean
  minhaInscricao?: { id: string; status: string } | null
  editButton?: ReactNode
}

export function EventoCard({ evento, minhaResposta: minhaRespostaInit, totalVou: totalVouInit, redeNome, totalLikes: totalLikesInit = 0, euCurtei: euCurteiInit = false, minhaInscricao, editButton }: Props) {
  const [aberto, setAberto] = useState(false)
  const [minhaResposta, setMinhaResposta] = useState(minhaRespostaInit)
  const [totalVou, setTotalVou] = useState(totalVouInit)
  const [isPending, startTransition] = useTransition()
  const [sharingImg, setSharingImg] = useState(false)
  const [euCurtei, setEuCurtei] = useState(euCurteiInit)
  const [totalLikes, setTotalLikes] = useState(totalLikesInit)
  const [likePending, setLikePending] = useState(false)

  const tipo = tipoConfig[evento.tipo] ?? tipoConfig.outro
  const data = new Date(evento.data_hora)
  const badgeLabel = evento.tipo === 'rede' && redeNome ? redeNome : tipo.label

  async function toggleLike() {
    if (likePending) return
    setLikePending(true)
    setEuCurtei((v) => !v)
    setTotalLikes((n) => euCurtei ? Math.max(0, n - 1) : n + 1)
    try {
      await toggleLikeEventoAction(evento.id, window.location.pathname)
    } catch {
      setEuCurtei((v) => !v)
      setTotalLikes((n) => euCurtei ? n + 1 : Math.max(0, n - 1))
    } finally {
      setLikePending(false)
    }
  }

  async function compartilharTexto() {
    const dataStr = format(data, "EEEE, d/MM 'às' HH'h'mm", { locale: ptBR })
    const dataCapitalized = dataStr.charAt(0).toUpperCase() + dataStr.slice(1)
    let text = `*${evento.titulo}*\n${dataCapitalized}\n`
    if (evento.local) text += `📍 ${evento.local}\n`
    if (evento.descricao) text += `\n${evento.descricao}\n`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function compartilharImagem() {
    if (!evento.imagem_url) return
    setSharingImg(true)
    try {
      const response = await fetch(evento.imagem_url)
      const blob = await response.blob()
      const ext = blob.type.includes('png') ? 'png' : 'jpg'
      const file = new File([blob], `${evento.titulo}.${ext}`, { type: blob.type })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = file.name; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    } finally {
      setSharingImg(false)
    }
  }

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
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipo.className}`}>
                {badgeLabel}
              </span>
              {editButton && (
                <span onClick={(e) => e.stopPropagation()} className="contents">
                  {editButton}
                </span>
              )}
            </div>
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
          <div className="flex items-center justify-between mt-1.5">
            {minhaResposta ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                minhaResposta === 'vou' ? 'text-green-600' : 'text-muted-foreground'
              }`}>
                {minhaResposta === 'vou' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {minhaResposta === 'vou' ? 'Confirmado' : 'Não vou'}
              </span>
            ) : <span />}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleLike() }}
              className="flex items-center gap-1 text-[11px] font-medium"
            >
              <Heart className={`h-3.5 w-3.5 transition-colors ${euCurtei ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} />
              {totalLikes > 0 && <span className={euCurtei ? 'text-rose-500' : 'text-muted-foreground'}>{totalLikes}</span>}
            </button>
          </div>
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
                {badgeLabel}
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
              <p className="text-sm text-foreground/80 leading-relaxed border-t border-border/60 pt-3 whitespace-pre-wrap">
                {evento.descricao}
              </p>
            )}

            {/* Compartilhar + Like */}
            <div className="border-t border-border/60 pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={compartilharTexto}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#25D366] text-white hover:bg-[#20bb5a] transition-colors"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                Texto
              </button>
              {evento.imagem_url && (
                <button
                  type="button"
                  onClick={compartilharImagem}
                  disabled={sharingImg}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 transition-colors disabled:opacity-50"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  {sharingImg ? '...' : 'Imagem'}
                </button>
              )}
              <button
                type="button"
                onClick={toggleLike}
                className="ml-auto flex items-center gap-1.5 text-sm font-medium"
              >
                <Heart className={`h-5 w-5 transition-all ${euCurtei ? 'fill-rose-500 text-rose-500 scale-110' : 'text-muted-foreground hover:text-rose-400'}`} />
                {totalLikes > 0 && <span className={`text-sm ${euCurtei ? 'text-rose-500' : 'text-muted-foreground'}`}>{totalLikes}</span>}
              </button>
            </div>

            {/* RSVP ou Inscrição */}
            <div className="border-t border-border/60 pt-3 space-y-2">
              {(!evento.tipo_inscricao || evento.tipo_inscricao === 'aberto') ? (
                <>
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
                </>
              ) : evento.tipo_inscricao === 'whatsapp' && evento.whatsapp_inscricao ? (
                <a
                  href={`https://wa.me/${evento.whatsapp_inscricao}?text=${encodeURIComponent('Olá! Gostaria de me inscrever no evento.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-10 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#20bb5a] transition-colors w-full"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  {minhaInscricao ? 'Inscrito via WhatsApp ✓' : 'Fazer inscrição via WhatsApp'}
                </a>
              ) : (
                <Link
                  href={`/inscricao/${evento.id}`}
                  onClick={() => setAberto(false)}
                  className={`flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-colors w-full ${
                    minhaInscricao
                      ? 'bg-green-500 text-white'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  {minhaInscricao ? 'Inscrito ✓ — Ver detalhes' : evento.tipo_inscricao === 'pix' ? 'Inscrever e pagar' : 'Fazer inscrição'}
                </Link>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
