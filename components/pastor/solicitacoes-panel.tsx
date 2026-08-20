'use client'

import { useState, useTransition } from 'react'
import { encaminharSolicitacaoAction, marcarAtendidoAction, confirmarMembroCelulaAction } from '@/app/actions/solicitar-celula'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCheck, ChevronDown, ChevronUp, Users, Share2 } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Solicitacao {
  id: string
  user_id?: string | null
  avatar_url?: string | null
  celula_nome?: string | null
  celula_papel?: string | null
  nome: string
  telefone: string
  email: string
  idade: number | null
  estado_civil: string | null
  tem_filhos: boolean | null
  filhos_detalhes: string | null
  bairro: string | null
  tipo_membro: string | null
  melhor_dia: string | null
  status: string
  criado_em: string
  lider_encaminhado_id: string | null
  celula_id?: string | null
  user_id?: string | null
  conjuge_nome?: string | null
  conjuge_telefone?: string | null
  conjuge_idade?: number | null
}

interface Lider {
  id: string
  nome: string
}

interface Props {
  solicitacoes: Solicitacao[]
  lideres: Lider[]
  podeConfirmar?: boolean
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente:    { label: 'Pendente',    className: 'bg-yellow-100 text-yellow-700' },
  encaminhado: { label: 'Encaminhado', className: 'bg-blue-100 text-blue-700' },
  atendido:    { label: 'Atendido',    className: 'bg-green-100 text-green-700' },
}

function whatsappLink(telefone: string, nome: string) {
  const num = telefone.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`
  const msg = encodeURIComponent(
    `Ola ${nome}! Recebemos sua solicitacao de participar de uma celula da nossa igreja. Vamos te indicar a melhor opcao para voce.`
  )
  return `https://wa.me/${full}?text=${msg}`
}

function SolicitacaoCard({ sol, lideres, podeConfirmar }: { sol: Solicitacao; lideres: Lider[]; podeConfirmar?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [liderSel, setLiderSel] = useState(sol.lider_encaminhado_id ?? '')
  const [isPending, startTransition] = useTransition()
  const status = statusConfig[sol.status] ?? statusConfig.pendente

  const liderAtual = lideres.find((l) => l.id === sol.lider_encaminhado_id)

  function handleEncaminhar() {
    if (!liderSel) return
    startTransition(async () => {
      await encaminharSolicitacaoAction(sol.id, liderSel)
    })
  }

  function handleConfirmar() {
    startTransition(async () => { await confirmarMembroCelulaAction(sol.id) })
  }

  function handleAtendido() {
    startTransition(async () => {
      await marcarAtendidoAction(sol.id)
    })
  }

  async function compartilhar() {
    const texto = [
      `Pedido de célula — ${sol.nome}`,
      `Telefone: ${sol.telefone}`, `E-mail: ${sol.email}`,
      sol.idade ? `Idade: ${sol.idade} anos` : '', sol.estado_civil ? `Estado civil: ${sol.estado_civil}` : '',
      sol.bairro ? `Bairro: ${sol.bairro}` : '', sol.tipo_membro ? `Tipo: ${sol.tipo_membro}` : '',
      sol.melhor_dia ? `Melhor dia: ${sol.melhor_dia}` : '', sol.tem_filhos ? `Filhos: ${sol.filhos_detalhes || 'Sim'}` : 'Filhos: Não',
      sol.conjuge_nome ? `Cônjuge: ${sol.conjuge_nome} — ${sol.conjuge_telefone || 'sem telefone'}` : '',
    ].filter(Boolean).join('\n')
    if (navigator.share) await navigator.share({ title: `Pedido de célula — ${sol.nome}`, text: texto })
    else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <Card>
      <CardContent className="py-3 px-4">
        {/* Header — a foto grande facilita reconhecer rapidamente quem pediu. */}
        <div className="flex items-start justify-between gap-3">
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
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">Pedido de participação em célula</p>
            {sol.celula_nome && <p className="mb-1 text-xs font-semibold text-emerald-700">Já participa da célula: {sol.celula_nome} · {sol.celula_papel === 'visitante' ? 'Visitante' : 'Membro'}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">{sol.nome}</p>
              {sol.tipo_membro && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Na célula: {sol.tipo_membro.charAt(0).toUpperCase() + sol.tipo_membro.slice(1)}
                </span>
              )}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(sol.criado_em), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {sol.bairro && ` · ${sol.bairro}`}
              {sol.melhor_dia && ` · ${sol.melhor_dia}`}
            </p>
            {liderAtual && (
              <p className="text-xs text-blue-600 mt-0.5">Encaminhado para: {liderAtual.nome.split(' ')[0]}</p>
            )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={whatsappLink(sol.telefone, sol.nome)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
              WhatsApp
            </a>
            <button type="button" onClick={compartilhar} aria-label="Compartilhar pedido" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
              <Share2 className="h-3.5 w-3.5" /> Compartilhar
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">Telefone: </span>{sol.telefone}</div>
              <div><span className="text-muted-foreground">E-mail: </span>{sol.email}</div>
              {sol.idade && <div><span className="text-muted-foreground">Idade: </span>{sol.idade} anos</div>}
              {sol.estado_civil && <div><span className="text-muted-foreground">Estado civil: </span>{sol.estado_civil}</div>}
              {sol.bairro && <div><span className="text-muted-foreground">Bairro: </span>{sol.bairro}</div>}
              {sol.melhor_dia && <div><span className="text-muted-foreground">Melhor dia: </span>{sol.melhor_dia}</div>}
              <div>
                <span className="text-muted-foreground">Filhos: </span>
                {sol.tem_filhos ? 'Sim' : 'Não'}
              </div>
            </div>
            {sol.tem_filhos && sol.filhos_detalhes && (
              <p className="text-xs"><span className="text-muted-foreground">Detalhes dos filhos: </span>{sol.filhos_detalhes}</p>
            )}

            {/* Casal vai junto para a mesma célula: o contato do cônjuge fica
                à mão de quem for convidar. */}
            {sol.conjuge_nome && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                <p className="font-medium">Cônjuge: {sol.conjuge_nome}</p>
                <p className="text-muted-foreground">
                  {sol.conjuge_telefone ?? 'sem contato'}
                  {sol.conjuge_idade ? ` · ${sol.conjuge_idade} anos` : ''}
                </p>
                {sol.conjuge_telefone && (
                  <a
                    href={whatsappLink(sol.conjuge_telefone, sol.conjuge_nome)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-green-700 font-medium"
                  >
                    <WhatsAppIcon className="h-3 w-3" />
                    Chamar no WhatsApp
                  </a>
                )}
              </div>
            )}

            {/* Encaminhar section */}
            {sol.status !== 'atendido' && (
              <div className="flex items-center gap-2 pt-1">
                <select
                  className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-ring"
                  value={liderSel}
                  onChange={(e) => setLiderSel(e.target.value)}
                >
                  <option value="">Encaminhar para líder...</option>
                  {lideres.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!liderSel || isPending}
                  onClick={handleEncaminhar}
                  className="text-xs shrink-0"
                >
                  Encaminhar
                </Button>
                {podeConfirmar && sol.status !== 'atendido' && sol.tipo_membro === 'membro' && sol.celula_id && sol.user_id && (
                  <Button size="sm" disabled={isPending} onClick={handleConfirmar} className="text-xs shrink-0 bg-emerald-600 text-white hover:bg-emerald-700">
                    Confirmar membro
                  </Button>
                )}
                {sol.status === 'encaminhado' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={handleAtendido}
                    className="text-xs shrink-0 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    Atendido
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SolicitacoesPanel({ solicitacoes, lideres, podeConfirmar = false }: Props) {
  const pendentes = solicitacoes.filter((s) => s.status === 'pendente')
  const encaminhados = solicitacoes.filter((s) => s.status === 'encaminhado')
  const atendidos = solicitacoes.filter((s) => s.status === 'atendido')
  const [mostrarAtendidos, setMostrarAtendidos] = useState(false)

  if (solicitacoes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Users className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma solicitação de célula</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {[...pendentes, ...encaminhados].map((s) => (
        <SolicitacaoCard key={s.id} sol={s} lideres={lideres} podeConfirmar={podeConfirmar} />
      ))}

      {atendidos.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setMostrarAtendidos((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {mostrarAtendidos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {atendidos.length} atendido{atendidos.length > 1 ? 's' : ''}
          </button>
          {mostrarAtendidos && atendidos.map((s) => (
            <SolicitacaoCard key={s.id} sol={s} lideres={lideres} podeConfirmar={podeConfirmar} />
          ))}
        </>
      )}
    </div>
  )
}

