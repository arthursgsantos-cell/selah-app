'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, GraduationCap, Undo2 } from 'lucide-react'
import {
  salvarCapaPaginaTurmaAction,
  removerCapaPaginaTurmaAction,
} from '@/app/actions/ensino/aparencia'
import { comprimirImagem } from '@/lib/comprimir-imagem'

interface Props {
  turmaId: string
  nome: string
  cursoNome: string
  /** Card da turma — o retrato que aparece nas listagens. */
  capaUrl: string | null
  /** Capa exclusiva desta página, quando houver. */
  capaPaginaUrl: string | null
  canEdit: boolean
}

/**
 * Topo da página da turma.
 *
 * Usa a capa própria quando existe e cai no card da turma quando não — trocar a
 * capa daqui não altera o card. Sem nenhuma das duas, o bloco em degradê do
 * resto do módulo evita que uma turma recém-criada abra com um buraco cinza.
 */
export function TurmaCapa({ turmaId, nome, cursoNome, capaUrl, capaPaginaUrl, canEdit }: Props) {
  const [capa, setCapa] = useState(capaPaginaUrl)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const exibida = capa ?? capaUrl

  function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const anterior = capa
    setErro(null)
    setCapa(URL.createObjectURL(file))

    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('file', await comprimirImagem(file))
        setCapa(await salvarCapaPaginaTurmaAction(turmaId, fd))
      } catch (err) {
        setCapa(anterior)
        setErro(err instanceof Error ? err.message : 'Erro ao enviar a capa')
      }
    })
  }

  function voltarParaOCard() {
    const anterior = capa
    setCapa(null)
    startTransition(async () => {
      try {
        await removerCapaPaginaTurmaAction(turmaId)
      } catch (err) {
        setCapa(anterior)
        setErro(err instanceof Error ? err.message : 'Erro ao remover a capa')
      }
    })
  }

  return (
    <div className="space-y-1.5">
      {exibida ? (
        <div className="relative rounded-2xl overflow-hidden shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={exibida} alt={nome} className="w-full aspect-[16/9] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              {cursoNome}
            </p>
            <h1 className="text-xl font-bold leading-tight mt-0.5">{nome}</h1>
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0B2447] via-[#19376D] to-[#0F52BA] p-6 text-white shadow-lg">
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }}
          />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                {cursoNome}
              </p>
              <h1 className="text-xl font-bold leading-tight mt-0.5">{nome}</h1>
            </div>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Camera className="h-3 w-3" />
            {isPending
              ? 'Enviando...'
              : capa
                ? 'Trocar capa da página'
                : 'Usar uma capa só para esta página'}
          </button>

          {capa && (
            <button
              type="button"
              disabled={isPending}
              onClick={voltarParaOCard}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Undo2 className="h-3 w-3" />
              Voltar a usar o card
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={enviar}
          />
        </div>
      )}

      {canEdit && !capa && capaUrl && (
        <p className="text-[11px] text-muted-foreground">
          Mostrando o card da turma. Uma capa própria não altera o card.
        </p>
      )}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
