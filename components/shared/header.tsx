'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Menu, UserCircle, LogOut, LogIn, Bell, ClipboardList, CheckCheck, Loader2, Info, UserCheck, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { signOutAction } from '@/app/actions/meu-perfil'
import { buscarNotificacoes, marcarComoLida, marcarTodasComoLidas } from '@/app/actions/notificacoes'
import type { Notificacao } from '@/app/actions/notificacoes'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Role } from '@/lib/supabase/types'

interface HeaderProps {
  userName?: string
  userRole?: Role
  avatarUrl?: string
  churchLogoUrl?: string | null
  churchName?: string | null
  isGuest?: boolean
  notificacoesNaoLidas?: number
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  pastor: 'Pastor',
  supervisor: 'Supervisor',
  supervisor_treinamento: 'Supervisor em Trein.',
  lider: 'Líder',
  lider_treinamento: 'Líder em Trein.',
  membro: 'Membro',
}

const tipoIcon: Record<string, React.ReactNode> = {
  novo_login: <UserCheck className="h-4 w-4 text-blue-500" />,
  match_confirmado: <UserCheck className="h-4 w-4 text-green-500" />,
  match_sugerido: <UserCheck className="h-4 w-4 text-amber-500" />,
}

export function Header({ userName = 'Usuário', userRole = 'membro', avatarUrl, churchLogoUrl, churchName, isGuest = false, notificacoesNaoLidas = 0 }: HeaderProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [naoLidas, setNaoLidas] = useState(notificacoesNaoLidas)
  const [, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = userName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  useEffect(() => { setNaoLidas(notificacoesNaoLidas) }, [notificacoesNaoLidas])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setNotifOpen(false)
      }
    }
    if (menuOpen || notifOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen, notifOpen])

  async function handleAbrirNotificacoes() {
    setMenuOpen(false)
    setNotifOpen(true)
    setCarregando(true)
    const data = await buscarNotificacoes()
    setNotificacoes(data)
    setCarregando(false)
  }

  function handleMarcarLida(id: string) {
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
    setNaoLidas((v) => Math.max(0, v - 1))
    startTransition(() => marcarComoLida(id))
  }

  function handleMarcarTodas() {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
    setNaoLidas(0)
    startTransition(async () => { await marcarTodasComoLidas() })
  }

  const showNotificacoes = !isGuest && (userRole === 'admin' || userRole === 'pastor')

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      {/* Botão menu mobile */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar role={userRole} onNavigate={() => setSheetOpen(false)} churchLogoUrl={churchLogoUrl} churchName={churchName} />
        </SheetContent>
      </Sheet>

      {/* Logo mobile */}
      <Link href="/home" className="md:hidden inline-flex">
        {churchLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={churchLogoUrl} alt="Logo da Igreja" className="h-8 max-w-[120px] object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.png" alt="Igreja Batista Zona Sul" className="h-8 w-auto object-contain" />
        )}
      </Link>

      <div className="hidden md:block" />

      {/* Avatar com dropdown */}
      {isGuest ? (
        <Link
          href="/login"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <LogIn className="h-4 w-4" />
          Entrar
        </Link>
      ) : (
        <div ref={menuRef} className="relative">
          <button
            onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false) }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none"
          >
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <Badge variant="secondary" className="mt-1 text-xs font-normal">
                {roleLabels[userRole] ?? userRole}
              </Badge>
            </div>
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} alt={userName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {naoLidas > 0 && showNotificacoes && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-background" />
              )}
            </div>
          </button>

          {/* Dropdown perfil */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border bg-background shadow-md z-50 py-1">
              <Link
                href="/perfil"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
              >
                <UserCircle className="h-4 w-4" />
                Meu perfil
              </Link>

              {showNotificacoes && (
                <button
                  onClick={handleAbrirNotificacoes}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  Notificações
                  {naoLidas > 0 && (
                    <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
                      {naoLidas > 9 ? '9+' : naoLidas}
                    </span>
                  )}
                </button>
              )}

              {(userRole === 'lider' || userRole === 'lider_treinamento') && (
                <Link
                  href="/solicitacoes"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  Solicitações
                </Link>
              )}
              {(userRole === 'pastor' || userRole === 'admin') && (
                <Link
                  href="/pendencias"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  <ClipboardList className="h-4 w-4" />
                  Pendências
                </Link>
              )}
              <div className="my-1 border-t" />
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </form>
            </div>
          )}

          {/* Painel de notificações */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-background shadow-lg z-50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b">
                <button
                  onClick={() => { setNotifOpen(false); setMenuOpen(true) }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="font-semibold text-sm flex-1">Notificações</span>
                {naoLidas > 0 && (
                  <button
                    onClick={handleMarcarTodas}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Marcar todas
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
                      className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-0 ${!n.lida ? 'bg-primary/5' : ''}`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {tipoIcon[n.tipo] ?? <Info className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-snug ${!n.lida ? 'font-medium' : ''}`}>{n.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.mensagem}</p>
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
      )}
    </header>
  )
}
