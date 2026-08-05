'use client'

import { useState, useTransition } from 'react'
import { Plus, LayoutGrid, Video, Image as ImageIcon, Link2, ClipboardList } from 'lucide-react'
import { adicionarSecaoAction, type TipoSecao } from '@/app/actions/evento-secoes'

const OPCOES: { tipo: TipoSecao; rotulo: string; icone: typeof LayoutGrid }[] = [
  { tipo: 'cards', rotulo: 'Opções com foto e valor', icone: LayoutGrid },
  { tipo: 'botoes', rotulo: 'Botões com link', icone: Link2 },
  { tipo: 'video', rotulo: 'Vídeo', icone: Video },
  { tipo: 'fotos', rotulo: 'Galeria de fotos', icone: ImageIcon },
  { tipo: 'inscricao', rotulo: 'Inscrição', icone: ClipboardList },
]

/**
 * Adiciona uma seção nova ao fim da página. Existe para que remover uma seção
 * não seja um caminho sem volta.
 */
export function AdicionarSecao({ eventoId }: { eventoId: string }) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function adicionar(tipo: TipoSecao) {
    setErro(null)
    startTransition(async () => {
      try {
        await adicionarSecaoAction(eventoId, tipo)
        setAberto(false)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao adicionar')
      }
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar seção
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">Que tipo de seção?</p>
      <div className="flex flex-wrap gap-1.5">
        {OPCOES.map(({ tipo, rotulo, icone: Icone }) => (
          <button
            key={tipo}
            type="button"
            disabled={isPending}
            onClick={() => adicionar(tipo)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40"
          >
            <Icone className="h-3.5 w-3.5" />
            {rotulo}
          </button>
        ))}
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <button
        type="button"
        onClick={() => setAberto(false)}
        disabled={isPending}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        Cancelar
      </button>
    </div>
  )
}
