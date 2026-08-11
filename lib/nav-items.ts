import {
  Home,
  Users,
  CalendarDays,
  Shield,
  ChurchIcon,
  UserCog,
  History,
  ClipboardList,
  GraduationCap,
  HandCoins,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/lib/supabase/types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  minRole: Role | null
}

export interface NavSection {
  label: string | null
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: '/home',   label: 'Início',       icon: Home,  minRole: null },
      { href: '/celula', label: 'Minha célula',  icon: Users, minRole: null },
      { href: '/contribuir', label: 'Dízimos e ofertas', icon: HandCoins, minRole: null },
    ],
  },
  {
    label: 'Agenda',
    items: [
      { href: '/eventos',     label: 'Eventos',     icon: CalendarDays,   minRole: null },
      // Aberto a todos: é por aqui que o membro descobre as turmas e pede
      // inscrição. Professor e coordenação chegam aos painéis pelo hub.
      { href: '/ensino',      label: 'Ensino',      icon: GraduationCap,  minRole: null },
      { href: '/historico',   label: 'Histórico',   icon: History,        minRole: null },
      { href: '/formularios', label: 'Formulários', icon: ClipboardList,  minRole: 'lider' as Role },
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

export const ROLE_ORDER: Record<Role, number> = {
  convidado: -1,
  membro: 0,
  lider: 1,
  lider_treinamento: 1,
  supervisor: 2,
  supervisor_treinamento: 2,
  pastor: 3,
  admin: 4,
}

export function canSeeNavItem(role: Role, item: NavItem): boolean {
  if (!item.minRole) return true
  return ROLE_ORDER[role] >= ROLE_ORDER[item.minRole]
}
