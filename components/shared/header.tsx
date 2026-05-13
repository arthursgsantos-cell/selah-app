'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

import type { Role } from '@/lib/supabase/types'

interface HeaderProps {
  userName?: string
  userRole?: Role
  avatarUrl?: string
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  pastor: 'Pastor',
  supervisor: 'Supervisor',
  lider: 'Líder',
  membro: 'Membro',
}

export function Header({ userName = 'Usuário', userRole = 'membro', avatarUrl }: HeaderProps) {
  const [open, setOpen] = useState(false)

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      {/* Botão menu mobile */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="md:hidden" />}
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar role={userRole} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Espaço vazio no desktop (sidebar já está visível) */}
      <div className="hidden md:block" />

      {/* Perfil do usuário */}
      <div className="flex items-center gap-3">
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
      </div>
    </header>
  )
}
