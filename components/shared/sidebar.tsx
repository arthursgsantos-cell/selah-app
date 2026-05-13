'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, CalendarDays, Shield, ChurchIcon, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/supabase/types'

const allNavItems = [
  { href: '/home', label: 'Início', icon: Home, minRole: null },
  { href: '/celula', label: 'Minha célula', icon: Users, minRole: null },
  { href: '/eventos', label: 'Eventos', icon: CalendarDays, minRole: null },
  { href: '/supervisor', label: 'Rede', icon: Shield, minRole: 'supervisor' as Role },
  { href: '/pastor', label: 'Igreja', icon: ChurchIcon, minRole: 'pastor' as Role },
  { href: '/usuarios', label: 'Usuários', icon: UserCog, minRole: 'pastor' as Role },
]

const roleOrder: Record<Role, number> = {
  membro: 0,
  lider: 1,
  supervisor: 2,
  pastor: 3,
  admin: 4,
}

interface SidebarProps {
  role?: Role
  onNavigate?: () => void
}

export function Sidebar({ role = 'membro', onNavigate }: SidebarProps) {
  const pathname = usePathname()

  const navItems = allNavItems.filter((item) => {
    if (!item.minRole) return true
    return roleOrder[role] >= roleOrder[item.minRole]
  })

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-xl font-bold tracking-tight text-primary">Selah</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-primary text-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
