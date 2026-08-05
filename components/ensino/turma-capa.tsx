'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, GraduationCap } from 'lucide-react'
import { atualizarCapaTurmaAction } from '@/app/actions/ensino/aparencia'
import { comprimirImagem } from '@/lib/comprimir-imagem'

interface Props {
  turmaId: string
  nome: string
  cursoNome: string
  capaUrl: string | null
  canEdit: boolean
}

/**
 * Topo da página da turma.
 *
 * Sem capa cai no bloco em degradê, o mesmo do resto do módulo — assim uma
 * turma recém-criada não abre com um buraco cinza no lugar da arte.
 */
export function TurmaCapa({ turmaId, nome, cursoNome, capaUrl, canEdit }: Props) {
  const [capa, setCapa] = useState(capaUrl)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

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
        setCapa(await atualizarCapaTurmaAction(turmaId, fd))
      } catch (err) {
        setCapa(anterior)
        setErro(err instanceof Error ? err.message : 'Erro ao enviar a capa')
      }
    })
  }

  return (
    <div className="space-y-1.5">
      {capa ? (
        <div className="relative rounded-2xl overflow-hidden shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capa} alt={nome} className="w-full aspect-[16/9] object-cover" />
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
            {isPending ? 'Enviando...' : capa ? 'Trocar capa' : 'Adicionar capa'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={enviar}
          />
        </div>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
