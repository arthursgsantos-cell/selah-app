'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Check, ChevronDown, ChevronRight, ExternalLink, Pencil, X } from 'lucide-react'
import { upsertEscalaPrevistaAction } from '@/app/actions/encontro'
import { FUNCOES_ESCALA, FUNCAO_CONFIG } from '@/lib/escala-funcoes'
import { CalendarioMes, SeletorVisao, type VisaoCalendario } from '@/components/shared/calendario-mes'
import { dataLocalIso } from '@/lib/dia-semana'
import {
  isoParaDateLocal,
  type DataCalendario,
  type EscalaCalendario,
} from '@/lib/calendario-celula'
import type { FuncaoEscala } from '@/lib/supabase/types'

interface Membro {
  user_id: string
  nome: string
}

interface Props {
  celulaId: string
  datas: DataCalendario[]
  escalas: EscalaCalendario[]
  membros: Membro[]
  canEdit: boolean
}

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export function CalendarioCelulaTab({ celulaId, datas, escalas, membros, canEdit }: Props) {
  const [isPending, startTransition] = useTransition()
  // A lista é o padrão aqui: quem cuida de uma célula só pensa nas próximas
  // datas. A grade do mês fica a um clique para quem prefere ver o mês inteiro.
  const [visao, setVisao] = useState<VisaoCalendario>('lista')
  const [aberta, setAberta] = useState<string | null>(datas[0]?.data ?? null)
  const [editando, setEditando] = useState<{ data: string; funcao: FuncaoEscala } | null>(null)
  const [selecionado, setSelecionado] = useState('')

  // Busca rápida: "AAAA-MM-DD|funcao" → escala
  const porChave = new Map(escalas.map((e) => [`${e.data}|${e.funcao}`, e]))
  const hoje = dataLocalIso(new Date())

  function preenchidasDe(data: string) {
    return FUNCOES_ESCALA.filter((f) => porChave.get(`${data}|${f}`)?.responsavel_id)
  }

  function salvar(data: string, funcao: FuncaoEscala) {
    startTransition(async () => {
      await upsertEscalaPrevistaAction(celulaId, data, funcao, selecionado || null)
      setEditando(null)
      setSelecionado('')
    })
  }

  /** Corpo da data: a escala das posições e o atalho para o encontro. */
  function painelEscala(d: DataCalendario) {
    return (
      <div className="border-t border-border px-3 py-2 space-y-1.5 bg-muted/20">
        {FUNCOES_ESCALA.map((funcao) => {
          const cfg = FUNCAO_CONFIG[funcao]
          const escala = porChave.get(`${d.data}|${funcao}`)
          const isEditando = editando?.data === d.data && editando?.funcao === funcao

          return (
            <div key={funcao} className="flex items-center gap-2.5 min-h-8">
              <span className="text-base w-6 shrink-0 text-center">{cfg.emoji}</span>
              <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">
                {cfg.label}
              </span>

              {isEditando ? (
                <div className="flex items-center gap-1 flex-1">
                  <select
                    value={selecionado}
                    onChange={(e) => setSelecionado(e.target.value)}
                    className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
                    autoFocus
                  >
                    <option value="">Ninguém</option>
                    {membros.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.nome}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => salvar(d.data, funcao)}
                    disabled={isPending}
                    className="text-green-600 hover:text-green-700 p-0.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setEditando(null); setSelecionado('') }}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className={`text-xs truncate ${escala?.responsavel_nome ? '' : 'text-muted-foreground/60'}`}>
                    {escala?.responsavel_nome ?? 'Livre'}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditando({ data: d.data, funcao })
                        setSelecionado(escala?.responsavel_id ?? '')
                      }}
                      className="text-muted-foreground/50 hover:text-foreground shrink-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {d.encontroId && (
          <div className="pt-1.5">
            <Button
              size="xs"
              variant="outline"
              render={<Link href={`/encontro/${d.encontroId}`} />}
            >
              <ExternalLink className="h-3 w-3" />
              Abrir encontro
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (datas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Defina o dia da semana da célula para o calendário projetar as próximas datas.
      </p>
    )
  }

  const daSelecionada = datas.find((d) => d.data === aberta) ?? null

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground px-0.5">
          Escale as próximas datas mesmo antes do encontro ser criado — quando ele for
          agendado, a escala vai junto automaticamente.
        </p>
        <SeletorVisao visao={visao} onTrocar={setVisao} />
      </div>

      {visao === 'mes' ? (
        <div className="space-y-2">
          <CalendarioMes
            hoje={hoje}
            selecionada={aberta}
            onSelecionar={setAberta}
            dias={datas.map((d) => {
              const qtd = preenchidasDe(d.data).length
              return {
                data: d.data,
                confirmado: Boolean(d.encontroId),
                selo: qtd > 0 ? String(qtd) : undefined,
              }
            })}
          />

          {daSelecionada && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2.5">
                <p className="text-sm font-medium leading-tight capitalize">
                  {format(isoParaDateLocal(daSelecionada.data), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {daSelecionada.encontroId
                    ? (daSelecionada.local ?? 'Encontro agendado')
                    : 'Ainda sem encontro criado'}
                </p>
              </div>
              {painelEscala(daSelecionada)}
            </div>
          )}
        </div>
      ) : (
        datas.map((d) => {
          const dia = isoParaDateLocal(d.data)
          const expandida = aberta === d.data
          const preenchidas = preenchidasDe(d.data)

          return (
            <div key={d.data} className="rounded-xl border border-border overflow-hidden">
              {/* Cabeçalho da data */}
              <button
                type="button"
                onClick={() => setAberta(expandida ? null : d.data)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                {expandida
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {format(dia, "EEE, d 'de' MMM", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.encontroId
                      ? (d.local ?? 'Encontro agendado')
                      : 'Ainda sem encontro criado'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {preenchidas.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {preenchidas.slice(0, 3).map((f) => {
                        const e = porChave.get(`${d.data}|${f}`)!
                        return (
                          <Avatar key={f} className="h-5 w-5 border border-background">
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {iniciais(e.responsavel_nome ?? '?')}
                            </AvatarFallback>
                          </Avatar>
                        )
                      })}
                    </div>
                  )}
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {preenchidas.length}/{FUNCOES_ESCALA.length}
                  </span>
                </div>
              </button>

              {/* Escala da data */}
              {expandida && painelEscala(d)}
            </div>
          )
        })
      )}
    </div>
  )
}
