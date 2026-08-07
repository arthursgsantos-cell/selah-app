'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditorTexto } from '@/components/shared/editor-texto'
import { salvarDescricaoAulaAction } from '@/app/actions/ensino/aulas'
import { textoRicoParaHtml } from '@/lib/texto-rico'
import { PAINEL } from '@/lib/estilos'

/**
 * O conteúdo escrito da aula, editável na própria página.
 *
 * Fica aqui, e não só no formulário de "editar aula", porque escrever um
 * artigo é um trabalho de idas e voltas: o professor escreve, olha como ficou
 * na página do aluno e ajusta. Obrigá-lo a ir até a tela de gestão, abrir um
 * diálogo e voltar para conferir quebrava esse ciclo.
 *
 * Quem não leciona nem vê o botão — e quando não há texto nenhum, o bloco
 * inteiro some para o aluno em vez de anunciar uma seção vazia.
 */
export function AulaDescricao({
  aulaId,
  descricao: inicial,
  podeEditar,
}: {
  aulaId: string
  descricao: string | null
  podeEditar: boolean
}) {
  const router = useRouter()
  const [descricao, setDescricao] = useState(inicial ?? '')
  const [rascunho, setRascunho] = useState(inicial ?? '')
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function salvar() {
    setErro(null)
    startTransition(async () => {
      const r = await salvarDescricaoAulaAction(aulaId, rascunho)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setDescricao(rascunho.trim())
      setEditando(false)
      router.refresh()
    })
  }

  if (!descricao && !podeEditar) return null

  if (editando) {
    return (
      <div className={`${PAINEL} space-y-3`}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Conteúdo da aula
        </p>
        <EditorTexto
          value={rascunho}
          onChange={setRascunho}
          minRows={14}
          placeholder={
            'Escreva a aula aqui.\n\n# Um título de seção\n\nO texto do parágrafo.\n\n- Um ponto\n- Outro ponto\n\n> "Porque Deus amou o mundo de tal maneira..." — João 3.16'
          }
        />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={salvar} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Salvar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRascunho(descricao)
              setEditando(false)
              setErro(null)
            }}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  if (!descricao) {
    return (
      <button
        type="button"
        onClick={() => {
          setRascunho('')
          setEditando(true)
        }}
        className="w-full rounded-2xl border border-dashed border-border py-8 text-center hover:bg-accent/40 transition-colors"
      >
        <FileText className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
        <span className="block text-sm font-medium">Escrever o conteúdo desta aula</span>
        <span className="block text-xs text-muted-foreground mt-0.5 max-w-xs mx-auto">
          Texto, títulos, listas e citações — o que o aluno lê junto com o vídeo.
        </span>
      </button>
    )
  }

  return (
    <div className={`${PAINEL} space-y-3`}>
      <div
        className="texto-rico"
        dangerouslySetInnerHTML={{ __html: textoRicoParaHtml(descricao) }}
      />
      {podeEditar && (
        <button
          type="button"
          onClick={() => {
            setRascunho(descricao)
            setEditando(true)
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Editar conteúdo
        </button>
      )}
    </div>
  )
}
