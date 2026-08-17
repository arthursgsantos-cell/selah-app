'use client'

import { useState } from 'react'
import { confirmarVinculoAction } from '@/app/actions/vinculo-igreja'
import { Check, X, Loader2, Mail, Phone, Users, Shield, AlertTriangle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SeletorBusca } from '@/components/shared/seletor-busca'
import type { CargoSolicitado } from '@/lib/supabase/types'

const CARGOS: { v: CargoSolicitado; nome: string }[] = [
  { v: 'membro', nome: 'Membro' },
  { v: 'lider_treinamento', nome: 'Líder em treinamento' },
  { v: 'lider', nome: 'Líder de célula' },
  { v: 'supervisor_treinamento', nome: 'Supervisor em treinamento' },
  { v: 'supervisor', nome: 'Supervisor' },
  { v: 'ensino_professor', nome: 'Professor da Escola Bíblica' },
  { v: 'ensino_coordenador', nome: 'Coordenador de cursos' },
  { v: 'pastor', nome: 'Pastor' },
  { v: 'admin', nome: 'Administrador' },
]

const nomeCargo = (c: string) => CARGOS.find((o) => o.v === c)?.nome ?? c

const vinculoLabels: Record<string, string> = {
  membro: 'diz ser membro',
  congregado: 'diz congregar aqui',
  visitante: 'diz estar visitando',
}

/** Cargos que dão poder sobre a igreja inteira — merecem um aviso na tela. */
const CARGOS_DE_PESO: CargoSolicitado[] = ['pastor', 'admin']

type Props = {
  sol: {
    id: string
    cargo_solicitado: CargoSolicitado
    celula_id: string | null
    mensagem: string | null
    criado_em: string
    vinculo?: string | null
    perfil: {
      nome: string
      avatar_url: string | null
      role: string
      email: string | null
      telefone: string | null
    } | null
  }
  celulas: { id: string; nome: string; rede: string | null }[]
}

/**
 * Painel de confirmação do que alguém declarou ser na igreja.
 *
 * A declaração chega como proposta, não como fato: os campos abaixo vêm
 * preenchidos com o que a pessoa disse e são editáveis. Aceitar aplica o que
 * está na tela — cargo, célula e, quando for o caso, a linha na equipe do
 * Ensino —, não o que foi digitado no cadastro.
 */
export function SolicitacaoCargoCard({ sol, celulas }: Props) {
  const [cargo, setCargo] = useState<CargoSolicitado>(sol.cargo_solicitado)
  const [celulaId, setCelulaId] = useState<string | null>(sol.celula_id)
  const [loading, setLoading] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resolvido, setResolvido] = useState(false)

  async function resolver(acao: 'aprovar' | 'rejeitar') {
    setErro(null)
    setLoading(acao)
    const r = await confirmarVinculoAction(sol.id, acao, { cargo, celulaId })
    if (!r.ok) {
      setErro(r.erro)
      setLoading(null)
      return
    }
    setResolvido(true)
  }

  if (resolvido) return null

  const nome = sol.perfil?.nome ?? 'Usuário'
  const ini = nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  const alterado = cargo !== sol.cargo_solicitado || celulaId !== sol.celula_id
  const quando = new Date(sol.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short',
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 space-y-3">
      {/* Quem é */}
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={sol.perfil?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs font-bold">{ini}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold truncate">{nome}</p>
            <span className="text-[10px] text-muted-foreground shrink-0">{quando}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {sol.vinculo ? vinculoLabels[sol.vinculo] ?? sol.vinculo : 'Se apresentou'}
            {' · '}
            <span className="font-medium text-foreground">
              pediu {nomeCargo(sol.cargo_solicitado)}
            </span>
          </p>
          {sol.perfil?.email && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <Mail className="h-3 w-3 shrink-0" />{sol.perfil.email}
            </p>
          )}
          {sol.perfil?.telefone && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3 shrink-0" />{sol.perfil.telefone}
            </p>
          )}
        </div>
      </div>

      {sol.mensagem && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2.5">
          &ldquo;{sol.mensagem}&rdquo;
        </p>
      )}

      {/* O que será aplicado — vem preenchido com o declarado e pode mudar */}
      <div className="rounded-xl bg-muted/40 p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground w-12 shrink-0">Cargo</span>
          <select
            value={cargo}
            onChange={(e) => setCargo(e.target.value as CargoSolicitado)}
            disabled={!!loading}
            className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring disabled:opacity-50"
          >
            {CARGOS.map((c) => (
              <option key={c.v} value={c.v}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground w-12 shrink-0">Célula</span>
          <SeletorBusca
            valor={celulaId}
            opcoes={celulas.map((c) => ({ id: c.id, nome: c.nome, detalhe: c.rede ?? undefined }))}
            onSelecionar={(id) => setCelulaId(id || null)}
            disabled={!!loading}
            rotuloVazio="Sem célula"
            placeholder="Buscar célula..."
            className="flex-1"
          />
        </div>

        {alterado && (
          <p className="text-[11px] text-amber-700">
            Ajustado — vale o que está aqui, não o que a pessoa declarou.
          </p>
        )}

        {CARGOS_DE_PESO.includes(cargo) && (
          <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {nomeCargo(cargo)} enxerga e edita a igreja inteira. Confirme só se for isso mesmo.
          </p>
        )}
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => resolver('aprovar')}
          disabled={!!loading}
          className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading === 'aprovar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Aceitar
        </button>
        <button
          type="button"
          onClick={() => resolver('rejeitar')}
          disabled={!!loading}
          className="h-9 px-3 rounded-xl border border-border text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5 hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
        >
          {loading === 'rejeitar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          Recusar
        </button>
      </div>
    </div>
  )
}
