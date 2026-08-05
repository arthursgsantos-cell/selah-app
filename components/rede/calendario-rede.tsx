'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import { FUNCOES_ESCALA, FUNCAO_CONFIG } from '@/lib/escala-funcoes'
import { isoParaDateLocal } from '@/lib/calendario-celula'
import type { FuncaoEscala } from '@/lib/supabase/types'

export interface CelulaNoDia {
  celulaId: string
  celulaNome: string
  local: string | null
  encontroId: string | null
  escalas: { funcao: FuncaoEscala; responsavel_nome: string }[]
}

export interface DiaRede {
  data: string
  celulas: CelulaNoDia[]
}

interface Props {
  dias: DiaRede[]
}

export function CalendarioRede({ dias }: Props) {
  const [aberto, setAberto] = useState<string | null>(dias[0]?.data ?? null)

  if (dias.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhuma célula da rede tem dia da semana definido ainda.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {dias.map((dia) => {
        const expandido = aberto === dia.data
        const agendados = dia.celulas.filter((c) => c.encontroId).length

        return (
          <div key={dia.data} className="rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setAberto(expandido ? null : dia.data)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              {expandido
                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <CalendarDays className="h-4 w-4 text-primary/60 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">
                  {format(isoParaDateLocal(dia.data), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dia.celulas.length} {dia.celulas.length === 1 ? 'célula' : 'células'}
                  {agendados > 0 && ` · ${agendados} com encontro criado`}
                </p>
              </div>
            </button>

            {expandido && (
              <div className="border-t border-border divide-y divide-border/60 bg-muted/20">
                {dia.celulas.map((c) => {
                  const preenchidas = c.escalas.length

                  return (
                    <div key={c.celulaId} className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <Link
                            href={c.encontroId ? `/encontro/${c.encontroId}` : `/celula/${c.celulaId}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {c.celulaNome}
                          </Link>
                          {c.local && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {c.local}
                            </p>
                          )}
                          {!c.encontroId && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              Encontro ainda não criado
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                          {preenchidas}/{FUNCOES_ESCALA.length}
                        </span>
                      </div>

                      {preenchidas === 0 ? (
                        <p className="text-xs text-muted-foreground/60">Ninguém escalado ainda</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.escalas.map((e) => (
                            <span
                              key={e.funcao}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-background border border-border"
                              title={FUNCAO_CONFIG[e.funcao].label}
                            >
                              <span>{FUNCAO_CONFIG[e.funcao].emoji}</span>
                              {e.responsavel_nome.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
