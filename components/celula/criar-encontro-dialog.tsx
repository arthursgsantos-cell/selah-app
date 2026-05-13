'use client'

import { useState, useTransition } from 'react'
import { createEncontroAction } from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { CalendarPlus } from 'lucide-react'

interface Props {
  celulaId: string
  localPadrao?: string | null
}

export function CriarEncontroDialog({ celulaId, localPadrao }: Props) {
  const [open, setOpen] = useState(false)
  const [dataHora, setDataHora] = useState('')
  const [local, setLocal] = useState(localPadrao ?? '')
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!dataHora) return
    setErro(null)
    startTransition(async () => {
      try {
        await createEncontroAction(celulaId, new Date(dataHora).toISOString(), local || undefined)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao criar encontro')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <CalendarPlus className="h-4 w-4" />
        Agendar encontro
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo encontro</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="data">Data e horário</Label>
            <input
              id="data"
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              required
              className="w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="local">Local</Label>
            <Input
              id="local"
              placeholder="Ex: Casa do Pedro"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!dataHora || isPending}>
              {isPending ? 'Criando...' : 'Criar encontro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
