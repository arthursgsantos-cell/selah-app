'use client'

import { useState, useTransition } from 'react'
import {
  adicionarPreCadastro,
  atualizarPreCadastro,
  removerPreCadastro,
  adminVincularPreCadastro,
  adminDesvincularPreCadastro,
} from '@/app/actions/pre-cadastro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  UserPlus,
  Pencil,
  Trash2,
  Link2,
  Unlink,
  Phone,
  StickyNote,
  ChevronDown,
  ChevronUp,
  X,
  Check,
} from 'lucide-react'

type PreCadastro = {
  id: string
  nome: string
  telefone: string | null
  obs: string | null
  status: 'pendente' | 'confirmado' | 'rejeitado'
  profile_id: string | null
  profile_nome: string | null
  created_at: string
}

type MembroOpt = { id: string; nome: string }

interface Props {
  preCadastros: PreCadastro[]
  membros: MembroOpt[]
}

const statusConfig = {
  pendente: { label: 'Aguardando', badge: 'bg-amber-100 text-amber-700' },
  confirmado: { label: 'Confirmado', badge: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', badge: 'bg-gray-100 text-gray-500' },
}

function FormPreCadastro({
  inicial,
  onSave,
  onCancel,
}: {
  inicial?: { nome: string; telefone: string; obs: string }
  onSave: (fd: FormData) => void
  onCancel: () => void
}) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => onSave(fd))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-3 bg-muted/30">
      <div className="space-y-1">
        <Label htmlFor="nome" className="text-xs">Nome *</Label>
        <Input
          id="nome"
          name="nome"
          placeholder="Nome completo"
          defaultValue={inicial?.nome}
          required
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="telefone" className="text-xs">Telefone</Label>
        <Input
          id="telefone"
          name="telefone"
          placeholder="(xx) xxxxx-xxxx"
          defaultValue={inicial?.telefone}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="obs" className="text-xs">Observação</Label>
        <Input
          id="obs"
          name="obs"
          placeholder="Ex: esposa do João, irmã da Maria..."
          defaultValue={inicial?.obs}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Check className="h-3.5 w-3.5 mr-1" />
          {pending ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          <X className="h-3.5 w-3.5 mr-1" />
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function VincularSelect({
  preCadastroId,
  membros,
  onClose,
}: {
  preCadastroId: string
  membros: MembroOpt[]
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [pending, startTransition] = useTransition()

  function handleVincular() {
    if (!selectedId) return
    startTransition(async () => {
      await adminVincularPreCadastro(preCadastroId, selectedId)
      onClose()
    })
  }

  return (
    <div className="flex gap-2 items-center mt-2">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
      >
        <option value="">Selecione um membro...</option>
        {membros.map((m) => (
          <option key={m.id} value={m.id}>{m.nome}</option>
        ))}
      </select>
      <Button size="sm" onClick={handleVincular} disabled={!selectedId || pending}>
        {pending ? '...' : 'Vincular'}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function PreCadastroSection({ preCadastros, membros }: Props) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [vinculandoId, setVinculandoId] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(true)
  const [, startTransition] = useTransition()

  const pendentes = preCadastros.filter((p) => p.status === 'pendente')
  const confirmados = preCadastros.filter((p) => p.status === 'confirmado')

  function handleAdicionar(fd: FormData) {
    startTransition(async () => {
      const res = await adicionarPreCadastro(fd)
      if (res.sucesso) setMostrarForm(false)
    })
  }

  function handleAtualizar(id: string, fd: FormData) {
    startTransition(async () => {
      const res = await atualizarPreCadastro(id, fd)
      if (res.sucesso) setEditandoId(null)
    })
  }

  function handleRemover(id: string) {
    if (!confirm('Remover este pré-cadastro?')) return
    startTransition(async () => { await removerPreCadastro(id) })
  }

  function handleDesvincular(id: string) {
    if (!confirm('Desvincular este membro do pré-cadastro?')) return
    startTransition(async () => { await adminDesvincularPreCadastro(id) })
  }

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Pré-cadastro</span>
          {pendentes.length > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-medium">
              {pendentes.length} aguardando
            </span>
          )}
        </div>
        {expandido ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Adicione membros que ainda não fizeram login. Quando entrarem, o sistema vai sugerir a correspondência automaticamente.
          </p>

          {!mostrarForm && (
            <Button size="sm" variant="outline" onClick={() => setMostrarForm(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar membro
            </Button>
          )}

          {mostrarForm && (
            <FormPreCadastro
              onSave={handleAdicionar}
              onCancel={() => setMostrarForm(false)}
            />
          )}

          {pendentes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aguardando login</p>
              {pendentes.map((pc) => (
                <div key={pc.id} className="space-y-2">
                  {editandoId === pc.id ? (
                    <FormPreCadastro
                      inicial={{ nome: pc.nome, telefone: pc.telefone ?? '', obs: pc.obs ?? '' }}
                      onSave={(fd) => handleAtualizar(pc.id, fd)}
                      onCancel={() => setEditandoId(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-2 rounded-lg border p-2.5 bg-amber-50/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{pc.nome}</p>
                        {pc.telefone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />{pc.telefone}
                          </p>
                        )}
                        {pc.obs && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <StickyNote className="h-3 w-3" />{pc.obs}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title="Vincular manualmente"
                          onClick={() => setVinculandoId(vinculandoId === pc.id ? null : pc.id)}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title="Editar"
                          onClick={() => setEditandoId(pc.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          title="Remover"
                          onClick={() => handleRemover(pc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {vinculandoId === pc.id && editandoId !== pc.id && (
                    <VincularSelect
                      preCadastroId={pc.id}
                      membros={membros}
                      onClose={() => setVinculandoId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {confirmados.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Identificados</p>
              {confirmados.map((pc) => (
                <div key={pc.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{pc.nome}</p>
                    {pc.profile_nome && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vinculado a: <span className="font-medium text-foreground">{pc.profile_nome}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-xs ${statusConfig.confirmado.badge} border-0`}>
                      {statusConfig.confirmado.label}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Desvincular"
                      onClick={() => handleDesvincular(pc.id)}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {preCadastros.length === 0 && !mostrarForm && (
            <p className="text-sm text-muted-foreground py-2">Nenhum pré-cadastro adicionado ainda.</p>
          )}
        </div>
      )}
    </div>
  )
}
