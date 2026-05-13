'use client'

import { useState, useTransition } from 'react'
import { upsertEscalaAction, updateEncontroAction } from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Pencil, Check, X } from 'lucide-react'
import type { FuncaoEscala } from '@/lib/supabase/types'

interface Membro {
  user_id: string
  nome: string
}

interface EscalaItem {
  funcao: FuncaoEscala
  responsavel_id: string | null
  responsavel_nome: string | null
  observacao: string | null
}

interface Props {
  encontroId: string
  escalas: EscalaItem[]
  membros: Membro[]
  canEdit: boolean
  canSeeEdificacaoResumo: boolean
  edificacaoResumo: string | null
}

const funcaoConfig: Record<FuncaoEscala, { label: string; emoji: string }> = {
  louvor: { label: 'Louvor', emoji: '🎵' },
  quebra_gelo: { label: 'Quebra-gelo', emoji: '🎲' },
  edificacao: { label: 'Edificação', emoji: '📖' },
  compartilhar: { label: 'Compartilhar', emoji: '🤝' },
}

export function EscalaSection({
  encontroId,
  escalas,
  membros,
  canEdit,
  canSeeEdificacaoResumo,
  edificacaoResumo,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [editFuncao, setEditFuncao] = useState<FuncaoEscala | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [editResumo, setEditResumo] = useState(false)
  const [resumoVal, setResumoVal] = useState(edificacaoResumo ?? '')

  function startEdit(escala: EscalaItem) {
    setEditFuncao(escala.funcao)
    setSelectedId(escala.responsavel_id ?? '')
  }

  function saveEscala() {
    if (!editFuncao) return
    startTransition(async () => {
      await upsertEscalaAction(encontroId, editFuncao, selectedId || null)
      setEditFuncao(null)
    })
  }

  function saveResumo() {
    startTransition(async () => {
      await updateEncontroAction(encontroId, { edificacao_resumo: resumoVal })
      setEditResumo(false)
    })
  }

  return (
    <div className="space-y-4">
      {escalas.map((escala) => {
        const config = funcaoConfig[escala.funcao]
        const isEditing = editFuncao === escala.funcao
        const iniciais = escala.responsavel_nome
          ?.split(' ')
          .slice(0, 2)
          .map((n) => n[0])
          .join('')
          .toUpperCase() ?? '?'

        return (
          <div key={escala.funcao}>
            <div className="flex items-center gap-3">
              <span className="text-lg w-7 shrink-0 text-center">{config.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  {config.label}
                </p>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                      className="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <option value="">Ninguém</option>
                      {membros.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                    <Button size="icon" variant="ghost" onClick={saveEscala} disabled={isPending}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditFuncao(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {escala.responsavel_nome ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {iniciais}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{escala.responsavel_nome}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Não definido</span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => startEdit(escala)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {escala.funcao === 'edificacao' && canSeeEdificacaoResumo && (
              <div className="mt-2 ml-10 pl-3 border-l-2 border-primary/20">
                <p className="text-xs font-medium text-primary/70 mb-1">Resumo da edificação</p>
                {editResumo ? (
                  <div className="space-y-2">
                    <Textarea
                      value={resumoVal}
                      onChange={(e) => setResumoVal(e.target.value)}
                      placeholder="Cole aqui o resumo da mensagem do domingo..."
                      rows={4}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveResumo} disabled={isPending}>
                        {isPending ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setResumoVal(edificacaoResumo ?? '')
                          setEditResumo(false)
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap flex-1">
                      {edificacaoResumo || 'Resumo não adicionado ainda'}
                    </p>
                    {canEdit && (
                      <button
                        onClick={() => setEditResumo(true)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
