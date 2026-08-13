'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Plus, Repeat, Route, Trash2, CalendarRange } from 'lucide-react'
import {
  montarCronograma, rotuloTrecho, trechoDoLivro, type LivroBiblia,
} from '@/lib/ensino/leitura'
import { hojeIso } from '@/lib/ensino/atividades'
import type { ConfigLeitura, TrechoLeitura } from '@/lib/supabase/types'

interface Props {
  livros: LivroBiblia[]
  config: ConfigLeitura
  prazo: string | null
  abreEm: string | null
  onChange: (config: ConfigLeitura) => void
}

/** Atalhos que cobrem quase todo desafio que se pede numa turma. */
const ATALHOS: { rotulo: string; primeiro: number; ultimo: number }[] = [
  { rotulo: 'Novo Testamento', primeiro: 40, ultimo: 66 },
  { rotulo: 'Evangelhos', primeiro: 40, ultimo: 43 },
  { rotulo: 'Pentateuco', primeiro: 1, ultimo: 5 },
  { rotulo: 'Bíblia inteira', primeiro: 1, ultimo: 66 },
]

/**
 * O montador do desafio de leitura.
 *
 * A prévia do cronograma é o ponto todo desta tela: "30 vezes Tiago" não diz
 * nada até virar "5 capítulos por dia durante 30 dias", e é aí que o professor
 * percebe que pediu demais — ou de menos. Por isso a conta roda no cliente, a
 * cada tecla, com a mesma função que o servidor usa ao publicar.
 */
export function LeituraConfig({ livros, config, prazo, abreEm, onChange }: Props) {
  const [livroNovo, setLivroNovo] = useState<number>(59)

  const previa = useMemo(
    () => montarCronograma(livros, config, abreEm ?? hojeIso(), prazo),
    [livros, config, prazo, abreEm]
  )

  function adicionar(trecho: TrechoLeitura) {
    // Sem repetidos: o mesmo livro duas vezes na lista é quase sempre engano,
    // e quem quer ler duas vezes usa o modo de repetições.
    if (config.trechos.some((t) => t.livroId === trecho.livroId)) return
    onChange({ ...config, trechos: [...config.trechos, trecho] })
  }

  function adicionarFaixa(primeiro: number, ultimo: number) {
    const novos = livros
      .filter((l) => l.id >= primeiro && l.id <= ultimo)
      .filter((l) => !config.trechos.some((t) => t.livroId === l.id))
      .map(trechoDoLivro)
    onChange({ ...config, trechos: [...config.trechos, ...novos] })
  }

  function atualizar(indice: number, campo: 'capituloInicio' | 'capituloFim', valor: number) {
    onChange({
      ...config,
      trechos: config.trechos.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)),
    })
  }

  function remover(indice: number) {
    onChange({ ...config, trechos: config.trechos.filter((_, i) => i !== indice) })
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">O desafio</h2>
      </div>

      {/* Modo */}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange({ ...config, modo: 'percurso', repeticoes: 1 })}
          className={`rounded-xl border p-3 text-left transition-colors ${
            config.modo === 'percurso' ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
          }`}
        >
          <Route className={`h-4 w-4 ${config.modo === 'percurso' ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className="mt-1.5 text-xs font-semibold">Percurso</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Atravessar os livros uma vez até o prazo.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange({ ...config, modo: 'repeticoes', repeticoes: Math.max(2, config.repeticoes) })}
          className={`rounded-xl border p-3 text-left transition-colors ${
            config.modo === 'repeticoes' ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
          }`}
        >
          <Repeat className={`h-4 w-4 ${config.modo === 'repeticoes' ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className="mt-1.5 text-xs font-semibold">Repetições</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Ler o mesmo trecho N vezes até o prazo.
          </p>
        </button>
      </div>

      {config.modo === 'repeticoes' && (
        <div className="flex items-center gap-2">
          <label htmlFor="repeticoes" className="text-xs font-medium text-muted-foreground">
            Quantas vezes
          </label>
          <input
            id="repeticoes"
            type="number"
            min={1}
            max={365}
            value={config.repeticoes}
            onChange={(e) =>
              onChange({ ...config, repeticoes: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })
            }
            className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
          />
        </div>
      )}

      {/* Trechos escolhidos */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          O que ler
        </p>

        {config.trechos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            Nenhum trecho ainda. Escolha abaixo.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {config.trechos.map((trecho, i) => {
              const livro = livros.find((l) => l.id === trecho.livroId)
              return (
                <li
                  key={`${trecho.livroId}-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-2.5 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {rotuloTrecho(livros, trecho)}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    cap.
                    <input
                      type="number"
                      min={1}
                      max={livro?.capitulos ?? 150}
                      value={trecho.capituloInicio}
                      onChange={(e) => atualizar(i, 'capituloInicio', Number(e.target.value) || 1)}
                      aria-label={`Capítulo inicial de ${livro?.nome ?? ''}`}
                      className="h-7 w-14 rounded-md border border-input bg-background px-1 text-center text-xs outline-none focus-visible:border-ring"
                    />
                    a
                    <input
                      type="number"
                      min={1}
                      max={livro?.capitulos ?? 150}
                      value={trecho.capituloFim}
                      onChange={(e) => atualizar(i, 'capituloFim', Number(e.target.value) || 1)}
                      aria-label={`Capítulo final de ${livro?.nome ?? ''}`}
                      className="h-7 w-14 rounded-md border border-input bg-background px-1 text-center text-xs outline-none focus-visible:border-ring"
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => remover(i)}
                    aria-label={`Remover ${livro?.nome ?? 'trecho'}`}
                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={livroNovo}
            onChange={(e) => setLivroNovo(Number(e.target.value))}
            aria-label="Livro a acrescentar"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring sm:flex-none sm:w-52"
          >
            <optgroup label="Antigo Testamento">
              {livros.filter((l) => l.testamento === 'AT').map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </optgroup>
            <optgroup label="Novo Testamento">
              {livros.filter((l) => l.testamento === 'NT').map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            onClick={() => {
              const livro = livros.find((l) => l.id === livroNovo)
              if (livro) adicionar(trechoDoLivro(livro))
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Acrescentar
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ATALHOS.map((a) => (
            <button
              key={a.rotulo}
              type="button"
              onClick={() => adicionarFaixa(a.primeiro, a.ultimo)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              + {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* A prévia — o que faz esta tela valer a pena. */}
      {previa.total > 0 && (
        <div className="rounded-xl bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <CalendarRange className="h-3.5 w-3.5" />
            Como vai ficar
          </p>
          <p className="mt-1.5 text-sm leading-snug">
            <strong>{previa.total}</strong> {previa.total === 1 ? 'capítulo' : 'capítulos'} no total
            {config.modo === 'repeticoes' && (
              <> ({previa.porVolta} por volta × {config.repeticoes})</>
            )}
            {prazo ? (
              <>
                , em <strong>{previa.dias}</strong> {previa.dias === 1 ? 'dia' : 'dias'} —{' '}
                <strong>
                  {previa.capitulosPorDia} {previa.capitulosPorDia === 1 ? 'capítulo' : 'capítulos'} por dia
                </strong>
                .
              </>
            ) : (
              <>. Defina um prazo para o app distribuir por dia.</>
            )}
          </p>
          {previa.itens.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Começa em {previa.itens[0].rotulo}
              {previa.itens.at(-1) && ` e termina em ${previa.itens.at(-1)!.rotulo}`}.{' '}
              {previa.itens.length} {previa.itens.length === 1 ? 'linha' : 'linhas'} para marcar.
            </p>
          )}
          {prazo && previa.capitulosPorDia > 8 && (
            <p className="mt-1.5 text-[11px] font-medium text-amber-700">
              São mais de 8 capítulos por dia. Vale conferir se o prazo é realista.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
