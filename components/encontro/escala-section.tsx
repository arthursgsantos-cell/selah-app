'use client'

import { useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { upsertEscalaAction, updateEncontroAction } from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Pencil, Check, X, FileText, ExternalLink, Heart } from 'lucide-react'
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
  com_conjuge: boolean
}

interface ResumoDisponivel {
  id: string
  titulo: string
  conteudo: string | null
  pdf_url: string | null
  data_culto: string
}

interface Props {
  encontroId: string
  escalas: EscalaItem[]
  membros: Membro[]
  canEdit: boolean
  canSeeEdificacaoResumo: boolean
  edificacaoResumo: string | null
  resumosDisponiveis: ResumoDisponivel[]
  resumoCultoId: string | null
  currentUserId: string
  conjugeNome: string | null
}

function formatDataBr(data_culto: string) {
  try {
    return format(parseISO(data_culto), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
  } catch {
    return data_culto
  }
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
  resumosDisponiveis,
  resumoCultoId,
  currentUserId,
  conjugeNome,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [editFuncao, setEditFuncao] = useState<FuncaoEscala | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [editComConjuge, setEditComConjuge] = useState(false)
  const [editResumo, setEditResumo] = useState(false)
  const [selectedResumoId, setSelectedResumoId] = useState<string>(resumoCultoId ?? '')

  function startEdit(escala: EscalaItem) {
    setEditFuncao(escala.funcao)
    setSelectedId(escala.responsavel_id ?? '')
    setEditComConjuge(escala.com_conjuge)
  }

  function saveEscala() {
    if (!editFuncao) return
    startTransition(async () => {
      await upsertEscalaAction(encontroId, editFuncao, selectedId || null, editComConjuge)
      setEditFuncao(null)
    })
  }

  function toggleComConjuge(escala: EscalaItem) {
    startTransition(async () => {
      await upsertEscalaAction(encontroId, escala.funcao, escala.responsavel_id, !escala.com_conjuge)
    })
  }

  function saveResumoVinculado() {
    startTransition(async () => {
      try {
        await updateEncontroAction(encontroId, {
          resumo_culto_id: selectedResumoId || null,
        })
      } catch {
        // coluna resumo_culto_id ainda não existe — seleção fica em memória apenas
      }
      setEditResumo(false)
    })
  }

  const resumoVinculado = resumosDisponiveis.find(
    (r) => r.id === (editResumo ? selectedResumoId : resumoCultoId)
  ) ?? null

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
                  <div className="space-y-1.5">
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
                    {selectedId === currentUserId && conjugeNome && (
                      <label className="flex items-center gap-2 cursor-pointer pl-0.5">
                        <input type="checkbox" checked={editComConjuge} onChange={(e) => setEditComConjuge(e.target.checked)} className="h-3.5 w-3.5 rounded accent-primary" />
                        <Heart className="h-3 w-3 text-rose-400" />
                        <span className="text-xs text-muted-foreground">Com {conjugeNome}</span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {escala.responsavel_nome ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {iniciais}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{escala.responsavel_nome}</span>
                        {escala.com_conjuge && conjugeNome && (
                          <span className="text-xs text-rose-500 flex items-center gap-0.5">
                            <Heart className="h-2.5 w-2.5" />{conjugeNome}
                          </span>
                        )}
                        {escala.responsavel_id === currentUserId && conjugeNome && canEdit && (
                          <button onClick={() => toggleComConjuge(escala)} disabled={isPending} className={`flex items-center gap-0.5 transition-colors ${escala.com_conjuge ? 'text-rose-400 hover:text-rose-600' : 'text-muted-foreground/40 hover:text-rose-400'}`} title={escala.com_conjuge ? 'Remover cônjuge' : `Incluir ${conjugeNome}`}>
                            <Heart className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Não definido</span>
                    )}
                    {canEdit && (
                      <button onClick={() => startEdit(escala)} className="text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bloco de Edificação: resumo do pastor */}
            {escala.funcao === 'edificacao' && canSeeEdificacaoResumo && (
              <div className="mt-2 ml-10 pl-3 border-l-2 border-primary/20">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-primary/70">Roteiro da célula</p>
                  {canEdit && !editResumo && (
                    <button onClick={() => setEditResumo(true)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {editResumo ? (
                  <div className="space-y-2">
                    <select
                      value={selectedResumoId}
                      onChange={(e) => setSelectedResumoId(e.target.value)}
                      className="w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
                    >
                      <option value="">Nenhum</option>
                      {resumosDisponiveis.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.titulo} — {formatDataBr(r.data_culto)}
                        </option>
                      ))}
                    </select>
                    {/* Preview do selecionado */}
                    {selectedResumoId && resumosDisponiveis.find(r => r.id === selectedResumoId) && (
                      <ResumoCard resumo={resumosDisponiveis.find(r => r.id === selectedResumoId)!} />
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveResumoVinculado} disabled={isPending}>
                        {isPending ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setSelectedResumoId(resumoCultoId ?? '')
                        setEditResumo(false)
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : resumoVinculado ? (
                  <ResumoCard resumo={resumoVinculado} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {canEdit ? (
                      <button onClick={() => setEditResumo(true)} className="text-primary/60 hover:text-primary text-xs underline underline-offset-2">
                        Vincular roteiro do pastor
                      </button>
                    ) : 'Nenhum roteiro vinculado'}
                  </p>
                )}

                {/* Texto livre de edificação (para a pessoa de edificação escrever seu resumo) */}
                {!editResumo && (
                  <EdificacaoResumoTexto
                    encontroId={encontroId}
                    edificacaoResumo={edificacaoResumo}
                    canEdit={canEdit}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ResumoCard({ resumo }: { resumo: { titulo: string; conteudo: string | null; pdf_url: string | null; data_culto: string } }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary/60 shrink-0" />
          <span className="text-xs font-semibold text-primary/80 uppercase tracking-wide leading-tight">{resumo.titulo}</span>
        </div>
        {resumo.pdf_url && (
          <a
            href={resumo.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir PDF
          </a>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Culto de {formatDataBr(resumo.data_culto)}</p>
      {resumo.conteudo && (
        <p className="text-xs text-foreground/70 line-clamp-3 whitespace-pre-wrap">{resumo.conteudo}</p>
      )}
    </div>
  )
}

function EdificacaoResumoTexto({
  encontroId,
  edificacaoResumo,
  canEdit,
}: {
  encontroId: string
  edificacaoResumo: string | null
  canEdit: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(edificacaoResumo ?? '')

  function save() {
    startTransition(async () => {
      await updateEncontroAction(encontroId, { edificacao_resumo: val })
      setEditing(false)
    })
  }

  if (!edificacaoResumo && !canEdit) return null

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-primary/70 mb-0.5">Adicione o seu resumo da edificação</p>
      <p className="text-[10px] text-muted-foreground mb-1.5">Visível apenas para membros da célula</p>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Escreva aqui o resumo da mensagem..."
            rows={4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={isPending}>{isPending ? 'Salvando...' : 'Salvar'}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setVal(edificacaoResumo ?? ''); setEditing(false) }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap flex-1">
            {edificacaoResumo || 'Resumo não adicionado ainda'}
          </p>
          {canEdit && (
            <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground shrink-0">
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
