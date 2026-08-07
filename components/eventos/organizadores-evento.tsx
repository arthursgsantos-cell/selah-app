'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertCircle, Loader2, Search, ShieldCheck, UserMinus, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adicionarOrganizadorAction,
  removerOrganizadorAction,
} from '@/app/actions/gestao-evento'

export interface PessoaEvento {
  id: string
  nome: string
  detalhe?: string | null
}

interface Props {
  eventoId: string
  /** Quem criou o evento — aparece na lista, mas não pode ser removido. */
  criador: PessoaEvento | null
  organizadores: PessoaEvento[]
  /** Membros da igreja, para escolher a quem delegar. */
  candidatos: PessoaEvento[]
}

/**
 * Quem pode lançar pagamentos deste evento.
 *
 * O evento é criado por alguém da liderança, mas quem cuida do dinheiro
 * costuma ser outra pessoa — um tesoureiro, às vezes sem cargo nenhum no app.
 * Sem esta lista, ou essa pessoa não conseguiria registrar nada, ou seria
 * preciso promovê-la a líder só para isso.
 */
export function OrganizadoresEvento({ eventoId, criador, organizadores: inicial, candidatos }: Props) {
  const [organizadores, setOrganizadores] = useState(inicial)
  const [escolhendo, setEscolhendo] = useState(false)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const jaTem = useMemo(
    () => new Set([criador?.id, ...organizadores.map((o) => o.id)].filter(Boolean) as string[]),
    [criador, organizadores]
  )

  const opcoes = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return candidatos
      .filter((c) => !jaTem.has(c.id))
      .filter((c) => !termo || c.nome.toLowerCase().includes(termo) || (c.detalhe ?? '').toLowerCase().includes(termo))
      .slice(0, 8)
  }, [candidatos, jaTem, busca])

  function adicionar(pessoa: PessoaEvento) {
    setErro(null)
    setOrganizadores((atual) => [...atual, pessoa])
    setBusca('')
    setEscolhendo(false)
    startTransition(async () => {
      try {
        await adicionarOrganizadorAction(eventoId, pessoa.id)
      } catch (e) {
        setOrganizadores((atual) => atual.filter((o) => o.id !== pessoa.id))
        setErro(e instanceof Error ? e.message : 'Erro ao adicionar')
      }
    })
  }

  function remover(pessoa: PessoaEvento) {
    const anteriores = organizadores
    setOrganizadores((atual) => atual.filter((o) => o.id !== pessoa.id))
    startTransition(async () => {
      try {
        await removerOrganizadorAction(eventoId, pessoa.id)
      } catch (e) {
        setOrganizadores(anteriores)
        setErro(e instanceof Error ? e.message : 'Erro ao remover')
      }
    })
  }

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-4 nao-imprimir">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Quem gerencia este evento</h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Além da liderança da igreja, estas pessoas podem cadastrar inscritos e lançar pagamentos.
      </p>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {criador && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {criador.nome}
            <span className="text-[10px] font-normal opacity-70">criou</span>
          </span>
        )}
        {organizadores.map((o) => (
          <span
            key={o.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium"
          >
            {o.nome}
            <button
              type="button"
              onClick={() => remover(o)}
              disabled={isPending}
              aria-label={`Remover ${o.nome}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <UserMinus className="h-3 w-3" />
            </button>
          </span>
        ))}

        {!escolhendo && (
          <Button size="sm" variant="outline" onClick={() => setEscolhendo(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Delegar
          </Button>
        )}
      </div>

      {escolhendo && (
        <div className="space-y-1.5 rounded-xl border border-border bg-background p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar membro..."
              className="h-9 pl-8"
              autoFocus
            />
            <button
              type="button"
              onClick={() => { setEscolhendo(false); setBusca('') }}
              aria-label="Fechar"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {opcoes.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              {busca ? 'Ninguém com esse nome.' : 'Digite para buscar.'}
            </p>
          ) : (
            <div className="divide-y">
              {opcoes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => adicionar(p)}
                  className="flex w-full items-center gap-2 px-1 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                  {p.detalhe && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{p.detalhe}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isPending && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> salvando...
        </p>
      )}
      {erro && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" /> {erro}
        </p>
      )}
    </section>
  )
}
