'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, LayoutGrid, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { atualizarSecoesHomeAction } from '@/app/actions/home-secoes'
import {
  SECAO_LABELS, SECAO_TEM_TEXTO, type SecaoHomeId, type TextosSecoes,
} from '@/lib/home-secoes'

interface Props {
  ordemInicial: SecaoHomeId[]
  textosInicial: TextosSecoes
}

/**
 * Reordenar e renomear os cartões institucionais da home, direto da tela.
 *
 * Setas para cima/baixo em vez de arrastar: no celular, arrastar uma lista
 * curta de quatro itens é mais cauteloso que preciso — um toque errado troca
 * duas linhas sem querer. Com botão, a intenção é explícita.
 */
export function SecoesHomeDialog({ ordemInicial, textosInicial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [ordem, setOrdem] = useState<SecaoHomeId[]>(ordemInicial)
  const [textos, setTextos] = useState<TextosSecoes>(textosInicial)
  const [salvando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function mover(indice: number, direcao: -1 | 1) {
    setOrdem((atual) => {
      const destino = indice + direcao
      if (destino < 0 || destino >= atual.length) return atual
      const nova = [...atual]
      ;[nova[indice], nova[destino]] = [nova[destino], nova[indice]]
      return nova
    })
  }

  function setTexto(id: SecaoHomeId, campo: 'titulo' | 'subtitulo', valor: string) {
    setTextos((atual) => ({ ...atual, [id]: { ...atual[id], [campo]: valor } }))
  }

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await atualizarSecoesHomeAction({ ordem, textos })
      if (!r.sucesso) { setErro(r.erro ?? 'Erro ao salvar'); return }
      setOpen(false)
      router.refresh()
    })
  }

  function cancelar() {
    setOrdem(ordemInicial)
    setTextos(textosInicial)
    setErro(null)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cancelar())}>
      <DialogTrigger
        render={<button type="button" />}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 backdrop-blur px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Seções
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seções da home</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground leading-relaxed -mt-1">
          Ordem dos cartões abaixo da liderança. O restante da página — saudação,
          minha célula, mapa — fica fixo.
        </p>

        <div className="space-y-3">
          {ordem.map((id, i) => (
            <div key={id} className="rounded-xl border border-border p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label={`Subir ${SECAO_LABELS[id]}`}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25 disabled:hover:bg-transparent"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === ordem.length - 1}
                    aria-label={`Descer ${SECAO_LABELS[id]}`}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25 disabled:hover:bg-transparent"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <p className="text-sm font-medium">{SECAO_LABELS[id]}</p>
              </div>

              {SECAO_TEM_TEXTO[id] && (
                <div className="space-y-1.5 pl-8">
                  <Input
                    value={textos[id]?.titulo ?? ''}
                    onChange={(e) => setTexto(id, 'titulo', e.target.value)}
                    placeholder="Título (opcional)"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={textos[id]?.subtitulo ?? ''}
                    onChange={(e) => setTexto(id, 'subtitulo', e.target.value)}
                    placeholder="Subtítulo (opcional)"
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button variant="ghost" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
