'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { contarConteudoEventoAction, excluirEventoAction } from '@/app/actions/evento'

type Escopo = 'este' | 'este_e_seguintes' | 'todos'

interface Props {
  eventoId: string
  titulo: string
  dataHora: string
  recorrenciaId: string | null
  /** Fecha o diálogo de edição depois de apagar. */
  onExcluido: () => void
}

const ESCOPOS: { valor: Escopo; label: string; desc: string }[] = [
  { valor: 'este', label: 'Apenas este', desc: 'Só esta ocorrência' },
  { valor: 'este_e_seguintes', label: 'Este e os seguintes', desc: 'Mantém as que já passaram' },
  { valor: 'todos', label: 'A série inteira', desc: 'Inclusive as ocorrências passadas' },
]

/**
 * Excluir o evento, de dentro da edição.
 *
 * Mesmo desenho do "Excluir turma" do Ensino: fica no fim do formulário, num
 * bloco à parte, e a confirmação diz o que vai junto em vez de perguntar "tem
 * certeza?". A contagem só é buscada quando a pessoa clica — não faz sentido
 * consultar inscrições de todo evento que alguém abre para corrigir o horário.
 *
 * Num evento recorrente, apagar sem escolher o alcance seria uma armadilha:
 * "este e os seguintes" é o que quase sempre se quer, e "a série inteira"
 * levaria junto as ocorrências já realizadas.
 */
export function ExcluirEventoPainel({
  eventoId, titulo, dataHora, recorrenciaId, onExcluido,
}: Props) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [escopo, setEscopo] = useState<Escopo>(recorrenciaId ? 'este_e_seguintes' : 'este')
  const [conteudo, setConteudo] = useState<{ inscricoes: number; pagamentos: number; naSerie: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [apagando, iniciar] = useTransition()

  useEffect(() => {
    if (!confirmando || conteudo) return
    let cancelado = false
    contarConteudoEventoAction(eventoId, recorrenciaId).then((r) => {
      if (!cancelado) setConteudo(r)
    })
    return () => { cancelado = true }
  }, [confirmando, conteudo, eventoId, recorrenciaId])

  function excluir() {
    setErro(null)
    iniciar(async () => {
      const r = await excluirEventoAction(eventoId, dataHora, recorrenciaId, escopo)
      if (!r.ok) { setErro(r.erro); return }
      onExcluido()
      router.refresh()
    })
  }

  const leva = conteudo
    ? [
        conteudo.inscricoes > 0 &&
          `${conteudo.inscricoes} ${conteudo.inscricoes === 1 ? 'inscrição' : 'inscrições'}`,
        conteudo.pagamentos > 0 &&
          `${conteudo.pagamentos} ${conteudo.pagamentos === 1 ? 'pagamento lançado' : 'pagamentos lançados'}`,
      ].filter((x): x is string => typeof x === 'string')
    : []

  if (!confirmando) {
    return (
      <div className="border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirmando(true)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir evento
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm">
        Excluir <strong>{titulo}</strong>
        {conteudo === null ? (
          <span className="text-muted-foreground"> — conferindo o que vai junto…</span>
        ) : leva.length > 0 ? (
          <> apaga junto {leva.join(' e ')}. Não dá para desfazer.</>
        ) : (
          <> — ainda não tem nenhuma inscrição. Não dá para desfazer.</>
        )}
      </p>

      {recorrenciaId && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Este evento faz parte de uma série
            {conteudo && conteudo.naSerie > 0 && ` de ${conteudo.naSerie} ocorrências`}. O que apagar?
          </p>
          {ESCOPOS.map((o) => (
            <label
              key={o.valor}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-input bg-background px-2.5 py-1.5"
            >
              <input
                type="radio"
                name="escopo-exclusao"
                checked={escopo === o.valor}
                onChange={() => setEscopo(o.valor)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-destructive"
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium">{o.label}</span>
                <span className="block text-[11px] text-muted-foreground">{o.desc}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={excluir}
          disabled={apagando || conteudo === null}
        >
          {apagando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {apagando ? 'Excluindo…' : 'Excluir mesmo assim'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setConfirmando(false); setErro(null) }}
          disabled={apagando}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
