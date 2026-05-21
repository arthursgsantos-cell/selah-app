'use client'

import { useState, useTransition } from 'react'
import { updateEncontroAction } from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MapPin, Clock, Megaphone, Pencil, Check, X, Navigation, Home } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface MembroAnfitriao {
  user_id: string
  nome: string
  endereco: string | null
  endereco_maps: string | null
}

interface InfoSectionProps {
  encontroId: string
  dataHora: string
  local: string | null
  localMapsUrl: string | null
  avisos: string | null
  canEdit: boolean
  membrosAnfitriao?: MembroAnfitriao[]
}

export function InfoSection({ encontroId, dataHora, local, localMapsUrl: initialMapsUrl, avisos, canEdit, membrosAnfitriao = [] }: InfoSectionProps) {
  const [isPending, startTransition] = useTransition()
  const [editField, setEditField] = useState<'local' | 'data_hora' | 'avisos' | null>(null)
  const [localVal, setLocalVal] = useState(local ?? '')
  const [localMapsUrl, setLocalMapsUrl] = useState<string | null>(initialMapsUrl)
  const [avisosVal, setAvisosVal] = useState(avisos ?? '')

  function isoToPartes(iso: string) {
    const [datePart, timePart] = iso.slice(0, 16).split('T')
    const [yyyy, mm, dd] = datePart.split('-')
    return { data: `${dd}/${mm}/${yyyy}`, hora: timePart ?? '00:00' }
  }
  const partesinit = isoToPartes(dataHora)
  const [dataDigitada, setDataDigitada] = useState(partesinit.data)
  const [horaDigitada, setHoraDigitada] = useState(partesinit.hora)

  function maskData(v: string) {
    const nums = v.replace(/\D/g, '').slice(0, 8)
    if (nums.length <= 2) return nums
    if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`
    return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`
  }

  function maskHora(v: string) {
    const nums = v.replace(/\D/g, '').slice(0, 4)
    if (nums.length <= 2) return nums
    return `${nums.slice(0, 2)}:${nums.slice(2)}`
  }

  function partesToIso() {
    const [dd, mm, yyyy] = dataDigitada.split('/')
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T${horaDigitada}`
  }

  function save(field: 'local' | 'data_hora' | 'avisos') {
    const data =
      field === 'local' ? { local: localVal, local_maps_url: localMapsUrl }
      : field === 'data_hora' ? { data_hora: new Date(partesToIso()).toISOString() }
      : { avisos: avisosVal }

    startTransition(async () => {
      await updateEncontroAction(encontroId, data)
      setEditField(null)
    })
  }

  function cancel(field: 'local' | 'data_hora' | 'avisos') {
    if (field === 'local') { setLocalVal(local ?? ''); setLocalMapsUrl(initialMapsUrl) }
    if (field === 'data_hora') {
      const p = isoToPartes(dataHora)
      setDataDigitada(p.data)
      setHoraDigitada(p.hora)
    }
    if (field === 'avisos') setAvisosVal(avisos ?? '')
    setEditField(null)
  }

  function selecionarAnfitriao(m: MembroAnfitriao) {
    setLocalVal(m.endereco ?? '')
    setLocalMapsUrl(m.endereco_maps ?? null)
  }

  const dataFormatada = format(new Date(dataHora), "EEEE, d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
  const anfitrioes = membrosAnfitriao.filter((m) => m.endereco)

  const effectiveMapsUrl =
    localMapsUrl ??
    (local ? (anfitrioes.find((m) => m.endereco === local)?.endereco_maps ?? null) : null)

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
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                value={dataDigitada}
                onChange={e => setDataDigitada(maskData(e.target.value))}
                className="w-32 h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                value={horaDigitada}
                onChange={e => setHoraDigitada(maskHora(e.target.value))}
                className="w-20 h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
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
            <div className="space-y-2">
              {anfitrioes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {anfitrioes.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => selecionarAnfitriao(m)}
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        localVal === m.endereco
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted border-border hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <Home className="h-3 w-3 shrink-0" />
                      Casa de {m.nome.split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <input
                  value={localVal}
                  onChange={e => { setLocalVal(e.target.value); setLocalMapsUrl(null) }}
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
              {localMapsUrl && (
                <a
                  href={localMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Navigation className="h-3 w-3" />
                  Abrir no Maps
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">{local || 'Não definido'}</p>
              {effectiveMapsUrl && (
                <a
                  href={effectiveMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Navigation className="h-3 w-3" />
                  Maps
                </a>
              )}
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
