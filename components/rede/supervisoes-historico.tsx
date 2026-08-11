'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Trash2, Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { excluirSupervisaoAction } from '@/app/actions/supervisao'

const POR_PAGINA = 5

export interface SupervisaoRegistrada {
  id: string
  data: string
  redeNome: string
  /** Nulo quando a reunião foi da rede inteira. */
  celulaNome: string | null
  supervisorNome: string | null
  pauta: string | null
  encaminhamentos: string | null
  presentes: string[]
  ausentes: string[]
}

interface Props {
  supervisoes: SupervisaoRegistrada[]
  /** Só quem supervisiona a rede pode apagar. */
  podeExcluir: boolean
}

function Registro({ s, podeExcluir }: { s: SupervisaoRegistrada; podeExcluir: boolean }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, iniciarExclusao] = useTransition()

  const temDetalhe =
    !!s.pauta || !!s.encaminhamentos || s.presentes.length > 0 || s.ausentes.length > 0

  function excluir() {
    iniciarExclusao(async () => {
      await excluirSupervisaoAction(s.id)
      setConfirmando(false)
      router.refresh()
    })
  }

  return (
    <div className="border-b border-border py-2.5 last:border-0">
      <div className="flex items-start gap-3">
        <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {s.celulaNome ?? `${s.redeNome} — a rede toda`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(new Date(`${s.data}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {s.supervisorNome && ` · ${s.supervisorNome.split(' ')[0]}`}
            {s.presentes.length + s.ausentes.length > 0 &&
              ` · ${s.presentes.length} de ${s.presentes.length + s.ausentes.length}`}
          </p>
        </div>

        {podeExcluir && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            aria-label="Apagar registro"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {temDetalhe && (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-label={aberto ? 'Recolher' : 'Ver detalhes'}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {confirmando && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-800">
            Apagar este registro? O indicador de última supervisão volta a contar
            a partir da reunião anterior.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={excluir}
              disabled={excluindo}
              className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              {excluindo ? 'Apagando...' : 'Apagar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={excluindo}
              className="rounded-lg px-2.5 py-1 text-xs text-red-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {aberto && temDetalhe && (
        <div className="mt-2 space-y-2 border-t border-border pt-2 pl-7">
          {s.presentes.length > 0 && (
            <p className="text-xs">
              <span className="text-muted-foreground">Presentes: </span>
              {s.presentes.join(', ')}
            </p>
          )}
          {s.ausentes.length > 0 && (
            <p className="text-xs">
              <span className="text-muted-foreground">Faltaram: </span>
              {s.ausentes.join(', ')}
            </p>
          )}
          {s.pauta && (
            <p className="text-xs">
              <span className="text-muted-foreground">Pauta: </span>
              {s.pauta}
            </p>
          )}
          {s.encaminhamentos && (
            <p className="text-xs">
              <span className="text-muted-foreground">Encaminhamentos: </span>
              {s.encaminhamentos}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** As reuniões já registradas, da mais recente para a mais antiga. */
export function SupervisoesHistorico({ supervisoes, podeExcluir }: Props) {
  const [pagina, setPagina] = useState(0)

  if (supervisoes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Nenhuma supervisão registrada ainda
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Registre a primeira e o painel passa a avisar quando um líder ficar
            tempo demais sem ser visitado.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalPaginas = Math.max(1, Math.ceil(supervisoes.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = supervisoes.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)

  return (
    <Card>
      <CardContent className="px-4 py-2">
        {visiveis.map((s) => (
          <Registro key={s.id} s={s} podeExcluir={podeExcluir} />
        ))}

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between pt-2.5">
            <p className="text-xs text-muted-foreground">
              {paginaAtual * POR_PAGINA + 1}–
              {Math.min((paginaAtual + 1) * POR_PAGINA, supervisoes.length)} de{' '}
              {supervisoes.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual === 0}
                aria-label="Página anterior"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {paginaAtual + 1}/{totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina(paginaAtual + 1)}
                disabled={paginaAtual >= totalPaginas - 1}
                aria-label="Próxima página"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
