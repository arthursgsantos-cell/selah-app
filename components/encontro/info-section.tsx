'use client'

import { useState, useTransition } from 'react'
import { updateEncontroAction } from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MapPin, Clock, Megaphone, Pencil, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface InfoSectionProps {
  encontroId: string
  dataHora: string
  local: string | null
  avisos: string | null
  canEdit: boolean
}

export function InfoSection({ encontroId, dataHora, local, avisos, canEdit }: InfoSectionProps) {
  const [isPending, startTransition] = useTransition()
  const [editField, setEditField] = useState<'local' | 'data_hora' | 'avisos' | null>(null)
  const [localVal, setLocalVal] = useState(local ?? '')
  const [dataVal, setDataVal] = useState(dataHora.slice(0, 16)) // datetime-local format
  const [avisosVal, setAvisosVal] = useState(avisos ?? '')

  function save(field: 'local' | 'data_hora' | 'avisos') {
    const data =
      field === 'local' ? { local: localVal }
      : field === 'data_hora' ? { data_hora: new Date(dataVal).toISOString() }
      : { avisos: avisosVal }

    startTransition(async () => {
      await updateEncontroAction(encontroId, data)
      setEditField(null)
    })
  }

  function cancel(field: 'local' | 'data_hora' | 'avisos') {
    if (field === 'local') setLocalVal(local ?? '')
    if (field === 'data_hora') setDataVal(dataHora.slice(0, 16))
    if (field === 'avisos') setAvisosVal(avisos ?? '')
    setEditField(null)
  }

  const dataFormatada = format(new Date(dataHora), "EEEE, d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })

  return (
    <div className="space-y-4">
      {/* Data e horário */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Data e horário</p>
          {editField === 'data_hora' ? (
            <div className="flex gap-2 items-center">
              <input
                type="datetime-local"
                value={dataVal}
                onChange={e => setDataVal(e.target.value)}
                className="flex-1 h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <Button size="icon" variant="ghost" onClick={() => save('data_hora')} disabled={isPending}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => cancel('data_hora')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm capitalize">{dataFormatada}</p>
              {canEdit && (
                <button onClick={() => setEditField('data_hora')} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Local */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
          <MapPin className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Local</p>
          {editField === 'local' ? (
            <div className="flex gap-2 items-center">
              <input
                value={localVal}
                onChange={e => setLocalVal(e.target.value)}
                placeholder="Ex: Casa do Pedro"
                className="flex-1 h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <Button size="icon" variant="ghost" onClick={() => save('local')} disabled={isPending}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => cancel('local')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{local || 'Não definido'}</p>
              {canEdit && (
                <button onClick={() => setEditField('local')} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Avisos */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
          <Megaphone className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Avisos</p>
          {editField === 'avisos' ? (
            <div className="space-y-2">
              <Textarea
                value={avisosVal}
                onChange={e => setAvisosVal(e.target.value)}
                placeholder="Avisos gerais para os membros..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => save('avisos')} disabled={isPending}>
                  {isPending ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => cancel('avisos')}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap flex-1">
                {avisos || 'Nenhum aviso'}
              </p>
              {canEdit && (
                <button onClick={() => setEditField('avisos')} className="text-muted-foreground hover:text-foreground shrink-0">
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
