'use client'

import { useMemo, useState } from 'react'
import { Search, X, GraduationCap } from 'lucide-react'
import { TurmaCard, type TurmaResumo } from '@/components/ensino/turma-card'
import { vagasRestantes } from '@/lib/ensino/turma'
import type { StatusInscricaoEnsino } from '@/lib/supabase/types'

type Filtro = 'todas' | 'inscricao' | 'andamento' | 'encerradas' | 'minhas'

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'todas',      label: 'Todas' },
  { valor: 'inscricao',  label: 'Inscrições abertas' },
  { valor: 'andamento',  label: 'Em andamento' },
  { valor: 'encerradas', label: 'Encerradas' },
  { valor: 'minhas',     label: 'Minhas' },
]

/** Sem acento e em minúsculas, para "biblico" encontrar "Bíblico". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Encerrada desce dentro do próprio curso: a vitrine é de quem ainda recebe aluno. */
const PESO: Record<TurmaResumo['status'], number> = {
  aberta: 0,
  em_andamento: 1,
  concluida: 2,
  cancelada: 3,
}

/**
 * A listagem de turmas do Ensino.
 *
 * Era uma lista corrida de cartões, e com três edições do mesmo curso no ar a
 * pessoa precisava ler o selo de cada um para achar o seu. Agrupar por curso
 * responde primeiro "que cursos a igreja oferece" e só depois "quais turmas
 * deste"; a busca e os filtros atalham quando a resposta já é conhecida.
 */
export function TurmasExplorador({
  turmas,
  minhas,
}: {
  turmas: TurmaResumo[]
  /** Status da minha inscrição em cada turma, para o selo e o filtro "Minhas". */
  minhas: Record<string, StatusInscricaoEnsino>
}) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const termo = normalizar(busca.trim())

  const visiveis = useMemo(() => {
    return turmas.filter((t) => {
      if (filtro === 'inscricao') {
        // O mesmo critério do botão de inscrição na página da turma: aceitar
        // pedidos, não ter encerrado e ainda ter vaga.
        const restantes = vagasRestantes(t.vagas, t.aprovados)
        const cabe = restantes === null || restantes > 0
        if (!t.inscricoesAbertas || !cabe) return false
        if (t.status === 'concluida' || t.status === 'cancelada') return false
      }
      if (filtro === 'andamento' && t.status !== 'em_andamento') return false
      if (filtro === 'encerradas' && t.status !== 'concluida' && t.status !== 'cancelada') {
        return false
      }
      if (filtro === 'minhas' && !minhas[t.id]) return false

      if (!termo) return true
      const alvo = normalizar(
        [t.nome, t.cursoNome, t.local ?? '', ...t.professores].join(' ')
      )
      return alvo.includes(termo)
    })
  }, [turmas, minhas, filtro, termo])

  // Cursos na ordem alfabética; dentro de cada um, as que ainda recebem aluno
  // primeiro. A ordem de chegada (mais recentes antes) sobrevive ao empate
  // porque `sort` é estável.
  const grupos = useMemo(() => {
    const mapa = new Map<string, { nome: string; turmas: TurmaResumo[] }>()
    for (const t of visiveis) {
      const grupo = mapa.get(t.cursoId) ?? { nome: t.cursoNome, turmas: [] }
      grupo.turmas.push(t)
      mapa.set(t.cursoId, grupo)
    }
    return [...mapa.values()]
      .map((g) => ({ ...g, turmas: [...g.turmas].sort((a, b) => PESO[a.status] - PESO[b.status]) }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [visiveis])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por turma, curso, professor ou sala"
          aria-label="Buscar turmas"
          className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            aria-pressed={filtro === f.valor}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filtro === f.valor
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <GraduationCap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma turma encontrada</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {termo || filtro !== 'todas'
              ? 'Tente outro termo ou volte para "Todas".'
              : 'Quando a Escola Bíblica abrir uma turma, ela aparece aqui.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <section key={grupo.nome} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold leading-tight">{grupo.nome}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {grupo.turmas.length}
                  {grupo.turmas.length === 1 ? ' turma' : ' turmas'}
                </span>
              </div>
              <div className="space-y-3">
                {grupo.turmas.map((turma) => (
                  <div
                    key={turma.id}
                    className={
                      turma.status === 'concluida' || turma.status === 'cancelada'
                        ? 'opacity-60'
                        : undefined
                    }
                  >
                    <TurmaCard turma={turma} minhaInscricao={minhas[turma.id] ?? null} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
