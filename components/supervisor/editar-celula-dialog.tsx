'use client'

import { useState, useTransition } from 'react'
import { editCelulaAction, deleteCelulaAction } from '@/app/actions/celula'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { GitBranch, Settings2, Trash2 } from 'lucide-react'
import type { Frequencia } from '@/lib/supabase/types'
import { DIAS_SEMANA, normalizarHorario } from '@/lib/dia-semana'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#64748b',
]

interface Props {
  celulaId: string
  nome: string
  descricao?: string | null
  localPadrao?: string | null
  frequencia: Frequencia
  diaSemana?: number | null
  horario?: string | null
  cor?: string | null
  canDelete?: boolean
  /** Rede atual da célula. */
  redeId?: string | null
  /** Redes disponíveis. Vazio esconde o campo (líder não transfere). */
  redes?: { id: string; nome: string }[]
  /** Data-alvo combinada para a próxima multiplicação. */
  multiplicacaoPrevista?: string | null
  /** Célula que gerou esta, na árvore de multiplicação. */
  celulaMaeId?: string | null
  /** Candidatas a célula-mãe. Vazio esconde o campo (líder não define linhagem). */
  celulasParaMae?: { id: string; nome: string }[]
}

export function EditarCelulaDialog({
  celulaId, nome, descricao, localPadrao, frequencia, diaSemana, horario,
  cor, canDelete = false, redeId = null, redes = [],
  multiplicacaoPrevista = null, celulaMaeId = null, celulasParaMae = [],
}: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [nomeState, setNome] = useState(nome)
  const [descricaoState, setDescricao] = useState(descricao ?? '')
  const [localState, setLocal] = useState(localPadrao ?? '')
  const [frequenciaState, setFrequencia] = useState<Frequencia>(frequencia)
  const [diaState, setDia] = useState<string>(diaSemana === null || diaSemana === undefined ? '' : String(diaSemana))
  const [horarioState, setHorario] = useState(normalizarHorario(horario))
  const [corState, setCor] = useState<string>(cor ?? '#6366f1')
  const [redeState, setRede] = useState<string>(redeId ?? '')
  const [multiplicacaoState, setMultiplicacao] = useState<string>(multiplicacaoPrevista ?? '')
  const [celulaMaeState, setCelulaMae] = useState<string>(celulaMaeId ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  function handleOpen(v: boolean) {
    setOpen(v)
    if (!v) {
      setConfirmDelete(false)
      setErro(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nomeState.trim()) return
    setErro(null)
    startTransition(async () => {
      try {
        await editCelulaAction({
          id: celulaId,
          nome: nomeState.trim(),
          descricao: descricaoState.trim() || null,
          local_padrao: localState.trim() || null,
          cor: corState,
          frequencia: frequenciaState,
          dia_semana: diaState === '' ? null : Number(diaState),
          horario: normalizarHorario(horarioState) || null,
          rede_id: redeState || null,
          multiplicacao_prevista: multiplicacaoState || null,
          ...(celulasParaMae.length > 0 ? { celula_mae_id: celulaMaeState || null } : {}),
        })
        setOpen(false)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao salvar')
      }
    })
  }

  function handleDelete() {
    startDelete(async () => {
      try {
        await deleteCelulaAction(celulaId)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao excluir')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" />}>
        <Settings2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar célula</DialogTitle>
        </DialogHeader>

        {!confirmDelete ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ec-nome">Nome</Label>
              <Input
                id="ec-nome"
                value={nomeState}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-desc">Descrição</Label>
              <Textarea
                id="ec-desc"
                value={descricaoState}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Descrição da célula (opcional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-local">Local padrão</Label>
              <Input
                id="ec-local"
                value={localState}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Local padrão dos encontros"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <div className="flex gap-2">
                {(['semanal', 'quinzenal'] as Frequencia[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequencia(f)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      frequenciaState === f
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {f === 'semanal' ? 'Semanal' : 'Quinzenal'}
                  </button>
                ))}
              </div>
            </div>

            {/* Dia e horário padrão — usados para sugerir a data do próximo encontro */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="cel-dia">Dia da semana</Label>
                <select
                  id="cel-dia"
                  value={diaState}
                  onChange={(e) => setDia(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
                >
                  <option value="">Não definido</option>
                  {DIAS_SEMANA.map((d) => (
                    <option key={d.valor} value={d.valor}>{d.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cel-hora">Horário</Label>
                <Input
                  id="cel-hora"
                  inputMode="numeric"
                  placeholder="19:30"
                  value={horarioState}
                  onChange={(e) => setHorario(e.target.value)}
                  className="h-9"
                />
              </div>
              <p className="col-span-2 text-[11px] text-muted-foreground -mt-0.5">
                Ao agendar um encontro, a data já vem preenchida com a próxima ocorrência.
              </p>
            </div>

            {/* Transferir de rede — só chega aqui quem gerencia; a lista vem
                vazia para líder, e a action ignora o campo mesmo assim. */}
            {redes.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="cel-rede">Rede</Label>
                <select
                  id="cel-rede"
                  value={redeState}
                  onChange={(e) => setRede(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
                >
                  {redes.map((r) => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
                {redeState !== (redeId ?? '') && (
                  <p className="text-[11px] text-amber-700">
                    A célula sai da rede atual e passa a aparecer na rede escolhida.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cel-multiplicacao" className="flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                Data prevista para multiplicar
              </Label>
              <input
                id="cel-multiplicacao"
                type="date"
                value={multiplicacaoState}
                onChange={(e) => setMultiplicacao(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                O painel da rede avisa quando essa data estiver a 90 dias ou já
                tiver passado. Deixe em branco para tirar o alerta.
              </p>
            </div>

            {/* Linhagem — de qual célula esta nasceu. Estrutural, então só
                chega a quem gerencia a rede (mesma régua da transferência). */}
            {celulasParaMae.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="cel-mae">Célula-mãe</Label>
                <select
                  id="cel-mae"
                  value={celulaMaeState}
                  onChange={(e) => setCelulaMae(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
                >
                  <option value="">Nenhuma — célula raiz</option>
                  {celulasParaMae.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  A célula que multiplicou e gerou esta. Ajuda a ver a árvore da
                  rede — não precisa preencher se não souber.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cor da célula</Label>
              <div className="flex flex-wrap gap-2.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className="h-7 w-7 rounded-full transition-all focus:outline-none"
                    style={{
                      backgroundColor: c,
                      boxShadow: corState === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                      transform: corState === c ? 'scale(1.15)' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="sm:mr-auto"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir célula
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!nomeState.trim() || isPending}>
                {isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir <strong>{nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
