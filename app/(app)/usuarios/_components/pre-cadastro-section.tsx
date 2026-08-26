'use client'

import { useState, useTransition } from 'react'
import {
  adicionarPreCadastro,
  atualizarPreCadastro,
  removerPreCadastro,
  adminVincularPreCadastro,
  adminDesvincularPreCadastro,
  atribuirCelulaPreCadastroAction,
  vincularConjugePreCadastroAction,
} from '@/app/actions/pre-cadastro'
import { SeletorBusca } from '@/components/shared/seletor-busca'
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
  Mail,
  Shield,
  StickyNote,
  Users,
  Heart,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Search,
} from 'lucide-react'
import type { Role } from '@/lib/supabase/types'

type PreCadastro = {
  id: string
  nome: string
  email: string | null
  cargo: Role | null
  telefone: string | null
  obs: string | null
  celula_id: string | null
  vinculo_casal: string | null
  status: 'pendente' | 'confirmado' | 'rejeitado'
  profile_id: string | null
  profile_nome: string | null
  created_at: string
}

const cargoOptions: { value: Role; label: string }[] = [
  { value: 'membro', label: 'Membro' },
  { value: 'lider_treinamento', label: 'Líder em Treinamento' },
  { value: 'lider', label: 'Líder' },
  { value: 'supervisor_treinamento', label: 'Supervisor em Treinamento' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'pastor', label: 'Pastor' },
  { value: 'admin', label: 'Administrador' },
]

const cargoLabel = (c: Role | null) =>
  cargoOptions.find((o) => o.value === c)?.label ?? null

/** Busca sem acento: quem digita "vivania" precisa achar "Vivânia". */
const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

type MembroOpt = { id: string; nome: string }

interface Props {
  preCadastros: PreCadastro[]
  membros: MembroOpt[]
  /** Todas as células, para definir onde a pessoa entra ao criar a conta. */
  celulas?: { id: string; nome: string }[]
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
  inicial?: { nome: string; email: string; cargo: Role | null; telefone: string; obs: string }
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
        <Label htmlFor="email" className="text-xs">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="usado@gmail.com"
          defaultValue={inicial?.email}
          className="h-8 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          Ao entrar com este e-mail, a pessoa já recebe o cargo abaixo automaticamente.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cargo" className="text-xs">Cargo ao entrar</Label>
        <select
          id="cargo"
          name="cargo"
          defaultValue={inicial?.cargo ?? ''}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
        >
          <option value="">Convidado (padrão)</option>
          {cargoOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
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

export function PreCadastroSection({ preCadastros, membros, celulas = [] }: Props) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [vinculandoId, setVinculandoId] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(true)
  const [busca, setBusca] = useState('')
  const [, startTransition] = useTransition()

  // Filtro local: a lista inteira já veio do servidor, então buscar aqui evita
  // recarregar a página a cada tecla — com 80+ nomes, rolar não é opção.
  const termo = semAcento(busca.trim())
  const visiveis = termo
    ? preCadastros.filter((p) =>
        [p.nome, p.email, p.telefone, p.obs, p.profile_nome]
          .some((campo) => semAcento(campo ?? '').includes(termo))
      )
    : preCadastros

  const pendentes = visiveis.filter((p) => p.status === 'pendente')
  const confirmados = visiveis.filter((p) => p.status === 'confirmado')
  const totalPendentes = preCadastros.filter((p) => p.status === 'pendente').length

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

  function handleCelula(id: string, celulaId: string) {
    startTransition(async () => {
      await atribuirCelulaPreCadastroAction(id, celulaId || null)
    })
  }

  function handleConjuge(id: string, conjugeId: string) {
    startTransition(async () => {
      await vincularConjugePreCadastroAction(id, conjugeId || null)
    })
  }

  /** O par é quem compartilha o mesmo código de vínculo de casal. */
  function conjugeDe(pc: PreCadastro): PreCadastro | null {
    if (!pc.vinculo_casal) return null
    return preCadastros.find((o) => o.id !== pc.id && o.vinculo_casal === pc.vinculo_casal) ?? null
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
          {totalPendentes > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-medium">
              {totalPendentes} aguardando
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

          {preCadastros.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail, telefone ou observação..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 pr-9"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {termo && (
            <p className="text-xs text-muted-foreground">
              {visiveis.length === 0
                ? 'Ninguém encontrado com esse termo.'
                : `${visiveis.length} ${visiveis.length === 1 ? 'resultado' : 'resultados'} para "${busca.trim()}"`}
            </p>
          )}

          {pendentes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aguardando login</p>
              {pendentes.map((pc) => (
                <div key={pc.id} className="space-y-2">
                  {editandoId === pc.id ? (
                    <FormPreCadastro
                      inicial={{
                        nome: pc.nome,
                        email: pc.email ?? '',
                        cargo: pc.cargo,
                        telefone: pc.telefone ?? '',
                        obs: pc.obs ?? '',
                      }}
                      onSave={(fd) => handleAtualizar(pc.id, fd)}
                      onCancel={() => setEditandoId(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-2 rounded-lg border p-2.5 bg-amber-50/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium">{pc.nome}</p>
                          {cargoLabel(pc.cargo) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              <Shield className="h-2.5 w-2.5" />
                              {cargoLabel(pc.cargo)}
                            </span>
                          )}
                        </div>
                        {pc.email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <Mail className="h-3 w-3 shrink-0" />{pc.email}
                          </p>
                        )}
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

                        {/* Célula de destino e cônjuge — definidos antes da pessoa criar a conta */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[11px] text-muted-foreground">Célula:</span>
                            <SeletorBusca
                              valor={pc.celula_id}
                              opcoes={celulas.map((c) => ({ id: c.id, nome: c.nome }))}
                              onSelecionar={(id) => handleCelula(pc.id, id)}
                              rotuloVazio="Sem célula"
                              placeholder="Buscar célula..."
                              className="w-32"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Heart className="h-3 w-3 text-rose-400 shrink-0" />
                            <span className="text-[11px] text-muted-foreground">Cônjuge:</span>
                            <SeletorBusca
                              valor={conjugeDe(pc)?.id ?? null}
                              opcoes={preCadastros
                                .filter((o) => o.id !== pc.id)
                                .map((o) => ({ id: o.id, nome: o.nome, detalhe: o.email ?? undefined }))}
                              onSelecionar={(id) => handleConjuge(pc.id, id)}
                              rotuloVazio="Sem vínculo"
                              placeholder="Buscar pessoa..."
                              className="w-36"
                            />
                          </div>
                        </div>
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
