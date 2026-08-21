'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { registrarMultiplicacaoAction } from '@/app/actions/multiplicacao'
import { MAX_FILHAS } from '@/lib/multiplicacao'

const campoClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

export interface CelulaParaMultiplicar {
  id: string
  nome: string
  redeId: string
  redeNome: string
}

interface Props {
  celulas: CelulaParaMultiplicar[]
  /** Abre já com esta célula como mãe — usado a partir da linha da árvore. */
  celulaInicialId?: string
  /** `icone` é o botão discreto que mora dentro da árvore. */
  modo?: 'botao' | 'icone'
  label?: string
}

interface FilhaForm {
  chave: number
  nome: string
  liderNome: string
}

function filhaVazia(): FilhaForm {
  return { chave: Date.now() + Math.random(), nome: '', liderNome: '' }
}

/**
 * Registrar que uma célula multiplicou.
 *
 * O ponto do diálogo é criar as filhas de verdade no banco — com página,
 * calendário e galeria —, e não apenas anotar que a multiplicação aconteceu.
 * Por isso ele pede tão pouco: a data e quantas células nasceram. Nome é
 * opcional de propósito, porque quase nunca existe no dia da multiplicação, e
 * a lista aceita mais de uma filha porque célula grande costuma se dividir em
 * três de uma vez.
 */
export function RegistrarMultiplicacao({
  celulas,
  celulaInicialId,
  modo = 'botao',
  label = 'Registrar multiplicação',
}: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [salvando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [celulaMaeId, setCelulaMaeId] = useState(celulaInicialId ?? celulas[0]?.id ?? '')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [filhas, setFilhas] = useState<FilhaForm[]>([filhaVazia()])

  const mae = celulas.find((c) => c.id === celulaMaeId)

  // As redes só viram grupos quando há mais de uma para escolher.
  const redes = [...new Map(celulas.map((c) => [c.redeId, c.redeNome])).entries()]

  function fechar() {
    setAberto(false)
    setErro(null)
    setFilhas([filhaVazia()])
    setData(new Date().toISOString().slice(0, 10))
    setCelulaMaeId(celulaInicialId ?? celulas[0]?.id ?? '')
  }

  function atualizar(chave: number, campo: 'nome' | 'liderNome', valor: string) {
    setFilhas((atual) => atual.map((f) => (f.chave === chave ? { ...f, [campo]: valor } : f)))
  }

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await registrarMultiplicacaoAction({
        celulaMaeId,
        data,
        filhas: filhas.map((f) => ({ nome: f.nome, liderNome: f.liderNome })),
      })
      if (!r.ok) { setErro(r.erro ?? 'Não deu para registrar.'); return }
      fechar()
      router.refresh()
    })
  }

  const semNome = filhas.filter((f) => f.nome.trim().length === 0).length

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
      {modo === 'icone' ? (
        <DialogTrigger
          render={
            <button
              type="button"
              aria-label={`Registrar multiplicação${mae ? ` da ${mae.nome}` : ''}`}
              title="Registrar multiplicação"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            />
          }
        >
          <GitBranch className="h-4 w-4" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
          <GitBranch className="h-4 w-4" />
          {label}
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar multiplicação</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mult-mae">Célula que multiplicou</Label>
              <select
                id="mult-mae"
                value={celulaMaeId}
                onChange={(e) => setCelulaMaeId(e.target.value)}
                className={campoClass}
              >
                {redes.length > 1
                  ? redes.map(([redeId, redeNome]) => (
                      <optgroup key={redeId} label={redeNome || 'Sem rede'}>
                        {celulas
                          .filter((c) => c.redeId === redeId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                      </optgroup>
                    ))
                  : celulas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mult-data">Quando</Label>
              <input
                id="mult-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={campoClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Células que nasceram</Label>
              <span className="text-xs text-muted-foreground">
                {filhas.length} de {MAX_FILHAS}
              </span>
            </div>

            <div className="space-y-2">
              {filhas.map((f, i) => (
                <div key={f.chave} className="rounded-xl border border-border p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {filhas.length === 1 ? 'Nova célula' : `Nova célula ${i + 1}`}
                    </span>
                    {filhas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFilhas((atual) => atual.filter((x) => x.chave !== f.chave))}
                        aria-label="Remover esta célula"
                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={f.nome}
                      onChange={(e) => atualizar(f.chave, 'nome', e.target.value)}
                      placeholder="Nome (opcional)"
                      className={campoClass}
                    />
                    <input
                      value={f.liderNome}
                      onChange={(e) => atualizar(f.chave, 'liderNome', e.target.value)}
                      placeholder="Quem lidera (opcional)"
                      className={campoClass}
                    />
                  </div>
                </div>
              ))}
            </div>

            {filhas.length < MAX_FILHAS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFilhas((atual) => [...atual, filhaVazia()])}
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                Nasceu mais uma célula
              </Button>
            )}
          </div>

          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {semNome > 0 ? (
              <>
                {semNome === 1 ? 'A célula sem nome entra' : `As ${semNome} células sem nome entram`}{' '}
                como <strong>&quot;Nova célula de {mae?.nome ?? '…'}&quot;</strong> e a árvore fica
                pedindo o nome até você batizar.
              </>
            ) : (
              <>
                Cada célula nova entra no banco com página própria, já ligada à{' '}
                <strong>{mae?.nome ?? 'célula-mãe'}</strong> e na mesma rede.
              </>
            )}
          </p>

          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={salvar} disabled={salvando || !celulaMaeId}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
