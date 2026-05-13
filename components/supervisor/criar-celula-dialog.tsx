'use client'

import { useState, useTransition } from 'react'
import { createCelulaAction } from '@/app/actions/celula'
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
import { Plus } from 'lucide-react'

interface Props {
  redeId: string
}

export function CriarCelulaDialog({ redeId }: Props) {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [local, setLocal] = useState('')
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setErro(null)
    startTransition(async () => {
      try {
        await createCelulaAction({
          nome: nome.trim(),
          rede_id: redeId,
          local_padrao: local.trim() || undefined,
          frequencia: 'semanal',
        })
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao criar célula')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4" />
        Nova célula
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar nova célula</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da célula</Label>
            <Input
              id="nome"
              placeholder="Ex: Células dos Jovens"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="local">Local padrão (opcional)</Label>
            <Input
              id="local"
              placeholder="Ex: Igreja Central"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!nome.trim() || isPending}>
              {isPending ? 'Criando...' : 'Criar célula'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
