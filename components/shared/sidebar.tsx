'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Users,
  CalendarDays,
  Shield,
  ChurchIcon,
  UserCog,
  ChevronLeft,
  ChevronRight,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/supabase/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  minRole: Role | null
}

interface NavSection {
  label: string | null
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: null,
    items: [
      { href: '/home',   label: 'Início',       icon: Home,  minRole: null },
      { href: '/celula', label: 'Minha célula',  icon: Users, minRole: null },
    ],
  },
  {
    label: 'Agenda',
    items: [
      { href: '/eventos',   label: 'Eventos',   icon: CalendarDays, minRole: null },
      { href: '/historico', label: 'Histórico', icon: History,      minRole: null },
    ],
  },
  {
    label: 'Igreja',
    items: [
      { href: '/supervisor', label: 'Rede',          icon: Shield,     minRole: 'supervisor' as Role },
      { href: '/pastor',     label: 'Administração',  icon: ChurchIcon, minRole: 'pastor' as Role },
      { href: '/usuarios',   label: 'Membros',        icon: UserCog,    minRole: 'pastor' as Role },
    ],
  },
]

const roleOrder: Record<Role, number> = {
  membro: 0,
  lider: 1,
  lider_treinamento: 1,
  supervisor: 2,
  supervisor_treinamento: 2,
  pastor: 3,
  admin: 4,
}

interface SidebarProps {
  role?: Role
  onNavigate?: () => void
  churchLogoUrl?: string | null
  churchName?: string | null
}

export function Sidebar({ role = 'membro', onNavigate, churchLogoUrl, churchName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  function canSee(item: NavItem) {
    if (!item.minRole) return true
    return roleOrder[role] >= roleOrder[item.minRole]
  }

  const visibleSections = navSections
    .map((s) => ({
      ...s,
      label: s.label === 'Igreja' ? (churchName ?? 'Igreja') : s.label,
      items: s.items.filter(canSee),
    }))
    .filter((s) => s.items.length > 0)

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-sidebar transition-all duration-200',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-2">
        <Link href="/home" className="inline-flex items-center">
          {churchLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={churchLogoUrl}
              alt="Logo da Igreja"
              className={cn('object-contain', collapsed ? 'h-8 w-8' : 'h-10 max-w-[160px]')}
            />
          ) : collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-icon.png" alt="Selah" className="h-8 w-8 object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-horizontal.png" alt="Selah" className="h-9 max-w-[160px] object-contain" />
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-sidebar-foreground transition-colors hover:bg-muted md:inline-flex"
          aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        {visibleSections.map((section, si) => (
          <div key={si}>
            {/* Section label — hidden when collapsed */}
            {section.label && !collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none">
                {section.label}
              </p>
            )}
            {/* Divider when collapsed (except first section) */}
            {section.label && collapsed && si > 0 && (
              <div className="mx-3 mb-2 border-t border-border/40" />
            )}
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    title={label}
                    className={cn(
                      'flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center' : 'gap-3',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

    </aside>
  )
}
