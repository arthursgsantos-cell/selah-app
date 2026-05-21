'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Menu, UserCircle, LogOut, LogIn, Bell, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { signOutAction } from '@/app/actions/meu-perfil'

import { NotificacoesBell } from './notificacoes-bell'
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

export function Header({ userName = 'Usuário', userRole = 'membro', avatarUrl, churchLogoUrl, churchName, isGuest = false, notificacoesNaoLidas = 0 }: HeaderProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      {/* Botão menu mobile */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="md:hidden" />}
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar role={userRole} onNavigate={() => setSheetOpen(false)} churchLogoUrl={churchLogoUrl} churchName={churchName} />
        </SheetContent>
      </Sheet>

      {/* Logo mobile (centro) */}
      <Link href="/home" className="md:hidden inline-flex">
        {churchLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={churchLogoUrl} alt="Logo da Igreja" className="h-8 max-w-[120px] object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.png" alt="Igreja Batista Zona Sul" className="h-8 w-auto object-contain" />
        )}
      </Link>

      {/* Espaço vazio no desktop */}
      <div className="hidden md:block" />

      {/* Sino de notificações (admin/pastor) */}
      {!isGuest && (userRole === 'admin' || userRole === 'pastor') && (
        <NotificacoesBell naoLidas={notificacoesNaoLidas} />
      )}

      {/* Avatar com dropdown ou botão de login */}
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
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none"
          >
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <Badge variant="secondary" className="mt-1 text-xs font-normal">
                {roleLabels[userRole] ?? userRole}
              </Badge>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>

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
        </div>
      )}
    </header>
  )
}
