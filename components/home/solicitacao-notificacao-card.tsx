'use client'

import { useState, useTransition } from 'react'
import { Phone, Mail, Calendar, MapPin, CheckCheck } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { marcarAtendidoAction, confirmarMembroCelulaAction } from '@/app/actions/solicitar-celula'

export interface SolicitacaoNotificacao {
  id: string
  nome: string
  telefone: string
  email?: string | null
  bairro?: string | null
  melhor_dia?: string | null
  estado_civil?: string | null
  tem_filhos?: boolean | null
  filhos_detalhes?: string | null
  criado_em: string
  idade?: number | null
  tipo_membro?: string | null
  user_id?: string | null
  status?: string
}

function buildWaLink(sol: SolicitacaoNotificacao) {
  const tel = (sol.telefone ?? '').replace(/\D/g, '')
  const full = tel.startsWith('55') ? tel : `55${tel}`
  const msg = encodeURIComponent(
    `Ola ${sol.nome}! Recebemos sua solicitacao de participar de uma celula da nossa igreja. Vamos te indicar a melhor opcao para voce.`
  )
  return `https://wa.me/${full}?text=${msg}`
}

export function SolicitacaoNotificacaoCard({
  sol,
  showAtendido = true,
  celulas = [],
}: {
  sol: SolicitacaoNotificacao
  showAtendido?: boolean
  celulas?: { id: string; nome: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [celulaSel, setCelulaSel] = useState(celulas[0]?.id ?? '')

  const primeiroNome = sol.nome.split(' ')[0]
  const waLink = buildWaLink(sol)

  function handleAtendido() {
    startTransition(async () => {
      await marcarAtendidoAction(sol.id)
      setOpen(false)
    })
  }

  function handleConfirmarMembro() {
    if (!celulaSel) return
    startTransition(async () => {
      await confirmarMembroCelulaAction(sol.id)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start justify-between gap-3 text-left hover:bg-primary/10 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{sol.nome}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(sol.criado_em), "d 'de' MMM", { locale: ptBR })}
            {sol.bairro && ` · ${sol.bairro}`}
            {sol.melhor_dia && ` · ${sol.melhor_dia}`}
          </p>
          {(sol.estado_civil || sol.tem_filhos) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {sol.estado_civil}
              {sol.tem_filhos ? ' · Com filhos' : ''}
              {sol.filhos_detalhes ? ` (${sol.filhos_detalhes})` : ''}
            </p>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#25D366] text-white shrink-0 pointer-events-none">
          <WhatsAppIcon className="h-3.5 w-3.5" />
          Falar com {primeiroNome}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{sol.nome}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Solicitação em{' '}
              {format(new Date(sol.criado_em), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Contato */}
            <section>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                Contato
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{sol.telefone}</span>
                </div>
                {sol.email && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{sol.email}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Perfil pessoal */}
            <section>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                Perfil
              </p>
              <div className="grid grid-cols-2 gap-2">
                {sol.idade && (
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                      Idade
                    </p>
                    <p className="font-semibold text-sm">{sol.idade} anos</p>
                  </div>
                )}
                {sol.estado_civil && (
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                      Estado civil
                    </p>
                    <p className="font-semibold text-sm">{sol.estado_civil}</p>
                  </div>
                )}
                {sol.tipo_membro && (
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                      Tipo
                    </p>
                    <p className="font-semibold text-sm capitalize">{sol.tipo_membro}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Filhos */}
            {sol.tem_filhos && (
              <section>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                  Filhos
                </p>
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="font-semibold text-sm">
                    {sol.filhos_detalhes || 'Tem filhos'}
                  </p>
                </div>
              </section>
            )}

            {/* Preferência de célula */}
            <section>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                Preferência de célula
              </p>
              <div className="space-y-2">
                {sol.bairro && (
                  <div className="rounded-xl bg-muted/60 p-3 flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                        Endereço / Bairro
                      </p>
                      <p className="font-semibold text-sm">{sol.bairro}</p>
                    </div>
                  </div>
                )}
                {sol.melhor_dia && (
                  <div className="rounded-xl bg-muted/60 p-3 flex items-start gap-2.5">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                        Melhor dia
                      </p>
                      <p className="font-semibold text-sm">{sol.melhor_dia}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Ações */}
            <div className="flex flex-col gap-2 pt-1">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#20bb5a] transition-colors"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Falar com {primeiroNome}
              </a>
              {showAtendido && sol.status !== 'atendido' && sol.tipo_membro === 'membro' && sol.user_id && celulas.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800">Confirmar participação na célula</p>
                  <Button size="sm" onClick={handleConfirmarMembro} disabled={isPending || !celulaSel} className="w-full bg-emerald-600 text-white hover:bg-emerald-700">Confirmar membro da célula</Button>
                </div>
              )}
              {showAtendido && sol.status !== 'atendido' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAtendido}
                  disabled={isPending}
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  {isPending ? 'Marcando...' : 'Marcar como atendido'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

