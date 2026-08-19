'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, UserCircle, LogOut, LogIn, Bell, ClipboardList, CheckCheck, Loader2, Info, UserCheck, ArrowLeft, Ticket, GraduationCap } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { signOutAction } from '@/app/actions/meu-perfil'
import { buscarNotificacoes, marcarComoLida, marcarTodasComoLidas } from '@/app/actions/notificacoes'
import type { Notificacao } from '@/app/actions/notificacoes'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Role } from '@/lib/supabase/types'
import { NAV_SECTIONS, canSeeNavItem } from '@/lib/nav-items'
import { destinoNotificacao } from '@/lib/notificacoes-destino'

interface HeaderProps {
  userName?: string
  userRole?: Role
  avatarUrl?: string
  churchLogoUrl?: string | null
  churchName?: string | null
  isGuest?: boolean
  notificacoesNaoLidas?: number
  /**
   * Quem tem sino. Antes era só admin e pastor; a equipe do Ensino entrou
   * porque o pedido de inscrição chega por aqui, e o cargo de professor não
   * vive em `Role` — o layout é quem sabe consultar `ensino_equipe`.
   */
  recebeNotificacoes?: boolean
  /** Membro autorizado a acessar a lista compartilhada de pedidos. */
  acessoPedidos?: boolean
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
  inscricao_ensino: <GraduationCap className="h-4 w-4 text-primary" />,
}

export function Header({ userName = 'Usuário', userRole = 'membro', avatarUrl, churchLogoUrl, churchName, isGuest = false, notificacoesNaoLidas = 0, recebeNotificacoes, acessoPedidos = false }: HeaderProps) {
  const [navOpen, setNavOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [naoLidas, setNaoLidas] = useState(notificacoesNaoLidas)
  const [, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  const initials = userName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  useEffect(() => { setNaoLidas(notificacoesNaoLidas) }, [notificacoesNaoLidas])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setNotifOpen(false)
      }
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false)
      }
    }
    if (menuOpen || notifOpen || navOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen, notifOpen, navOpen])

  const visibleSectionsBase = NAV_SECTIONS
    .map((s) => ({
      ...s,
      label: s.label === 'Igreja' ? (churchName ?? 'Igreja') : s.label,
      items: s.items.filter((item) => canSeeNavItem(userRole, item)),
    }))
    .filter((s) => s.items.length > 0)
  const visibleSections = acessoPedidos
    ? [...visibleSectionsBase, { label: 'Acesso compartilhado', items: [{ href: '/pastor?aba=pedidos&compartilhado=1', label: 'Pedidos', icon: ClipboardList, minRole: null }] }]
    : visibleSectionsBase

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

  // `recebeNotificacoes` ausente cai no critério antigo, para o header seguir
  // funcionando em qualquer tela que ainda não passe a prop.
  const showNotificacoes =
    !isGuest && (recebeNotificacoes ?? (userRole === 'admin' || userRole === 'pastor'))

  return (
    /* A faixa do recorte entra como padding e a altura cresce junto, então a
       linha do logo continua com 4rem de área útil e o conteúdo deixa de
       passar por baixo do relógio e da bateria do iPhone. */
    <header className="pt-safe flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b bg-background px-4 md:px-6">
      {/* Logo */}
      <Link href="/home" className="inline-flex items-center gap-2">
        {churchLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={churchLogoUrl} alt="Logo da Igreja" className="h-8 max-w-[160px] object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.png" alt="Igreja Batista Zona Sul" className="h-8 w-auto object-contain" />
        )}
      </Link>

      <div className="flex items-center gap-2">
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
            onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); setNavOpen(false) }}
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

              <Link
                href="/minhas-inscricoes"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
              >
                <Ticket className="h-4 w-4" />
                Minhas inscrições
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
                  notificacoes.map((n) => {
                    // Toda notificação é atalho: o pedido de inscrição leva
                    // direto à tela de aprovação, o membro novo à ficha dele.
                    // Ver `lib/notificacoes-destino.ts`.
                    const href = destinoNotificacao(n.tipo, n.dados)
                    const conteudo = (
                      <>
                        <div className="shrink-0 mt-0.5">
                          {tipoIcon[n.tipo] ?? <Info className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm leading-snug ${!n.lida ? 'font-medium' : ''}`}>{n.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.mensagem}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                            {href && <span className="ml-1.5 text-primary font-medium">· ver</span>}
                          </p>
                        </div>
                        {!n.lida && (
                          <div className="shrink-0 mt-1.5">
                            <span className="h-2 w-2 rounded-full bg-primary block" />
                          </div>
                        )}
                      </>
                    )
                    const classe = `w-full flex gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-0 ${!n.lida ? 'bg-primary/5' : ''}`

                    return href ? (
                      <Link
                        key={n.id}
                        href={href}
                        onClick={() => { if (!n.lida) handleMarcarLida(n.id); setNotifOpen(false) }}
                        className={classe}
                      >
                        {conteudo}
                      </Link>
                    ) : (
                      <button
                        key={n.id}
                        onClick={() => !n.lida && handleMarcarLida(n.id)}
                        className={classe}
                      >
                        {conteudo}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Menu de navegação — à direita da foto de perfil */}
        {!isGuest && (
          <div ref={navRef} className="relative">
            <button
              type="button"
              onClick={() => { setNavOpen((v) => !v); setMenuOpen(false); setNotifOpen(false) }}
              aria-label="Abrir menu de navegação"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            {navOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-background shadow-md z-50 py-1">
                {visibleSections.map((section, si) => (
                  <div key={si}>
                    {section.label && (
                      <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 select-none">
                        {section.label}
                      </p>
                    )}
                    {section.items.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(href + '/')
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setNavOpen(false)}
                          className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                            active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {label}
                        </Link>
                      )
                    })}
                    {si < visibleSections.length - 1 && <div className="my-1 border-t" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

