'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TipoEvento } from '@/lib/supabase/types'
import type { CelulaDestino, DestinoEvento } from '@/app/actions/evento'

const selectClass =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

interface Props {
  idPrefixo: string
  tipo: TipoEvento
  /** A rede já vem do contexto (ex.: formulário aberto dentro da rede). */
  redeFixa?: boolean
  destinos: { redes: DestinoEvento[]; celulas: CelulaDestino[] } | null
  redeId: string
  celulaId: string
  tipoOutro: string
  onRede: (id: string) => void
  onCelula: (id: string) => void
  onTipoOutro: (texto: string) => void
}

/**
 * O que o tipo do evento deixa em aberto: de qual rede, de qual célula, ou —
 * no caso de "outro" — que nome dar a ele.
 *
 * Aparece logo abaixo do tipo porque é continuação da mesma pergunta.
 */
export function DestinoEventoFields({
  idPrefixo,
  tipo,
  redeFixa,
  destinos,
  redeId,
  celulaId,
  tipoOutro,
  onRede,
  onCelula,
  onTipoOutro,
}: Props) {
  if (tipo === 'rede' && !redeFixa) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefixo}-rede`}>Rede</Label>
        <select
          id={`${idPrefixo}-rede`}
          value={redeId}
          onChange={(e) => onRede(e.target.value)}
          className={selectClass}
          disabled={!destinos}
        >
          <option value="">{destinos ? 'Escolha a rede' : 'Carregando...'}</option>
          {destinos?.redes.map((r) => (
            <option key={r.id} value={r.id}>{r.nome}</option>
          ))}
        </select>
        {destinos?.redes.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma rede cadastrada ainda.</p>
        )}
      </div>
    )
  }

  if (tipo === 'celula') {
    const rede = (id: string) => destinos?.redes.find((r) => r.id === id)?.nome
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefixo}-celula`}>Célula</Label>
        <select
          id={`${idPrefixo}-celula`}
          value={celulaId}
          onChange={(e) => onCelula(e.target.value)}
          className={selectClass}
          disabled={!destinos}
        >
          <option value="">{destinos ? 'Escolha a célula' : 'Carregando...'}</option>
          {destinos?.celulas.map((c) => (
            <option key={c.id} value={c.id}>
              {rede(c.rede_id) ? `${c.nome} · ${rede(c.rede_id)}` : c.nome}
            </option>
          ))}
        </select>
        {destinos?.celulas.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma célula ativa cadastrada ainda.</p>
        )}
      </div>
    )
  }

  if (tipo === 'outro') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefixo}-tipo-outro`}>Que tipo de evento é?</Label>
        <Input
          id={`${idPrefixo}-tipo-outro`}
          placeholder="Ex: Vigília, Batismo, Retiro"
          value={tipoOutro}
          onChange={(e) => onTipoOutro(e.target.value)}
          maxLength={40}
        />
        <p className="text-[11px] text-muted-foreground">
          É esse nome que aparece no selo do evento, no lugar de &quot;Outro&quot;.
        </p>
      </div>
    )
  }

  return null
}
