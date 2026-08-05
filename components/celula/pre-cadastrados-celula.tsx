'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChevronDown, Clock, Search, UserPlus } from 'lucide-react'
import { atribuirCelulaPreCadastroAction } from '@/app/actions/pre-cadastro'

export interface PreCadastrado {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  cargo: string | null
  celula_id: string | null
}

interface Props {
  preCadastrados: PreCadastrado[]
  /** Todas as células, para poder mover a pessoa antes de ela se cadastrar. */
  celulas: { id: string; nome: string }[]
  canEdit: boolean
}

const cargoLabel: Record<string, string> = {
  admin: 'Admin',
  pastor: 'Pastor',
  supervisor: 'Supervisor',
  supervisor_treinamento: 'Supervisor em treinamento',
  lider: 'Líder',
  lider_treinamento: 'Líder em treinamento',
  membro: 'Membro',
  convidado: 'Convidado',
}

/**
 * Seletor de célula com busca — a igreja tem dezenas de células, então rolar
 * um `select` nativo até achar a certa é inviável.
 */
function SeletorCelula({
  valor,
  celulas,
  disabled,
  onSelecionar,
}: {
  valor: string | null
  celulas: { id: string; nome: string }[]
  disabled: boolean
  onSelecionar: (celulaId: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const atual = celulas.find((c) => c.id === valor)
  const filtradas = busca.trim()
    ? celulas.filter((c) => c.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : celulas

  function escolher(id: string) {
    setAberto(false)
    setBusca('')
    onSelecionar(id)
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={disabled}
        className="h-7 max-w-[8rem] w-32 rounded-md border border-input bg-background px-2 text-xs flex items-center gap-1 hover:bg-muted transition-colors disabled:opacity-50"
        title="Mover para outra célula"
      >
        <span className="truncate flex-1 text-left">{atual?.nome ?? 'Sem célula'}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      {aberto && (
        <>
          {/* Fecha ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => { setAberto(false); setBusca('') }} />

          <div className="absolute right-0 top-8 z-50 w-56 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
            <div className="p-1.5 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setAberto(false); setBusca('') }
                    // Enter escolhe a única opção restante — atalho para quem digita o nome todo
                    if (e.key === 'Enter' && filtradas.length === 1) escolher(filtradas[0].id)
                  }}
                  placeholder="Buscar célula..."
                  className="w-full h-7 rounded-md border border-input bg-background pl-6 pr-2 text-xs outline-none focus-visible:border-ring"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => escolher('')}
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted transition-colors ${
                  !valor ? 'bg-muted font-medium' : ''
                }`}
              >
                Sem célula
              </button>

              {filtradas.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">Nenhuma célula encontrada.</p>
              ) : (
                filtradas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => escolher(c.id)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted transition-colors ${
                      c.id === valor ? 'bg-primary/10 text-primary font-medium' : ''
                    }`}
                  >
                    {c.nome}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function PreCadastradosCelula({ preCadastrados, celulas, canEdit }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function mover(id: string, celulaId: string) {
    setErro(null)
    startTransition(async () => {
      const r = await atribuirCelulaPreCadastroAction(id, celulaId || null)
      if (!r.sucesso) setErro(r.erro ?? 'Não foi possível mover.')
      else router.refresh()
    })
  }

  if (preCadastrados.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-amber-600" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Aguardando cadastro ({preCadastrados.length})
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Já estão organizados nesta célula. Entram automaticamente assim que criarem a conta.
      </p>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="space-y-1.5">
        {preCadastrados.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-[10px] bg-amber-100 text-amber-700">
                {p.nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight truncate">{p.nome}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {p.cargo ? cargoLabel[p.cargo] ?? p.cargo : 'Membro'}
                {p.email && ` · ${p.email}`}
              </p>
            </div>

            {canEdit ? (
              <SeletorCelula
                valor={p.celula_id}
                celulas={celulas}
                disabled={isPending}
                onSelecionar={(celulaId) => mover(p.id, celulaId)}
              />
            ) : (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                Pendente
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
