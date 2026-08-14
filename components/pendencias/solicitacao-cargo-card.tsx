'use client'

import { useState } from 'react'
import { confirmarVinculoAction } from '@/app/actions/vinculo-igreja'
import { Check, X, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const cargoLabels: Record<string, string> = {
  membro: 'Membro',
  lider_treinamento: 'Líder em Treinamento',
  lider: 'Líder',
  supervisor_treinamento: 'Supervisor em Treinamento',
  supervisor: 'Supervisor',
  pastor: 'Pastor',
  admin: 'Administrador',
  ensino_professor: 'Professor da Escola Bíblica',
  ensino_coordenador: 'Coordenador de cursos',
}

const vinculoLabels: Record<string, string> = {
  membro: 'diz ser membro',
  congregado: 'diz congregar aqui',
  visitante: 'diz estar visitando',
}

type Props = {
  sol: {
    id: string
    cargo_solicitado: string
    mensagem: string | null
    criado_em: string
    vinculo?: string | null
    celulas?: { nome: string } | null
    profiles: { nome: string; avatar_url: string | null; role: string } | null
  }
}

export function SolicitacaoCargoCard({ sol }: Props) {
  const [loading, setLoading] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [resolvido, setResolvido] = useState(false)

  async function resolver(acao: 'aprovar' | 'rejeitar') {
    setLoading(acao)
    await confirmarVinculoAction(sol.id, acao)
    setResolvido(true)
  }

  if (resolvido) return null

  const nome = sol.profiles?.nome ?? 'Usuário'
  const ini = nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={sol.profiles?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs font-bold">{ini}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{nome}</p>
        <p className="text-xs text-muted-foreground">
          {sol.vinculo ? vinculoLabels[sol.vinculo] ?? sol.vinculo : 'Solicitou'}
          {' · '}
          <span className="font-medium text-foreground">
            {cargoLabels[sol.cargo_solicitado] ?? sol.cargo_solicitado}
          </span>
        </p>
        {sol.celulas?.nome && (
          <p className="text-xs text-muted-foreground">
            Célula: <span className="font-medium text-foreground">{sol.celulas.nome}</span>
          </p>
        )}
        {sol.mensagem && (
          <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{sol.mensagem}&rdquo;</p>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => resolver('rejeitar')}
          disabled={!!loading}
          className="h-8 w-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
        >
          {loading === 'rejeitar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => resolver('aprovar')}
          disabled={!!loading}
          className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {loading === 'aprovar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
