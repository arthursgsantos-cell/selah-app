'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2 } from 'lucide-react'
import { alternarDestaqueTurmaAction } from '@/app/actions/ensino/turmas'

/**
 * Liga ou desliga a turma no carrossel da página inicial.
 *
 * Espelha o botão de destaque dos eventos, e as duas coisas caem na mesma
 * faixa da home — para o membro, "destaque" é um conceito só.
 */
export function DestaqueTurmaBtn({
  turmaId,
  destaque,
}: {
  turmaId: string
  destaque: boolean
}) {
  const router = useRouter()
  const [ativo, setAtivo] = useState(destaque)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function alternar() {
    const novo = !ativo
    setAtivo(novo)
    setErro(null)
    startTransition(async () => {
      const r = await alternarDestaqueTurmaAction(turmaId, novo)
      if (!r.ok) {
        setAtivo(!novo)
        setErro(r.erro)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={alternar}
        disabled={isPending}
        aria-pressed={ativo}
        title={ativo ? 'Sair do carrossel da página inicial' : 'Destacar na página inicial'}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          ativo
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-border text-muted-foreground hover:bg-accent'
        }`}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Star className={`h-3.5 w-3.5 ${ativo ? 'fill-amber-400 text-amber-500' : ''}`} />
        )}
        {ativo ? 'Em destaque' : 'Destacar'}
      </button>
      {erro && <span className="text-[11px] text-destructive">{erro}</span>}
    </div>
  )
}
