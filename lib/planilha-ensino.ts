import { createAdminClient } from '@/lib/supabase/admin'
import { encontrosTexto, periodoTexto, STATUS_TURMA } from '@/lib/ensino/turma'
import type { ModoTurma, StatusTurma, TipoInscricaoTurma } from '@/lib/supabase/types'

/**
 * Espelha as turmas do Ensino na aba "Ensino" da planilha de controle da IBZS.
 *
 * É registro secundário: o Supabase continua sendo a fonte da verdade. Por isso
 * nada aqui pode derrubar a gravação da turma — falha de rede, planilha fora do
 * ar ou script mal publicado viram log no servidor, não erro na tela.
 *
 * A entrega vai no `await` de propósito. Promise solta em server action morre
 * junto com a resposta, e a linha simplesmente não chegaria na planilha.
 */

export type AcaoTurma = 'criada' | 'editada' | 'excluida'

export interface LinhaTurmaPlanilha {
  id: string
  curso: string
  turma: string
  professores: string
  periodo: string
  encontros: string
  local: string
  modo: string
  status: string
  vagas: string
  inscritos: number
  inscricoes: string
  /** O mesmo endereço que o botão de compartilhar da turma copia. */
  link: string
}

const MODO: Record<ModoTurma, string> = {
  presencial: 'Presencial',
  gravado: 'Gravado',
}

const TIPO_INSCRICAO: Record<TipoInscricaoTurma, string> = {
  app: 'pelo app',
  formulario: 'por formulário',
  link: 'por link externo',
  whatsapp: 'pelo WhatsApp',
}

/**
 * O domínio público do app, para o link de compartilhamento sair clicável.
 * Sem `NEXT_PUBLIC_SITE_URL` a Vercel ainda entrega o domínio de produção.
 */
function urlBase(): string {
  const explicito = process.env.NEXT_PUBLIC_SITE_URL
  if (explicito) return explicito.replace(/\/+$/, '')

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return vercel ? `https://${vercel}` : 'http://localhost:3000'
}

/**
 * Monta a linha da planilha a partir da turma no banco.
 *
 * Na exclusão precisa ser chamada **antes** do delete — depois não há mais o
 * que ler, e a planilha ficaria sem saber qual turma saiu.
 */
export async function lerTurmaParaPlanilha(
  turmaId: string
): Promise<LinhaTurmaPlanilha | null> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('ensino_turmas')
    .select(
      'id, slug, nome, local, data_inicio, data_fim, dias_semana, horario_inicio, horario_fim, vagas, inscricoes_abertas, tipo_inscricao, status, modo, ensino_cursos(nome)'
    )
    .eq('id', turmaId)
    .maybeSingle()

  if (!data) return null

  const turma = data as unknown as {
    id: string
    slug: string | null
    nome: string
    local: string | null
    data_inicio: string | null
    data_fim: string | null
    dias_semana: number[] | null
    horario_inicio: string | null
    horario_fim: string | null
    vagas: number | null
    inscricoes_abertas: boolean
    tipo_inscricao: TipoInscricaoTurma
    status: StatusTurma
    modo: ModoTurma
    ensino_cursos: { nome: string } | null
  }

  const [professoresRes, inscritosRes] = await Promise.all([
    admin
      .from('ensino_turma_professores')
      .select('principal, profiles(nome), membros_pre_cadastro(nome)')
      .eq('turma_id', turma.id)
      .order('principal', { ascending: false }),
    admin
      .from('ensino_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', turma.id)
      .in('status', ['aprovada', 'concluida']),
  ])

  const professores = ((professoresRes.data ?? []) as unknown as {
    profiles: { nome: string } | null
    membros_pre_cadastro: { nome: string } | null
  }[])
    .map((l) => l.profiles?.nome ?? l.membros_pre_cadastro?.nome)
    .filter((n): n is string => Boolean(n))

  return {
    id: turma.id,
    curso: turma.ensino_cursos?.nome ?? '',
    turma: turma.nome,
    professores: professores.join(', '),
    periodo: periodoTexto(turma.data_inicio, turma.data_fim),
    encontros: encontrosTexto(turma.dias_semana, turma.horario_inicio, turma.horario_fim),
    local: turma.local ?? '',
    modo: MODO[turma.modo] ?? turma.modo,
    status: STATUS_TURMA[turma.status]?.label ?? turma.status,
    vagas: turma.vagas === null ? 'sem limite' : String(turma.vagas),
    inscritos: inscritosRes.count ?? 0,
    inscricoes: turma.inscricoes_abertas
      ? `abertas (${TIPO_INSCRICAO[turma.tipo_inscricao] ?? turma.tipo_inscricao})`
      : 'fechadas',
    link: `${urlBase()}/ensino/turma/${turma.slug ?? turma.id}`,
  }
}

/**
 * Manda a linha para o Web App do Apps Script publicado na planilha.
 *
 * Sem `ENSINO_SHEET_WEBHOOK_URL` configurada a função não faz nada — é assim
 * que o app roda em desenvolvimento sem sujar a planilha de verdade.
 */
export async function registrarNaPlanilha(
  linha: LinhaTurmaPlanilha | null,
  acao: AcaoTurma,
  quem: string
): Promise<void> {
  const url = process.env.ENSINO_SHEET_WEBHOOK_URL
  if (!url || !linha) return

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segredo: process.env.ENSINO_SHEET_SECRET ?? '',
        acao,
        quem,
        turma: linha,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`[planilha-ensino] a planilha recusou (HTTP ${res.status}).`)
    }
  } catch (erro) {
    console.error('[planilha-ensino] não consegui registrar a turma:', erro)
  }
}
