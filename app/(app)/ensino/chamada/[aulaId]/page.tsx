import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { listaDaChamada } from '@/app/actions/ensino/presenca'
import { ChamadaLista } from '@/components/ensino/chamada-lista'
import { dataBr } from '@/lib/ensino/turma'
import { nomeDoDia } from '@/lib/dia-semana'

export const metadata = { title: 'Chamada · Ensino IBZS' }

/**
 * A chamada é uma página, não um modal.
 *
 * O pedido foi explícito: um diálogo que fecha ao clicar fora perde a chamada
 * pela metade. Aqui a URL é própria, dá para recarregar, voltar e até deixar
 * aberta no celular durante a aula inteira.
 */
export default async function ChamadaPage({ params }: { params: { aulaId: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/chamada/${params.aulaId}`))

  const admin = createAdminClient()

  const { data: aulaRaw } = await admin
    .from('ensino_aulas')
    .select('id, turma_id, numero, titulo, data, hora_inicio, local, ensino_turmas(nome, ensino_cursos(nome))')
    .eq('id', params.aulaId)
    .maybeSingle()

  if (!aulaRaw) notFound()

  const aula = aulaRaw as unknown as {
    id: string; turma_id: string; numero: number; titulo: string | null
    data: string; hora_inicio: string | null; local: string | null
    ensino_turmas: { nome: string; ensino_cursos: { nome: string } | null } | null
  }

  if (!(await podeLecionar(acesso, aula.turma_id))) {
    redirect(`/ensino/turma/${aula.turma_id}`)
  }

  const [linhas, vizinhasRes] = await Promise.all([
    listaDaChamada(aula.id),
    admin
      .from('ensino_aulas')
      .select('id, numero')
      .eq('turma_id', aula.turma_id)
      .order('numero'),
  ])

  const vizinhas = (vizinhasRes.data ?? []) as { id: string; numero: number }[]
  const indice = vizinhas.findIndex((a) => a.id === aula.id)
  const anterior = indice > 0 ? vizinhas[indice - 1] : null
  const proxima = indice >= 0 && indice < vizinhas.length - 1 ? vizinhas[indice + 1] : null

  // `data` é `date` puro: quebrar em números evita o `new Date('2026-03-10')`
  // que seria interpretado como UTC e mostraria o dia anterior em Natal.
  const [ano, mes, dia] = aula.data.split('-').map(Number)
  const diaSemana = nomeDoDia(new Date(ano, mes - 1, dia).getDay())

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      <Link
        href={`/ensino/turma/${aula.turma_id}/aulas`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Aulas da turma
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <span className="text-[9px] font-bold uppercase leading-none">Aula</span>
          <span className="text-lg font-bold leading-none mt-0.5">{aula.numero}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">
            {aula.titulo ?? `Aula ${aula.numero}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {aula.ensino_turmas?.ensino_cursos?.nome} · {aula.ensino_turmas?.nome}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {diaSemana}, {dataBr(aula.data)}
            {aula.hora_inicio && ` · ${aula.hora_inicio.slice(0, 5)}`}
            {aula.local && ` · ${aula.local}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Chamada
        </p>
        <p className="text-[11px] text-muted-foreground/70 ml-auto">
          Cada toque é salvo na hora
        </p>
      </div>

      <ChamadaLista aulaId={aula.id} inicial={linhas} />

      {/* Navegar entre aulas sem voltar para a lista */}
      {(anterior || proxima) && (
        <div className="flex items-center justify-between gap-2 pt-2">
          {anterior ? (
            <Link
              href={`/ensino/chamada/${anterior.id}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Aula {anterior.numero}
            </Link>
          ) : (
            <span />
          )}
          {proxima && (
            <Link
              href={`/ensino/chamada/${proxima.id}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Aula {proxima.numero}
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
