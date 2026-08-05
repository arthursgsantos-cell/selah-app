'use client'

import { useState, useTransition } from 'react'
import { Users, Pencil, Check, X, TriangleAlert, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { salvarPlanilhaInscricoesAction, salvarPastaComprovantesAction } from '@/app/actions/evento-pagina'

interface Props {
  eventoId: string
  planilhaUrl: string | null
  /** Pasta do Drive com os comprovantes, exibida no acompanhamento. */
  pastaComprovantesUrl: string | null
  /** Slug ou id, para montar o link de acompanhamento. */
  eventoSlug: string
  /** Contagem já lida no servidor. Nulo = planilha ilegível. */
  inscricoes: number | null
  pessoas: number | null
  canEdit: boolean
}

/**
 * Inscritos vindos da planilha de respostas do formulário.
 *
 * Com inscrição por link, ninguém passa pelo app — o contador interno mostra
 * sempre um número menor que o real. A planilha de respostas é a fonte.
 * `pessoas` conta titular + cônjuge e ignora os filhos.
 */
export function InscritosPlanilha({
  eventoId,
  planilhaUrl,
  pastaComprovantesUrl,
  eventoSlug,
  inscricoes,
  pessoas,
  canEdit,
}: Props) {
  const [url, setUrl] = useState(planilhaUrl ?? '')
  const [pasta, setPasta] = useState(pastaComprovantesUrl ?? '')
  const [rascunho, setRascunho] = useState('')
  const [rascunhoPasta, setRascunhoPasta] = useState('')
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [isPending, startTransition] = useTransition()

  function salvar() {
    setErro(null)
    const valor = rascunho
    const valorPasta = rascunhoPasta
    startTransition(async () => {
      try {
        await salvarPlanilhaInscricoesAction(eventoId, valor)
        await salvarPastaComprovantesAction(eventoId, valorPasta)
        setUrl(valor.trim())
        setPasta(valorPasta.trim())
        setEditando(false)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  /** Link único para colar no fim do formulário: quem identifica é a sessão. */
  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/minha-inscricao/${eventoSlug}`
      )
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* clipboard bloqueado */
    }
  }

  const temContagem = pessoas !== null && pessoas > 0

  if (!canEdit && !temContagem) return null

  return (
    <div className="space-y-1.5">
      {temContagem && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium text-foreground">{pessoas}</span>{' '}
            {pessoas === 1 ? 'inscrito' : 'inscritos'}
            {inscricoes !== null && inscricoes !== pessoas && (
              <span className="text-xs"> · {inscricoes} {inscricoes === 1 ? 'ficha' : 'fichas'}</span>
            )}
          </span>
        </p>
      )}

      {canEdit && url && pessoas === null && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
          Não consegui ler a planilha. Confirme que ela está publicada na web em
          Arquivo → Compartilhar → Publicar na web.
        </p>
      )}

      {canEdit && !editando && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { setRascunho(url); setRascunhoPasta(pasta); setEditando(true) }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
            {url ? 'Trocar planilha de inscritos' : 'Ligar planilha de inscritos'}
          </button>

          {url && (
            <button
              type="button"
              onClick={copiarLink}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {copiado ? <Check className="h-3 w-3 text-green-600" /> : <Link2 className="h-3 w-3" />}
              {copiado ? 'Link copiado' : 'Copiar link de acompanhamento'}
            </button>
          )}
        </div>
      )}

      {canEdit && editando && (
        <div className="space-y-2 rounded-xl border border-border bg-muted p-3">
          <Input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml"
            className="h-9 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            No Google Forms: aba <strong>Respostas</strong> → <strong>Vincular a uma planilha</strong>.
            Na planilha: <strong>Arquivo → Compartilhar → Publicar na web</strong> e cole o link aqui.
            Contamos o titular e o cônjuge de cada ficha; filhos não entram na conta.
          </p>

          <Input
            value={rascunhoPasta}
            onChange={(e) => setRascunhoPasta(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/... (comprovantes)"
            className="h-9 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Pasta dos comprovantes no Drive — opcional. Aparece na página de acompanhamento
            de quem se inscreveu.
          </p>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={isPending} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={isPending}>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
