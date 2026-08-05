'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Loader2, UserCheck, LogIn, Info } from 'lucide-react'
import { buscarNotificacoes, marcarComoLida, marcarTodasComoLidas } from '@/app/actions/notificacoes'
import type { Notificacao } from '@/app/actions/notificacoes'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const tipoIcon: Record<string, React.ReactNode> = {
  novo_login: <LogIn className="h-4 w-4 text-blue-500" />,
  match_confirmado: <UserCheck className="h-4 w-4 text-green-500" />,
  match_sugerido: <UserCheck className="h-4 w-4 text-amber-500" />,
}

interface Props {
  naoLidas: number
}

export function NotificacoesBell({ naoLidas: initialCount }: Props) {
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [naoLidas, setNaoLidas] = useState(initialCount)
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    setNaoLidas(initialCount)
  }, [initialCount])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function handleOpen() {
    if (open) { setOpen(false); return }
    setOpen(true)
    setCarregando(true)
    const data = await buscarNotificacoes()
    setNotificacoes(data)
    setCarregando(false)
  }

  function handleMarcarLida(id: string) {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    )
    setNaoLidas((v) => Math.max(0, v - 1))
    startTransition(() => marcarComoLida(id))
  }

  function handleMarcarTodas() {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
    setNaoLidas(0)
    startTransition(async () => {
      await marcarTodasComoLidas()
      router.refresh()
    })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-4.5 w-4.5" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-background shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notificações</span>
            {naoLidas > 0 && (
              <button
                onClick={handleMarcarTodas}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {carregando ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </div>
            ) : (
              notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.lida && handleMarcarLida(n.id)}
                  className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-0 ${
                    !n.lida ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {tipoIcon[n.tipo] ?? <Info className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!n.lida ? 'font-medium' : ''}`}>
                      {n.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {n.mensagem}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.lida && (
                    <div className="shrink-0 mt-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary block" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
