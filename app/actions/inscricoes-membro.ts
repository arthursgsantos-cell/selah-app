'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarInscricao } from '@/lib/inscricao-pessoal'
import type { InscricaoResumo } from '@/components/perfil/minhas-inscricoes'

/**
 * Inscrições da pessoa logada, para a lista no perfil.
 *
 * Varre os eventos que têm planilha de acompanhamento e procura a pessoa em
 * cada uma. É uma leitura por evento, mas as planilhas ficam em cache de 5
 * minutos e a igreja tem poucos eventos com inscrição paga por vez — o teto
 * abaixo evita que isso cresça sem limite.
 */
const MAXIMO_EVENTOS = 12

/** Eventos que já passaram continuam listados por um tempo: o pagamento pode
 *  seguir em aberto depois do evento. */
const DIAS_APOS_EVENTO = 60

export async function minhasInscricoesAction(): Promise<InscricaoResumo[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: perfil } = await supabase
    .from('profiles')
    .select('email, telefone')
    .eq('id', user.id)
    .single()

  const identidade = {
    email: (perfil as { email?: string | null } | null)?.email ?? user.email ?? null,
    telefone: (perfil as { telefone?: string | null } | null)?.telefone ?? null,
  }
  if (!identidade.email && !identidade.telefone) return []

  const desde = new Date()
  desde.setDate(desde.getDate() - DIAS_APOS_EVENTO)

  const admin = createAdminClient()
  const { data: eventosData } = await admin
    .from('eventos')
    .select('id, slug, titulo, data_hora, imagem_url, capa_pagina_url, inscricoes_planilha_url')
    .not('inscricoes_planilha_url', 'is', null)
    .gte('data_hora', desde.toISOString())
    .order('data_hora', { ascending: true })
    .limit(MAXIMO_EVENTOS)

  const eventos = (eventosData ?? []) as unknown as {
    id: string; slug: string | null; titulo: string; data_hora: string
    imagem_url: string | null; capa_pagina_url: string | null
    inscricoes_planilha_url: string
  }[]

  const resultados = await Promise.all(
    eventos.map(async (e) => {
      const inscricao = await buscarInscricao(e.inscricoes_planilha_url, identidade)
      if (!inscricao) return null
      return {
        eventoId: e.id,
        slug: e.slug,
        titulo: e.titulo,
        dataHora: e.data_hora,
        capa: e.capa_pagina_url ?? e.imagem_url,
        statusPagamento: inscricao.statusPagamento,
        saldo: inscricao.saldo,
      } satisfies InscricaoResumo
    })
  )

  return resultados.filter((r): r is InscricaoResumo => r !== null)
}
