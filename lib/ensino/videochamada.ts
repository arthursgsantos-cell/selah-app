/**
 * O link de "entrar na videochamada" da turma.
 *
 * Turma que se reúne pelo Meet, Zoom ou Teams precisa disso do mesmo jeito que
 * a presencial precisa de sala. São dois arranjos no uso real — uma sala fixa
 * para o curso inteiro, ou um link por encontro —, e é `video_chamada_modo`
 * que diz qual dos dois a turma segue.
 */

import type { ModoVideoChamada } from '@/lib/supabase/types'

export interface TurmaVideoChamada {
  video_chamada_modo: ModoVideoChamada | null
  video_chamada_url: string | null
}

/**
 * O link que vale para uma aula, conforme o modo da turma.
 *
 * A escolha do modo é respeitada nos dois sentidos: turma com sala fixa ignora
 * um link colado na aula (sobra de quando o modo era outro), e turma com link
 * por aula não cai no da turma quando o professor ainda não colou o dela — ali
 * a ausência é justamente o que a tela precisa mostrar.
 */
export function linkDaVideoChamada(
  turma: TurmaVideoChamada | null | undefined,
  aula?: { video_chamada_url: string | null } | null
): string | null {
  if (!turma) return null
  if (turma.video_chamada_modo === 'turma') return turma.video_chamada_url || null
  if (turma.video_chamada_modo === 'aula') return aula?.video_chamada_url || null
  return null
}

/**
 * "Google Meet", "Zoom"… — o nome que aparece no botão.
 *
 * Lido do domínio, sem chamada externa: o que interessa é a pessoa reconhecer
 * para onde vai antes de clicar. Plataforma desconhecida cai no genérico, que
 * continua correto.
 */
export function plataformaDaChamada(url: string | null | undefined): string {
  if (!url) return 'Videochamada'

  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'Videochamada'
  }

  if (host.endsWith('meet.google.com')) return 'Google Meet'
  if (host.endsWith('zoom.us') || host.endsWith('zoom.com')) return 'Zoom'
  if (host.includes('teams.microsoft') || host.endsWith('teams.live.com')) return 'Microsoft Teams'
  if (host.endsWith('meet.jit.si')) return 'Jitsi'
  if (host.endsWith('whereby.com')) return 'Whereby'
  if (host.endsWith('skype.com')) return 'Skype'
  if (host.endsWith('discord.gg') || host.endsWith('discord.com')) return 'Discord'
  if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) return 'YouTube ao vivo'
  return 'Videochamada'
}
