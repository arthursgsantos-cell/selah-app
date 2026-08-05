'use client'

import { useState, useTransition } from 'react'
import { createRedeAction } from '@/app/actions/rede'
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
import { Plus } from 'lucide-react'

const COR_OPTIONS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#22c55e', // green
  '#0ea5e9', // sky
  '#f59e0b', // amber
]

export function CriarRedeDialog() {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState(COR_OPTIONS[0])
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setErro(null)
    startTransition(async () => {
      try {
        await createRedeAction({ nome: nome.trim(), descricao: descricao.trim() || undefined, cor })
        setOpen(false)
        setNome('')
        setDescricao('')
        setCor(COR_OPTIONS[0])
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao criar rede')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4" />
        Nova rede
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar nova rede</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da rede</Label>
            <Input
              id="nome"
              placeholder="Ex: Jovens, Casais, Adolescentes"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Textarea
              id="desc"
              placeholder="Breve descrição da rede..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {COR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className="h-7 w-7 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    outline: cor === c ? `3px solid ${c}` : '3px solid transparent',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!nome.trim() || isPending}>
              {isPending ? 'Criando...' : 'Criar rede'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
