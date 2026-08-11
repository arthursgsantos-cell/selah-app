'use client'

import { useMemo, useState, useTransition } from 'react'
import { Copy, Loader2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  carregarTurmaModeloAction, type TurmaModelo,
} from '@/app/actions/ensino/copiar-turma'
import { ITENS_COPIA, COPIA_PADRAO, type OpcoesCopia } from '@/lib/ensino/copia'

export interface TurmaModeloResumo {
  id: string
  nome: string
  cursoNome: string
}

const campoClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

/**
 * Herdar a turma anterior ao abrir uma nova.
 *
 * A escolha é em duas etapas de propósito: primeiro a turma, depois o que dela
 * vem junto. Marcar item por item é o que separa "abrir a segunda edição do
 * mesmo curso" de "abrir um curso parecido com outro" — e as datas nunca estão
 * na lista, porque turma nova tem calendário novo.
 */
export function CopiarTurma({
  modelos,
  aplicado,
  onAplicar,
  onLimpar,
}: {
  modelos: TurmaModeloResumo[]
  /** O que já foi trazido, para a seção virar recibo depois de aplicada. */
  aplicado: { nome: string; opcoes: OpcoesCopia } | null
  onAplicar: (modelo: TurmaModelo, opcoes: OpcoesCopia) => void
  onLimpar: () => void
}) {
  const [turmaId, setTurmaId] = useState('')
  const [modelo, setModelo] = useState<TurmaModelo | null>(null)
  const [opcoes, setOpcoes] = useState<OpcoesCopia>(COPIA_PADRAO)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, startCarregar] = useTransition()

  // Agrupadas por curso: a turma que se quer copiar é quase sempre a edição
  // anterior do mesmo curso, e procurá-la numa lista corrida de nomes de turma
  // ("2026.1", "Turma B") não diz de qual curso cada uma é.
  const porCurso = useMemo(() => {
    const grupos = new Map<string, TurmaModeloResumo[]>()
    for (const m of modelos) {
      const lista = grupos.get(m.cursoNome) ?? []
      lista.push(m)
      grupos.set(m.cursoNome, lista)
    }
    return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [modelos])

  function escolher(id: string) {
    setTurmaId(id)
    setModelo(null)
    setErro(null)
    if (!id) return

    startCarregar(async () => {
      const r = await carregarTurmaModeloAction(id)
      if (!r.ok) { setErro(r.erro); return }
      setModelo(r.turma)
    })
  }

  function alternar(chave: keyof OpcoesCopia) {
    setOpcoes((atual) => ({ ...atual, [chave]: !atual[chave] }))
  }

  function aplicar() {
    if (!modelo) return
    onAplicar(modelo, opcoes)
    setTurmaId('')
    setModelo(null)
    setOpcoes(COPIA_PADRAO)
  }

  const nenhumMarcado = ITENS_COPIA.every((i) => !opcoes[i.chave])

  if (aplicado) {
    const trazidos = ITENS_COPIA.filter((i) => aplicado.opcoes[i.chave])
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
        <div className="flex items-start gap-2.5">
          <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">
              Copiando de <span className="text-primary">{aplicado.nome}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {trazidos.length > 0
                ? trazidos.map((i) => i.label.toLowerCase()).join(', ')
                : 'nenhum item marcado'}
              . As datas não vêm junto — o calendário é o que você definir aqui.
            </p>
          </div>
          <button
            type="button"
            onClick={onLimpar}
            aria-label="Cancelar a cópia"
            className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="turma-modelo" className="text-sm font-medium">
          Turma anterior
        </label>
        <select
          id="turma-modelo"
          value={turmaId}
          onChange={(e) => escolher(e.target.value)}
          className={campoClass}
        >
          <option value="">Começar do zero</option>
          {porCurso.map(([curso, turmas]) => (
            <optgroup key={curso} label={curso}>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {carregando && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Abrindo a turma...
        </p>
      )}

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {modelo && (
        <>
          <div className="rounded-xl border border-border divide-y overflow-hidden">
            {ITENS_COPIA.map((item) => {
              const campoId = `copiar-${item.chave}`
              const vazio =
                (item.chave === 'aulas' && modelo.totalDeAulas === 0) ||
                (item.chave === 'materiais' && modelo.totalDeMateriais === 0) ||
                (item.chave === 'professores' && modelo.professores.length === 0)

              return (
                <label
                  key={item.chave}
                  htmlFor={campoId}
                  className={`flex items-start gap-3 px-3 py-2.5 ${
                    vazio ? 'opacity-50' : 'cursor-pointer hover:bg-accent/40'
                  }`}
                >
                  <input
                    id={campoId}
                    type="checkbox"
                    checked={opcoes[item.chave] && !vazio}
                    disabled={vazio}
                    onChange={() => alternar(item.chave)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight">
                      {item.label}
                      {item.chave === 'aulas' && modelo.totalDeAulas > 0 && (
                        <span className="text-muted-foreground font-normal">
                          {' '}· {modelo.totalDeAulas}
                        </span>
                      )}
                      {item.chave === 'materiais' && modelo.totalDeMateriais > 0 && (
                        <span className="text-muted-foreground font-normal">
                          {' '}· {modelo.totalDeMateriais}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground leading-snug">
                      {vazio ? 'a turma anterior não tem' : item.ajuda}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={aplicar} disabled={nenhumMarcado}>
              <Copy className="h-4 w-4" />
              Trazer para esta turma
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => escolher('')}>
              Cancelar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Alunos, inscrições e presenças nunca vêm — são de quem cursou a turma
            anterior. Aulas e materiais só são copiados quando você salvar a turma
            nova.
          </p>
        </>
      )}
    </div>
  )
}
