import { Video, ExternalLink } from 'lucide-react'
import { plataformaDaChamada } from '@/lib/ensino/videochamada'

/**
 * "Entrar na videochamada" — numa turma que se reúne online, é o que faz as
 * vezes do endereço da sala.
 *
 * Duas formas porque são dois pesos: na página da aula o botão é a ação
 * principal de quem chegou na hora do encontro; na ficha da turma é mais um
 * dado, ao lado do local e do horário.
 */
export function BotaoVideoChamada({
  url,
  forma = 'botao',
}: {
  url: string
  forma?: 'botao' | 'linha'
}) {
  const plataforma = plataformaDaChamada(url)

  if (forma === 'linha') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <Video className="h-4 w-4 shrink-0" />
        Entrar pelo {plataforma}
        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
    >
      <Video className="h-4 w-4" />
      Entrar na videochamada
      <span className="font-normal opacity-75">· {plataforma}</span>
    </a>
  )
}
