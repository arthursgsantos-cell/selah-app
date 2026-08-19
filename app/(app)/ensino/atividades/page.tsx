import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft, ArrowLeft as ArrowLeftIcon, ArrowRight, BookOpen, Check, ClipboardList, FileQuestion, CalendarClock,
  AlertTriangle, Sparkles,
} from 'lucide-react'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { minhasAtividades } from '@/lib/ensino/atividades-consultas'
import { textoPrazo, TIPO_ATIVIDADE } from '@/lib/ensino/atividades'
import type { TipoAtividade } from '@/lib/supabase/types'

export const metadata = { title: 'Minhas atividades · Ensino IBZS' }

const ICONE: Record<TipoAtividade, React.ComponentType<{ className?: string }>> = {
  tarefa: ClipboardList,
  leitura: BookOpen,
  quiz: FileQuestion,
}

/**
 * O que o aluno tem para fazer, de todos os cursos em que está.
 *
 * É a página exclusiva das atividades: as telas de turma respondem "o que este
 * curso pediu", e esta responde "o que eu tenho para fazer" — que é a pergunta
 * de quem abre o app à noite. Por isso junta as turmas e ordena por prazo, com
 * o já entregue no fim.
 */
export default async function MinhasAtividadesPage({ searchParams }: { searchParams: { pagina?: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom('/ensino/atividades'))

  const atividades = await minhasAtividades(acesso.userId)
  const pendentes = atividades.filter((a) => !a.concluida)
  const atrasadas = pendentes.filter((a) => textoPrazo(a.prazo)?.vencido)
  const porPagina = 10
  const paginaAtual = Math.max(1, Number.parseInt(searchParams.pagina ?? '1', 10) || 1)
  const totalPaginas = Math.max(1, Math.ceil(atividades.length / porPagina))
  const pagina = Math.min(paginaAtual, totalPaginas)
  const atividadesDaPagina = atividades.slice((pagina - 1) * porPagina, pagina * porPagina)

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <Link
        href="/ensino"
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ensino
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Minhas atividades</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pendentes.length === 0
              ? 'Tudo em dia por aqui'
              : `${pendentes.length} ${pendentes.length === 1 ? 'pendente' : 'pendentes'}`}
            {atrasadas.length > 0 && ` · ${atrasadas.length} em atraso`}
          </p>
        </div>
      </div>

      {atividades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma atividade por enquanto.</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground/70">
            Quando um professor publicar uma tarefa, um desafio de leitura ou uma
            prova, ela aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {atividadesDaPagina.map((a) => {
            const prazo = textoPrazo(a.prazo)
            const Icone = ICONE[a.tipo]
            const meta = TIPO_ATIVIDADE[a.tipo]
            const emLeitura = a.tipo === 'leitura' && a.leituraTotal > 0
            const percentual = emLeitura
              ? Math.round((a.leituraFeitos / a.leituraTotal) * 100)
              : null

            return (
              <Link
                key={a.id}
                href={`/ensino/atividade/${a.id}`}
                className={`block rounded-2xl border p-3 transition-colors hover:bg-accent ${
                  a.concluida ? 'border-border bg-card/60' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      a.concluida ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {a.concluida ? <Check className="h-4 w-4" /> : <Icone className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {meta.label} · {a.cursoNome}
                    </p>
                    <p
                      className={`truncate text-sm font-semibold leading-tight ${
                        a.concluida ? 'text-muted-foreground' : ''
                      }`}
                    >
                      {a.titulo}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {prazo && !a.concluida && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            prazo.vencido
                              ? 'bg-red-100 text-red-700'
                              : prazo.urgente
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <CalendarClock className="h-2.5 w-2.5" />
                          {prazo.texto}
                        </span>
                      )}
                      {a.concluida && (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                          {a.status === 'corrigida' && a.nota !== null
                            ? `Corrigida · ${a.nota} ${a.nota === 1 ? 'ponto' : 'pontos'}`
                            : a.status === 'entregue'
                              ? 'Entregue'
                              : 'Feito'}
                        </span>
                      )}
                      {a.leituraAtrasados > 0 && !a.concluida && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {a.leituraAtrasados} atrasada{a.leituraAtrasados > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* No desafio de leitura a barra diz mais que qualquer rótulo. */}
                    {emLeitura && !a.concluida && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {a.leituraFeitos}/{a.leituraTotal}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t pt-3">
            <Link
              href={`/ensino/atividades?pagina=${pagina - 1}`}
              aria-disabled={pagina <= 1}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium ${pagina <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-muted'}`}
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" /> Anterior
            </Link>
            <span className="text-xs text-muted-foreground">Página {pagina} de {totalPaginas}</span>
            <Link
              href={`/ensino/atividades?pagina=${pagina + 1}`}
              aria-disabled={pagina >= totalPaginas}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium ${pagina >= totalPaginas ? 'pointer-events-none opacity-40' : 'hover:bg-muted'}`}
            >
              Próxima <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      )}
    </div>
  )
}

