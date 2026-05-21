'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  updateUserRoleAction,
  addMembroCelulaAction,
  removeMembroCelulaAction,
  addSupervisorRedeAction,
  removeSupervisorRedeAction,
} from '@/app/actions/profile'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, Plus, Users, Shield, UserPlus, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { EditarPerfilAdmin } from '@/components/usuarios/editar-perfil-admin'
import type { Role } from '@/lib/supabase/types'

type Membership = { celula_id: string; celula_nome: string; papel: string }
type RedeSup = { rede_id: string; rede_nome: string }

type Usuario = {
  id: string
  nome: string
  email: string | null
  avatar_url: string | null
  role: Role
  created_at: string
  telefone: string | null
  data_nascimento_1: string | null
  data_nascimento_2: string | null
  data_casamento: string | null
  endereco: string | null
  endereco_maps: string | null
  conjuge_id: string | null
  conjuge_nome: string | null
  memberships: Membership[]
  redes_supervisiona: RedeSup[]
}

type CelulaOpt = { id: string; nome: string; rede_nome: string }
type RedeOpt = { id: string; nome: string }

interface Props {
  usuarios: Usuario[]
  currentUserId: string
  celulaOpts: CelulaOpt[]
  redeOpts: RedeOpt[]
  codigoIgreja: string
  roleCounts: Record<Role, number>
  totalFiltrado: number
  totalGeral: number
  page: number
  totalPaginas: number
  searchInicial: string
  todosUsuarios: { id: string; nome: string }[]
}

const roleConfig: Record<Role, { label: string; badge: string }> = {
  admin: { label: 'Admin', badge: 'bg-red-100 text-red-700' },
  pastor: { label: 'Pastor', badge: 'bg-purple-100 text-purple-700' },
  supervisor: { label: 'Supervisor', badge: 'bg-green-100 text-green-700' },
  supervisor_treinamento: { label: 'Sup. Treinamento', badge: 'bg-emerald-100 text-emerald-700' },
  lider: { label: 'Líder', badge: 'bg-blue-100 text-blue-700' },
  lider_treinamento: { label: 'Líder Treinamento', badge: 'bg-sky-100 text-sky-700' },
  membro: { label: 'Membro', badge: 'bg-gray-100 text-gray-600' },
}

const roleOptions: Role[] = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider', 'lider_treinamento', 'membro']

const papelConfig: Record<string, { label: string; badge: string }> = {
  lider: { label: 'Líder', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  membro: { label: 'Membro', badge: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const selectCls = 'h-7 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring'

function Iniciais({ nome }: { nome: string }) {
  return (
    <>
      {nome.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
    </>
  )
}

function RoleSelect({ userId, currentRole }: { userId: string; currentRole: Role }) {
  const [role, setRole] = useState<Role>(currentRole)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novoRole = e.target.value as Role
    setErro(null)
    startTransition(async () => {
      try {
        await updateUserRoleAction(userId, novoRole)
        setRole(novoRole)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <select
        value={role}
        onChange={handleChange}
        disabled={isPending}
        className={`text-xs font-medium rounded-full border-0 px-2.5 py-1 outline-none cursor-pointer disabled:opacity-50 ${roleConfig[role].badge}`}
      >
        {roleOptions.map((r) => (
          <option key={r} value={r} className="bg-background text-foreground">
            {roleConfig[r].label}
          </option>
        ))}
      </select>
      {erro && <p className="text-[10px] text-destructive">{erro}</p>}
    </div>
  )
}

function CelulaChip({ userId, celulaId, nome, papel }: {
  userId: string; celulaId: string; nome: string; papel: string
}) {
  const [removido, setRemovido] = useState(false)
  const [isPending, startTransition] = useTransition()
  if (removido) return null
  const cfg = papelConfig[papel] ?? papelConfig.membro

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>
      <Users className="h-3 w-3 shrink-0" />
      {nome}
      <span className="opacity-60">· {cfg.label}</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          await removeMembroCelulaAction(userId, celulaId)
          setRemovido(true)
        })}
        className="ml-0.5 hover:text-destructive disabled:opacity-40"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function RedeChip({ userId, redeId, nome }: { userId: string; redeId: string; nome: string }) {
  const [removido, setRemovido] = useState(false)
  const [isPending, startTransition] = useTransition()
  if (removido) return null

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
      <Shield className="h-3 w-3 shrink-0" />
      {nome}
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          await removeSupervisorRedeAction(userId, redeId)
          setRemovido(true)
        })}
        className="ml-0.5 hover:text-destructive disabled:opacity-40"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function AddCelulaForm({ userId, celulaOpts, celulaIdsAtuais }: {
  userId: string
  celulaOpts: CelulaOpt[]
  celulaIdsAtuais: string[]
}) {
  const [aberto, setAberto] = useState(false)
  const [celulaId, setCelulaId] = useState('')
  const [papel, setPapel] = useState<'lider' | 'membro'>('membro')
  const [isPending, startTransition] = useTransition()
  const [adicionados, setAdicionados] = useState<{ celula_id: string; celula_nome: string; papel: string }[]>([])

  const disponiveis = celulaOpts.filter(
    (c) => !celulaIdsAtuais.includes(c.id) && !adicionados.find((a) => a.celula_id === c.id)
  )

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-input rounded-full px-2 py-0.5 transition-colors"
      >
        <Plus className="h-3 w-3" /> Célula
      </button>
    )
  }

  function confirmar() {
    if (!celulaId) return
    const nome = celulaOpts.find((c) => c.id === celulaId)?.nome ?? ''
    startTransition(async () => {
      await addMembroCelulaAction(userId, celulaId, papel)
      setAdicionados((prev) => [...prev, { celula_id: celulaId, celula_nome: nome, papel }])
      setCelulaId('')
      setAberto(false)
    })
  }

  return (
    <>
      {adicionados.map((a) => (
        <CelulaChip key={a.celula_id} userId={userId} celulaId={a.celula_id} nome={a.celula_nome} papel={a.papel} />
      ))}
      <div className="inline-flex items-center gap-1 flex-wrap">
        <select value={celulaId} onChange={(e) => setCelulaId(e.target.value)} className={selectCls}>
          <option value="">Selecione...</option>
          {disponiveis.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}{c.rede_nome ? ` (${c.rede_nome})` : ''}</option>
          ))}
        </select>
        <select value={papel} onChange={(e) => setPapel(e.target.value as 'lider' | 'membro')} className={selectCls}>
          <option value="membro">Membro</option>
          <option value="lider">Líder</option>
        </select>
        <button
          type="button"
          disabled={!celulaId || isPending}
          onClick={confirmar}
          className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
        >
          {isPending ? '...' : 'OK'}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  )
}

function AddRedeForm({ userId, redeOpts, redeIdsAtuais }: {
  userId: string
  redeOpts: RedeOpt[]
  redeIdsAtuais: string[]
}) {
  const [aberto, setAberto] = useState(false)
  const [redeId, setRedeId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [adicionadas, setAdicionadas] = useState<{ rede_id: string; rede_nome: string }[]>([])

  const disponiveis = redeOpts.filter(
    (r) => !redeIdsAtuais.includes(r.id) && !adicionadas.find((a) => a.rede_id === r.id)
  )

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-input rounded-full px-2 py-0.5 transition-colors"
      >
        <Plus className="h-3 w-3" /> Rede
      </button>
    )
  }

  function confirmar() {
    if (!redeId) return
    const nome = redeOpts.find((r) => r.id === redeId)?.nome ?? ''
    startTransition(async () => {
      await addSupervisorRedeAction(userId, redeId)
      setAdicionadas((prev) => [...prev, { rede_id: redeId, rede_nome: nome }])
      setRedeId('')
      setAberto(false)
    })
  }

  return (
    <>
      {adicionadas.map((a) => (
        <RedeChip key={a.rede_id} userId={userId} redeId={a.rede_id} nome={a.rede_nome} />
      ))}
      <div className="inline-flex items-center gap-1">
        <select value={redeId} onChange={(e) => setRedeId(e.target.value)} className={selectCls}>
          <option value="">Selecione...</option>
          {disponiveis.map((r) => (
            <option key={r.id} value={r.id}>{r.nome}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!redeId || isPending}
          onClick={confirmar}
          className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
        >
          {isPending ? '...' : 'OK'}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  )
}

const ehSuperiorOuSupervisor = (role: Role) =>
  ['admin', 'pastor', 'supervisor', 'supervisor_treinamento'].includes(role)

const roleConviteOpts: { value: Role; label: string; prefixo: string }[] = [
  { value: 'pastor',                label: 'Pastor',                 prefixo: 'pastor' },
  { value: 'supervisor',            label: 'Supervisor',             prefixo: 'supervisor' },
  { value: 'supervisor_treinamento',label: 'Sup. em Treinamento',    prefixo: 'supervisor-trein' },
  { value: 'lider',                 label: 'Líder',                  prefixo: 'lider' },
  { value: 'lider_treinamento',     label: 'Líder em Treinamento',   prefixo: 'lider-trein' },
  { value: 'membro',                label: 'Membro',                 prefixo: 'membro' },
  { value: 'admin',                 label: 'Administrador',          prefixo: 'admin' },
]

function GerarConviteDialog({ codigoIgreja }: { codigoIgreja: string }) {
  const [aberto, setAberto] = useState(false)
  const [roleSel, setRoleSel] = useState<Role>('membro')
  const [copiado, setCopiado] = useState(false)

  const opt = roleConviteOpts.find((o) => o.value === roleSel)!
  const codigo = `${opt.prefixo}-${codigoIgreja}`
  const mensagem = `Olá! Você foi convidado para entrar no app da Igreja Batista Zona Sul como *${opt.label}*.\n\nBaixe o app e crie sua conta usando o código de convite:\n\n*${codigo}*\n\nSe já tem conta, entre normalmente e seu papel já estará configurado.`

  function copiar() {
    navigator.clipboard.writeText(mensagem).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  if (!aberto) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        <UserPlus className="h-4 w-4" />
        Gerar convite
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Gerar convite</p>
        <button onClick={() => setAberto(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Função da pessoa convidada</p>
        <div className="flex flex-wrap gap-1.5">
          {roleConviteOpts.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setRoleSel(o.value)}
              className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                roleSel === o.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-muted px-3 py-2.5 space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Código</p>
        <p className="text-sm font-mono font-bold text-foreground">{codigo}</p>
      </div>

      <div className="rounded-lg bg-muted/60 border border-border px-3 py-2.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Mensagem para enviar</p>
        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{mensagem}</p>
      </div>

      <button
        type="button"
        onClick={copiar}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copiado ? 'Copiado!' : 'Copiar mensagem'}
      </button>
    </div>
  )
}

export function UsuariosLista({
  usuarios,
  currentUserId,
  celulaOpts,
  redeOpts,
  codigoIgreja,
  roleCounts,
  totalFiltrado,
  totalGeral,
  page,
  totalPaginas,
  searchInicial,
  todosUsuarios,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [busca, setBusca] = useState(searchInicial)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const allRoles: Role[] = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider', 'lider_treinamento', 'membro']

  function handleBuscaChange(value: string) {
    setBusca(value)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (value.trim()) params.set('q', value.trim())
      const qs = params.toString()
      router.push(`${pathname}${qs ? '?' + qs : ''}`)
    }, 400)
  }

  function goToPage(p: number) {
    const params = new URLSearchParams()
    if (busca.trim()) params.set('q', busca.trim())
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    router.push(`${pathname}${qs ? '?' + qs : ''}`)
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Total de usuários</span>
          <span className="text-2xl font-bold text-primary">{totalGeral}</span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-border/60">
          {allRoles.slice(0, 4).map((role) => {
            const cfg = roleConfig[role]
            const count = roleCounts[role]
            return (
              <div key={role} className="py-3 text-center">
                <p className={`text-xl font-bold ${count > 0 ? 'text-primary' : 'text-muted-foreground/40'}`}>{count}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block leading-tight mt-1 ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/60">
          {allRoles.slice(4).map((role) => {
            const cfg = roleConfig[role]
            const count = roleCounts[role]
            return (
              <div key={role} className="py-3 text-center">
                <p className={`text-xl font-bold ${count > 0 ? 'text-primary' : 'text-muted-foreground/40'}`}>{count}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block leading-tight mt-1 ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Search + Invite */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={(e) => handleBuscaChange(e.target.value)}
            className="pl-9"
          />
          {busca && (
            <button
              type="button"
              onClick={() => handleBuscaChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {codigoIgreja && <GerarConviteDialog codigoIgreja={codigoIgreja} />}
      </div>

      {/* Result info */}
      {busca && (
        <p className="text-xs text-muted-foreground">
          {totalFiltrado} {totalFiltrado === 1 ? 'usuário encontrado' : 'usuários encontrados'}
        </p>
      )}

      {/* List */}
      <div className="space-y-2">
        {usuarios.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado</p>
        )}

        {usuarios.map((u) => (
          <div key={u.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt={u.nome} className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                  <Iniciais nome={u.nome} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{u.nome}</p>
                  {u.id === currentUserId && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">você</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email ?? '—'}</p>
              </div>
              <RoleSelect userId={u.id} currentRole={u.role} />
            </div>

            <div className="border-t border-border/60 bg-muted/20 px-3 py-2 flex flex-wrap gap-1.5">
              {u.memberships.map((m) => (
                <CelulaChip key={m.celula_id} userId={u.id} celulaId={m.celula_id} nome={m.celula_nome} papel={m.papel} />
              ))}
              {u.redes_supervisiona.map((r) => (
                <RedeChip key={r.rede_id} userId={u.id} redeId={r.rede_id} nome={r.rede_nome} />
              ))}
              {celulaOpts.length > 0 && (
                <AddCelulaForm userId={u.id} celulaOpts={celulaOpts} celulaIdsAtuais={u.memberships.map((m) => m.celula_id)} />
              )}
              {ehSuperiorOuSupervisor(u.role) && redeOpts.length > 0 && (
                <AddRedeForm userId={u.id} redeOpts={redeOpts} redeIdsAtuais={u.redes_supervisiona.map((r) => r.rede_id)} />
              )}
            </div>

            <EditarPerfilAdmin usuario={u} todosUsuarios={todosUsuarios} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPaginas}
            {!busca && <span className="ml-1">· {totalGeral} membros</span>}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPaginas}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
