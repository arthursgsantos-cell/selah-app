import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarInscricao } from '@/lib/inscricao-pessoal'
import { MinhasInscricoes, type InscricaoResumo } from '@/components/perfil/minhas-inscricoes'
import { PAINEL } from '@/lib/estilos'

/**
 * Todas as inscrições da pessoa logada, num lugar só.
 *
 * Página própria (e não uma aba do perfil) porque é o destino do item de menu
 * e do link que a liderança compartilha.
 */

/** Teto de eventos varridos: uma leitura de planilha por evento. */
const MAXIMO_EVENTOS = 12

/** Evento que passou continua listado: o pagamento pode seguir em aberto. */
const DIAS_APOS_EVENTO = 60

export default async function MinhasInscricoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/minhas-inscricoes')

  const { data: perfil } = await supabase
    .from('profiles')
    .select('email, telefone')
    .eq('id', user.id)
    .single()

  const identidade = {
    email: (perfil as { email?: string | null } | null)?.email ?? user.email ?? null,
    telefone: (perfil as { telefone?: string | null } | null)?.telefone ?? null,
  }

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

  const encontradas = await Promise.all(
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

  const inscricoes = encontradas.filter((r): r is InscricaoResumo => r !== null)

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <Link
        href="/home"
        className="-ml-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div>
        <h1 className="text-xl font-bold">Minhas inscrições</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Acompanhe os pagamentos e os detalhes de cada evento
        </p>
      </div>

      {inscricoes.length > 0 ? (
        <MinhasInscricoes inscricoes={inscricoes} />
      ) : (
        <div className={`${PAINEL} text-center`}>
          <Ticket className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">Nenhuma inscrição encontrada</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Procuramos pelo e-mail e telefone do seu perfil. Se você se inscreveu com outro
            e-mail, atualize seu perfil e volte aqui.
          </p>
          <Link
            href="/perfil"
            className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
          >
            Conferir meu perfil
          </Link>
        </div>
      )}
    </div>
  )
}
