'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Radio, RadioTower } from 'lucide-react'
import { alternarAoVivoAction } from '@/app/actions/pastor'

interface Props {
  ativo: boolean
  /** Sem link cadastrado o botão avisa em vez de ligar uma transmissão vazia. */
  temUrl: boolean
}

/**
 * Ligar/desligar a transmissão com um toque, direto da home.
 *
 * Antes, marcar "no ar" exigia abrir o painel do pastor, achar a seção de
 * culto ao vivo dentro do formulário de edição da igreja e salvar — um
 * caminho longo para algo que se repete todo domingo. Aqui é clicar uma vez.
 *
 * Só aparece para quem já tem o link cadastrado ou já está com a transmissão
 * no ar — cadastrar a URL em si continua sendo tarefa rara, do painel.
 */
export function BotaoAoVivo({ ativo, temUrl }: Props) {
  const router = useRouter()
  const [ligando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function alternar() {
    setErro(null)
    iniciar(async () => {
      const r = await alternarAoVivoAction(!ativo)
      if (!r.sucesso) { setErro(r.erro ?? 'Não foi possível atualizar.'); return }
      router.refresh()
    })
  }

  if (!ativo && !temUrl) return null

  return (
    <div>
      <button
        type="button"
        onClick={alternar}
        disabled={ligando}
        aria-pressed={ativo}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 ${
          ativo
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary'
        }`}
      >
        {ligando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : ativo ? (
          <Radio className="h-4 w-4" />
        ) : (
          <RadioTower className="h-4 w-4" />
        )}
        {ligando
          ? 'Atualizando…'
          : ativo
            ? 'Culto no ar — clique para encerrar'
            : 'Marcar culto como no ar'}
      </button>
      {erro && <p className="mt-1.5 text-center text-xs text-destructive">{erro}</p>}
    </div>
  )
}
