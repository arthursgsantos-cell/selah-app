import { redirect } from 'next/navigation'

/**
 * Formulários viraram uma aba de Eventos — é lá que eles são usados, e manter
 * uma página solta obrigava a decorar o caminho.
 *
 * A rota continua existindo porque ela já foi compartilhada e está no
 * histórico de quem usa o app; em vez de dar 404, leva à aba certa.
 */
export default function FormulariosPage() {
  redirect('/eventos?aba=formularios')
}
