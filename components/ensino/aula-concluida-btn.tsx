'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Circle, Loader2 } from 'lucide-react'
import { marcarAulaConcluidaAction } from '@/app/actions/ensino/progresso'

/**
 * "Marcar como assistida" — o botão que move o progresso de um curso gravado.
 *
 * Só aparece para quem está inscrito. Clicar de novo desmarca: quem apertou por
 * engano não precisa procurar onde desfazer.
 */
export function AulaConcluidaBtn({
  aulaId,
  concluida,
}: {
  aulaId: string
  concluida: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function alternar() {
    setErro(null)
    startTransition(async () => {
      const r = await marcarAulaConcluidaAction({ aulaId, concluida: !concluida })
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={alternar}
        disabled={isPending}
        aria-pressed={concluida}
        className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60 ${
          concluida
            ? 'bg-green-600 text-white hover:opacity-90'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        }`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : concluida ? (
          <Check className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
        {concluida ? 'Aula concluída' : 'Marcar como assistida'}
      </button>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
