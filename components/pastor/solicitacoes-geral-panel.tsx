'use client'

import { useState, useTransition } from 'react'
import { atualizarSolicitacaoAction } from '@/app/actions/solicitacoes'
import { nomeMinisterio } from '@/lib/ministerios'
import { Button } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import {
  ChevronDown, ChevronUp, CheckCheck, HeartHandshake, BadgeCheck, Inbox,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { TipoSolicitacao, StatusSolicitacao } from '@/lib/supabase/types'

export interface SolicitacaoGeral {
  id: string
  avatar_url?: string | null
  tipo: TipoSolicitacao
  nome: string
  telefone: string
  email: string
  dados: Record<string, unknown>
  mensagem: string | null
  status: StatusSolicitacao
  criado_em: string
  responsavel_id: string | null
}

const STATUS: Record<StatusSolicitacao, { label: string; className: string }> = {
  pendente:     { label: 'Pendente',     className: 'bg-yellow-100 text-yellow-700' },
  em_andamento: { label: 'Em andamento', className: 'bg-blue-100 text-blue-700' },
  atendido:     { label: 'Atendido',     className: 'bg-green-100 text-green-700' },
  arquivado:    { label: 'Arquivado',    className: 'bg-muted text-muted-foreground' },
}

const TIPO: Record<TipoSolicitacao, { label: string; icone: React.ReactNode; saudacao: string }> = {
  voluntario: {
    label: 'Voluntário',
    icone: <HeartHandshake className="h-3.5 w-3.5" />,
    saudacao: 'Recebemos seu interesse em servir na nossa igreja. Vamos conversar sobre isso?',
  },
  membresia: {
    label: 'Membresia',
    icone: <BadgeCheck className="h-3.5 w-3.5" />,
    saudacao: 'Recebemos seu interesse em ser membro da nossa igreja. Vamos conversar sobre os proximos passos?',
  },
}

const SITUACAO_LABEL: Record<string, string> = {
  visitante: 'Visitante',
  congregado: 'Congregado',
  transferencia: 'Transferência de outra igreja',
}

function whatsappLink(telefone: string, nome: string, tipo: TipoSolicitacao) {
  const num = telefone.replace(/\D/g, '')
  const completo = num.startsWith('55') ? num : `55${num}`
  return `https://wa.me/${completo}?text=${encodeURIComponent(`Ola ${nome}! ${TIPO[tipo].saudacao}`)}`
}

/** Texto de um valor guardado em `dados`, que é jsonb e chega sem tipo. */
function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  return String(valor)
}

function Detalhes({ sol }: { sol: SolicitacaoGeral }) {
  const d = sol.dados ?? {}

  if (sol.tipo === 'voluntario') {
    const areas = Array.isArray(d.areas) ? (d.areas as string[]) : []
    return (
      <div className="space-y-2">
        {areas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {areas.map((a) => (
              <span key={a} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {nomeMinisterio(a)}
              </span>
            ))}
          </div>
        )}
        <Linha rotulo="Disponibilidade" valor={texto(d.disponibilidade)} />
        <Linha rotulo="Experiência" valor={texto(d.experiencia)} />
      </div>
    )
  }

  const situacao = texto(d.situacao)
  return (
    <div className="space-y-2">
      <Linha rotulo="Situação" valor={situacao ? SITUACAO_LABEL[situacao] ?? situacao : null} />
      <Linha rotulo="Batizado" valor={texto(d.batizado)} />
      <Linha rotulo="Igreja de origem" valor={texto(d.igreja_origem)} />
      <Linha rotulo="Nascimento" valor={texto(d.nascimento)} />
      <Linha rotulo="Como conheceu" valor={texto(d.como_conheceu)} />
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null
  return (
    <p className="text-xs">
      <span className="text-muted-foreground">{rotulo}: </span>
      <span className="font-medium">{valor}</span>
    </p>
  )
}

function Cartao({ sol }: { sol: SolicitacaoGeral }) {
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const status = STATUS[sol.status] ?? STATUS.pendente
  const tipo = TIPO[sol.tipo]

  function mudar(novo: StatusSolicitacao) {
    setErro(null)
    startTransition(async () => {
      try {
        await atualizarSolicitacaoAction(sol.id, { status: novo })
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível atualizar.')
      }
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {sol.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sol.avatar_url} alt={`Foto de ${sol.nome}`} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-background shadow-sm" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
              {sol.nome.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{sol.nome}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {tipo.icone}
              {tipo.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {format(new Date(sol.criado_em), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-label={aberto ? 'Recolher' : 'Ver detalhes'}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {aberto && (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3">
          <Linha rotulo="Telefone" valor={sol.telefone} />
          <Linha rotulo="E-mail" valor={sol.email} />
          <Detalhes sol={sol} />
          {sol.mensagem && (
            <p className="rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed">{sol.mensagem}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {(sol.status === 'arquivado' || sol.status === 'atendido') && (
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={isPending} onClick={() => mudar('pendente')}>
                Voltar para pendentes
              </Button>
            )}
            <a
              href={whatsappLink(sol.telefone, sol.nome, sol.tipo)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
              WhatsApp
            </a>
            {sol.status === 'pendente' && (
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={isPending} onClick={() => mudar('em_andamento')}>
                Assumir
              </Button>
            )}
            {sol.status !== 'atendido' && (
              <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={isPending} onClick={() => mudar('atendido')}>
                <CheckCheck className="h-3.5 w-3.5" />
                Atendido
              </Button>
            )}
            {sol.status !== 'arquivado' && sol.status !== 'atendido' && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={isPending} onClick={() => mudar('arquivado')}>
                Arquivar
              </Button>
            )}
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>
      )}
    </div>
  )
}

/**
 * Pedidos de voluntariado e de membresia.
 *
 * Os dois na mesma lista de propósito: quem cuida do acolhimento trata as duas
 * coisas na mesma conversa, e separar em duas telas faria a pessoa procurar o
 * mesmo nome em dois lugares. O selo diz qual é qual.
 */
export function SolicitacoesGeralPanel({ solicitacoes }: { solicitacoes: SolicitacaoGeral[] }) {
  const [filtro, setFiltro] = useState<'abertos' | 'atendidos' | 'arquivados' | 'todos'>('abertos')
  const visiveis = solicitacoes.filter((s) => filtro === 'todos' || filtro === 'abertos' && ['pendente', 'em_andamento'].includes(s.status) || filtro === 'atendidos' && s.status === 'atendido' || filtro === 'arquivados' && s.status === 'arquivado')
  if (solicitacoes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum pedido em aberto.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {([['abertos', 'Em aberto'], ['atendidos', 'Concluídos'], ['arquivados', 'Arquivados'], ['todos', 'Todo o histórico']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${filtro === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {label} ({solicitacoes.filter((s) => id === 'todos' || id === 'abertos' && ['pendente', 'em_andamento'].includes(s.status) || id === 'atendidos' && s.status === 'atendido' || id === 'arquivados' && s.status === 'arquivado').length})
          </button>
        ))}
      </div>
      {visiveis.length === 0 ? <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">Nenhum pedido nesta categoria.</p> : visiveis.map((s) => <Cartao key={s.id} sol={s} />)}
    </div>
  )
}

