'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Wand2, Loader2, Trash2, Pencil, ClipboardList, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  criarAulaAction, editarAulaAction, excluirAulaAction, gerarAulasAction,
} from '@/app/actions/ensino/aulas'
import { dataBr, STATUS_AULA } from '@/lib/ensino/turma'
import { nomeDoDia } from '@/lib/dia-semana'
import type { StatusAula } from '@/lib/supabase/types'

const campoClass =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

export interface AulaGestao {
  id: string
  numero: number
  titulo: string | null
  data: string
  horaInicio: string | null
  local: string | null
  status: StatusAula
  marcados: number
  presentes: number
}

export function AulasGestao({
  turmaId,
  aulas,
  totalAlunos,
  podeGerar,
}: {
  turmaId: string
  aulas: AulaGestao[]
  totalAlunos: number
  /** Falso quando a turma ainda não tem data de início ou dias da semana. */
  podeGerar: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function gerar() {
    setErro(null)
    setAviso(null)
    startTransition(async () => {
      const r = await gerarAulasAction(turmaId)
      if (!r.ok) { setErro(r.erro); return }
      setAviso(`${r.criadas} ${r.criadas === 1 ? 'aula criada' : 'aulas criadas'}.`)
      router.refresh()
    })
  }

  function excluir(id: string) {
    setErro(null)
    startTransition(async () => {
      const r = await excluirAulaAction(id)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <AulaDialog turmaId={turmaId} proximoNumero={(aulas.at(-1)?.numero ?? 0) + 1} />
        {podeGerar && (
          <Button variant="outline" size="sm" onClick={gerar} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Gerar calendário
          </Button>
        )}
      </div>

      {aviso && (
        <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          {aviso}
        </p>
      )}
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {aulas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma aula cadastrada</p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">
            {podeGerar
              ? 'Use "Gerar calendário" para criar todas as datas de uma vez, a partir dos dias e do período da turma.'
              : 'Defina a data de início e os dias da semana na turma para gerar o calendário automaticamente.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border divide-y overflow-hidden">
          {aulas.map((a) => {
            const [ano, mes, dia] = a.data.split('-').map(Number)
            const diaSemana = nomeDoDia(new Date(ano, mes - 1, dia).getDay())
            const chamadaFeita = a.marcados > 0

            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                  {a.numero}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug truncate">
                    {a.titulo ?? `Aula ${a.numero}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {diaSemana?.slice(0, 3)}, {dataBr(a.data)}
                    {a.horaInicio && ` · ${a.horaInicio.slice(0, 5)}`}
                  </p>
                  <p className="text-[11px] mt-0.5 flex items-center gap-1.5">
                    <span className={`font-medium px-1.5 py-0.5 rounded-full ${STATUS_AULA[a.status].classe}`}>
                      {STATUS_AULA[a.status].label}
                    </span>
                    {chamadaFeita ? (
                      <span className="text-green-600 flex items-center gap-0.5">
                        <Check className="h-3 w-3" />
                        {a.presentes}/{a.marcados} presentes
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">chamada não feita</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/ensino/chamada/${a.id}`}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    Chamada
                  </Link>
                  <AulaDialog turmaId={turmaId} aula={a} />
                  <button
                    type="button"
                    onClick={() => excluir(a.id)}
                    disabled={isPending}
                    aria-label={`Excluir aula ${a.numero}`}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalAlunos === 0 && aulas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          A turma ainda não tem alunos aprovados — a lista de chamada vai aparecer vazia.
        </p>
      )}
    </div>
  )
}

function AulaDialog({
  turmaId,
  aula,
  proximoNumero,
}: {
  turmaId: string
  aula?: AulaGestao
  proximoNumero?: number
}) {
  const editando = aula !== undefined
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [titulo, setTitulo] = useState(aula?.titulo ?? '')
  const [data, setData] = useState(aula?.data ?? '')
  const [horaInicio, setHoraInicio] = useState(aula?.horaInicio?.slice(0, 5) ?? '')
  const [local, setLocal] = useState(aula?.local ?? '')
  const [status, setStatus] = useState<StatusAula>(aula?.status ?? 'agendada')

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    if (!data) return
    setErro(null)

    startTransition(async () => {
      const r = editando
        ? await editarAulaAction(aula!.id, {
            data,
            titulo: titulo || null,
            horaInicio: horaInicio || null,
            local: local || null,
            status,
          })
        : await criarAulaAction({
            turmaId,
            data,
            titulo: titulo || null,
            horaInicio: horaInicio || null,
            local: local || null,
          })

      if (!r.ok) { setErro(r.erro); return }
      setOpen(false)
      if (!editando) { setTitulo(''); setData(''); setLocal('') }
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editando ? (
            <button
              type="button"
              aria-label={`Editar aula ${aula.numero}`}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            />
          ) : (
            <Button size="sm" variant="outline" />
          )
        }
      >
        {editando ? (
          <Pencil className="h-3.5 w-3.5" />
        ) : (
          <>
            <CalendarPlus className="h-4 w-4" />
            Nova aula
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editando ? `Aula ${aula.numero}` : `Nova aula${proximoNumero ? ` (${proximoNumero})` : ''}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submeter} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="aula-titulo">Título (opcional)</Label>
            <Input
              id="aula-titulo"
              placeholder="Ex: O arrependimento"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="aula-data">Data</Label>
              <input
                id="aula-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                className={campoClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aula-hora">Horário</Label>
              <input
                id="aula-hora"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className={campoClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aula-local">Local (opcional)</Label>
            <Input
              id="aula-local"
              placeholder="Ex: Sala 2"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>

          {editando && (
            <div className="space-y-1.5">
              <Label htmlFor="aula-status">Situação</Label>
              <select
                id="aula-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusAula)}
                className={campoClass}
              >
                <option value="agendada">Agendada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={!data || isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editando ? 'Salvar' : 'Criar aula'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
