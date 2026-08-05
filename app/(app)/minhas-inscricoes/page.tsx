import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Ticket, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarInscricao } from '@/lib/inscricao-pessoal'
import { MinhasInscricoes, type InscricaoResumo } from '@/components/perfil/minhas-inscricoes'
import { PAINEL } from '@/lib/estilos'
import { STATUS_INSCRICAO, encontrosTexto } from '@/lib/ensino/turma'
import type { StatusInscricaoEnsino } from '@/lib/supabase/types'

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

  // Cursos do Ensino. Vêm pelo cliente do usuário, então a RLS já garante que
  // são só os dele — canceladas ficam de fora, que é o mesmo critério dos
  // eventos: a página é sobre o que está em aberto.
  const { data: cursosData } = await supabase
    .from('ensino_inscricoes')
    .select('id, status, turma_id, ensino_turmas(nome, capa_url, dias_semana, horario_inicio, horario_fim, ensino_cursos(nome))')
    .eq('user_id', user.id)
    .neq('status', 'cancelada')
    .order('criado_em', { ascending: false })

  const cursos = ((cursosData ?? []) as unknown as {
    id: string
    status: StatusInscricaoEnsino
    turma_id: string
    ensino_turmas: {
      nome: string; capa_url: string | null; dias_semana: number[]
      horario_inicio: string | null; horario_fim: string | null
      ensino_cursos: { nome: string } | null
    } | null
  }[]).filter((c) => c.ensino_turmas !== null)

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
          Seus eventos e cursos, com pagamentos e detalhes
        </p>
      </div>

      {/* Eventos */}
      {inscricoes.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Eventos
          </p>
          <MinhasInscricoes inscricoes={inscricoes} />
        </section>
      )}

      {/* Cursos do Ensino */}
      {cursos.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Cursos
          </p>
          <div className="divide-y overflow-hidden rounded-2xl border border-border">
            {cursos.map((c) => {
              const t = c.ensino_turmas!
              const encontros = encontrosTexto(t.dias_semana, t.horario_inicio, t.horario_fim)
              const selo = STATUS_INSCRICAO[c.status]
              return (
                <Link
                  key={c.id}
                  href={`/ensino/turma/${c.turma_id}`}
                  className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent"
                >
                  {t.capa_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.capa_url}
                      alt={t.nome}
                      className="aspect-[3/4] w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0B2447] to-[#0F52BA]">
                      <GraduationCap className="h-5 w-5 text-white/80" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-bold uppercase tracking-widest text-primary">
                      {t.ensino_cursos?.nome}
                    </p>
                    <p className="truncate text-sm font-medium leading-tight">{t.nome}</p>
                    {encontros && (
                      <p className="truncate text-xs text-muted-foreground">{encontros}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${selo.classe}`}
                  >
                    {selo.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {inscricoes.length === 0 && cursos.length === 0 && (
        <div className={`${PAINEL} text-center`}>
          <Ticket className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">Nenhuma inscrição encontrada</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nos eventos, procuramos pelo e-mail e telefone do seu perfil. Se você se inscreveu com
            outro e-mail, atualize seu perfil e volte aqui.
          </p>
          <div className="mt-3 flex justify-center gap-3 text-xs font-semibold">
            <Link href="/perfil" className="text-primary hover:underline">
              Conferir meu perfil
            </Link>
            <Link href="/ensino" className="text-primary hover:underline">
              Ver cursos abertos
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
