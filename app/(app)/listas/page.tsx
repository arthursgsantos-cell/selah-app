import { redirect } from 'next/navigation'

/**
 * As listas dinâmicas viraram aba de Membros: filtrar quem é da igreja e falar
 * com essas pessoas é a mesma tarefa vista de dois ângulos, e manter duas
 * telas obrigava a escolher por qual começar.
 *
 * A rota fica de pé porque já circulou por aí; em vez de dar 404, leva à aba.
 */
export default function ListasPage() {
  redirect('/usuarios?aba=listas')
}
