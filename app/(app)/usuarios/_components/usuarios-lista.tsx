'use client'

import { useState, useTransition } from 'react'
import { updateUserRoleAction } from '@/app/actions/profile'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import type { Role } from '@/lib/supabase/types'

type Usuario = {
  id: string
  nome: string
  email: string | null
  avatar_url: string | null
  role: Role
  created_at: string
}

interface Props {
  usuarios: Usuario[]
  currentUserId: string
}

const roleConfig: Record<Role, { label: string; badge: string }> = {
  admin: { label: 'Admin', badge: 'bg-red-100 text-red-700' },
  pastor: { label: 'Pastor', badge: 'bg-purple-100 text-purple-700' },
  supervisor: { label: 'Supervisor', badge: 'bg-green-100 text-green-700' },
  lider: { label: 'Líder', badge: 'bg-blue-100 text-blue-700' },
  membro: { label: 'Membro', badge: 'bg-gray-100 text-gray-600' },
}

const roleOptions: Role[] = ['admin', 'pastor', 'supervisor', 'lider', 'membro']

function RoleSelect({ userId, currentRole }: {
  userId: string
  currentRole: Role
}) {
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
    <div className="flex flex-col items-end gap-0.5">
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

function Iniciais({ nome }: { nome: string }) {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

const roleOrder: Record<Role, number> = { admin: 0, pastor: 1, supervisor: 2, lider: 3, membro: 4 }

export function UsuariosLista({ usuarios, currentUserId }: Props) {
  const [busca, setBusca] = useState('')

  const filtrados = usuarios
    .filter((u) => {
      if (!busca.trim()) return true
      const q = busca.toLowerCase()
      return u.nome.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.nome.localeCompare(b.nome))

  const counts = {
    admin: usuarios.filter((u) => u.role === 'admin').length,
    pastor: usuarios.filter((u) => u.role === 'pastor').length,
    supervisor: usuarios.filter((u) => u.role === 'supervisor').length,
    lider: usuarios.filter((u) => u.role === 'lider').length,
    membro: usuarios.filter((u) => u.role === 'membro').length,
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {(Object.entries(roleConfig) as [Role, typeof roleConfig[Role]][]).map(([role, cfg]) => (
          <div key={role} className="rounded-xl border border-border p-3 text-center">
            <p className="text-xl font-bold">{counts[role]}</p>
            <p className={`text-xs font-medium mt-0.5 ${cfg.badge} rounded-full px-1.5 py-0.5 inline-block`}>
              {cfg.label}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado</p>
        )}
        {filtrados.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent/20 transition-colors"
          >
            {/* Avatar */}
            {u.avatar_url ? (
              <img
                src={u.avatar_url}
                alt={u.nome}
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                <Iniciais nome={u.nome} />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{u.nome}</p>
                {u.id === currentUserId && (
                  <span className="text-[10px] text-muted-foreground">(você)</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{u.email ?? '—'}</p>
            </div>

            {/* Role */}
            <RoleSelect
              userId={u.id}
              currentRole={u.role}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
