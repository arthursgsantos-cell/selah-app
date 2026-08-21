import {
  BookOpen, CalendarDays, ChurchIcon, GraduationCap, HandCoins, HeartHandshake,
  History, Images, Radio, Shield, UserCog, UserRound, Users, type LucideIcon,
} from 'lucide-react'
import { ROLE_ORDER } from '@/lib/nav-items'
import type { Role } from '@/lib/supabase/types'

/**
 * Um quadrado da grade do Modo Ícones.
 *
 * A cor não é enfeite: é o que faz a pessoa achar "Contribuir" pelo verde sem
 * ler a legenda, do mesmo jeito que se acha um app na tela do celular. Vem em
 * par porque o chip do ícone é um degradê — cor cheia e chapada em doze
 * quadrados vira festa junina.
 */
export interface Atalho {
  id: string
  label: string
  href: string
  icon: LucideIcon
  cores: readonly [string, string]
  /** Etiqueta curta no canto — contagem de eventos, "hoje", "no ar". */
  selo?: string | null
  /** Sai do app (a transmissão mora no YouTube). */
  externo?: boolean
  /** Ocupa a linha inteira, deitado. Hoje só a transmissão ao vivo usa. */
  largo?: boolean
}

export interface ContextoAtalhos {
  role: Role
  /** URL da transmissão, só quando a liderança marcou que está no ar. */
  aoVivoUrl: string | null
  contribuicaoAtiva: boolean
  eventosProximos: number
}

/**
 * A grade de atalhos, na ordem em que aparece.
 *
 * Segue o mesmo recorte de cargo do menu (`ROLE_ORDER`): o membro vê seis
 * quadrados, o pastor vê dez. O que some é o que a pessoa não poderia abrir de
 * qualquer forma — quadrado que leva a "sem permissão" é pior que quadrado
 * nenhum.
 */
export function montarAtalhos(ctx: ContextoAtalhos): Atalho[] {
  const podeVer = (minimo: Role) => ROLE_ORDER[ctx.role] >= ROLE_ORDER[minimo]

  const lista: Atalho[] = []

  // Ao vivo encabeça a grade deitado, e não como mais um quadradinho: enquanto
  // o culto está no ar, é a única coisa nesta tela com hora marcada.
  if (ctx.aoVivoUrl) {
    lista.push({
      id: 'ao_vivo',
      label: 'Culto ao vivo',
      href: ctx.aoVivoUrl,
      icon: Radio,
      cores: ['#F43F5E', '#B91C1C'],
      selo: 'NO AR',
      externo: true,
      largo: true,
    })
  }

  lista.push({
    id: 'eventos',
    label: 'Eventos',
    href: '/eventos',
    icon: CalendarDays,
    cores: ['#3B82F6', '#1D4ED8'],
    selo: ctx.eventosProximos > 0 ? String(ctx.eventosProximos) : null,
  })

  lista.push({
    id: 'ensino',
    label: 'Ensino',
    href: '/ensino',
    icon: GraduationCap,
    cores: ['#8B5CF6', '#5B21B6'],
  })

  lista.push({
    id: 'celula',
    label: 'Minha célula',
    href: '/celula',
    icon: Users,
    cores: ['#22D3EE', '#0369A1'],
  })

  if (ctx.contribuicaoAtiva) {
    lista.push({
      id: 'contribuir',
      label: 'Contribuir',
      href: '/contribuir',
      icon: HandCoins,
      cores: ['#34D399', '#047857'],
    })
  }

  lista.push({
    id: 'biblia',
    label: 'Bíblia',
    href: '/biblia',
    icon: BookOpen,
    cores: ['#FBBF24', '#B45309'],
  })

  lista.push({
    id: 'galeria',
    label: 'Fotos',
    href: '/galeria',
    icon: Images,
    cores: ['#F472B6', '#9D174D'],
  })

  lista.push({
    id: 'historico',
    label: 'Histórico',
    href: '/historico',
    icon: History,
    cores: ['#94A3B8', '#334155'],
  })

  lista.push({
    id: 'perfil',
    label: 'Meu perfil',
    href: '/perfil',
    icon: UserRound,
    cores: ['#60A5FA', '#0B2447'],
  })

  if (podeVer('lider')) {
    lista.push({
      id: 'consolidacao',
      label: 'Consolidação',
      href: '/consolidacao',
      icon: HeartHandshake,
      cores: ['#FB923C', '#C2410C'],
    })
  }

  if (podeVer('supervisor')) {
    lista.push({
      id: 'supervisao',
      label: 'Supervisão',
      href: '/supervisor',
      icon: Shield,
      cores: ['#2DD4BF', '#0F766E'],
    })
  }

  if (podeVer('pastor')) {
    lista.push({
      id: 'administracao',
      label: 'Administração',
      href: '/pastor',
      icon: ChurchIcon,
      cores: ['#64748B', '#0F172A'],
    })
    lista.push({
      id: 'membros',
      label: 'Membros',
      href: '/usuarios',
      icon: UserCog,
      cores: ['#818CF8', '#4338CA'],
    })
  }

  return lista
}
