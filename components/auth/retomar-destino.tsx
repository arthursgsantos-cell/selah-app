'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { consumirDestino } from '@/lib/destino-login'

/**
 * Rede de segurança do login por Google.
 *
 * O caminho normal é o servidor devolver a pessoa direto ao destino: o
 * `?next=` viaja no `redirectTo` do OAuth e o callback o honra. Mas essa query
 * só sobrevive se a URL inteira casar com a lista de redirects do Supabase —
 * quando não casa, o Supabase manda para a Site URL e a pessoa aterrissa na
 * home sem nenhum vestígio do que tinha pedido.
 *
 * Aqui o destino é recuperado do `sessionStorage`, que atravessou a ida ao
 * Google intacto.
 *
 * Só age na home, que é justamente onde a pessoa cai quando o parâmetro se
 * perde. Em qualquer outra página o destino ficou onde deveria e não há nada a
 * corrigir.
 */
export function RetomarDestino() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/home') return
    const destino = consumirDestino()
    if (destino && destino !== '/home') router.replace(destino)
  }, [pathname, router])

  return null
}
