'use client'

import { useState } from 'react'
import { BookOpen, CalendarDays, ChevronDown, User } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { BotaoPdf } from '@/components/shared/pdf-dialog'

interface Resumo {
  id: string
  titulo: string
  conteudo: string
  pdf_url: string | null
  data_culto: string
  validade_ate: string
  /** Nome de quem publicou — da planilha ou do perfil de quem usou o app. */
  autor?: string | null
}

interface Props {
  resumos: Resumo[]
  encontroDate: string
}

function isAtivo(resumo: Resumo, date: string): boolean {
  return resumo.data_culto <= date && resumo.validade_ate >= date
}

export function ResumoCultoCard({ resumos, encontroDate }: Props) {
  const defaultResumo =
    resumos.find((r) => isAtivo(r, encontroDate)) ?? resumos[0] ?? null

  const [selecionadoId, setSelecionadoId] = useState(defaultResumo?.id ?? '')
  const [expandido, setExpandido] = useState(false)

  const resumo = resumos.find((r) => r.id === selecionadoId) ?? defaultResumo
  if (!resumo) return null

  return (
    <div className="space-y-3">
      {resumos.length > 1 && (
        <div className="relative">
          <select
            value={selecionadoId}
            onChange={(e) => setSelecionadoId(e.target.value)}
            className="w-full h-8 rounded-lg border border-input bg-background pl-2.5 pr-8 py-1 text-sm outline-none focus-visible:border-ring appearance-none"
          >
            {resumos.map((r) => (
              <option key={r.id} value={r.id}>
                {format(parseISO(r.data_culto), 'dd/MM/yyyy')} · {r.titulo}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      )}

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-start gap-2 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-semibold truncate">{resumo.titulo}</p>
          </div>
          {resumo.pdf_url && <BotaoPdf url={resumo.pdf_url} titulo={resumo.titulo} />}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Culto de {format(parseISO(resumo.data_culto), 'dd/MM/yyyy')}
          </span>
          {resumo.autor && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {resumo.autor}
            </span>
          )}
        </div>

        <div>
          <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!expandido ? 'line-clamp-4' : ''}`}>
            {resumo.conteudo}
          </p>
          {resumo.conteudo.length > 250 && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="text-xs text-primary mt-1 hover:underline"
            >
              {expandido ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
