'use client'

import { useState, useTransition } from 'react'
import { Check, X, Users, Heart, Baby, UserPlus, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { confirmarPresencaAction, type PresencaItem } from '@/app/actions/presenca'
import type { StatusPresenca } from '@/lib/supabase/types'

interface ConjugeInfo {
  id: string | null
  nome: string | null
}

interface Props {
  encontroId: string
  minhaPresenca: {
    status: StatusPresenca
    com_conjuge: boolean
    com_filhos: boolean
    num_visitantes: number
    observacao: string | null
  } | null
  conjuge: ConjugeInfo | null
  temFilhos: boolean
  presencas: PresencaItem[]
  canSeeAll: boolean
}

export function PresencaSection({ encontroId, minhaPresenca, conjuge, temFilhos, presencas, canSeeAll }: Props) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<StatusPresenca>(minhaPresenca?.status ?? 'pendente')
  const [comConjuge, setComConjuge] = useState(minhaPresenca?.com_conjuge ?? false)
  const [comFilhos, setComFilhos] = useState(minhaPresenca?.com_filhos ?? false)
  const [nomesVisitantes, setNomesVisitantes] = useState<string[]>(() => {
    try { return JSON.parse(minhaPresenca?.observacao ?? '[]') } catch { return [] }
  })
  const [showAll, setShowAll] = useState(false)

  const conjugeNome = conjuge?.nome?.split(' ')[0] ?? null

  function salvar(novoStatus: StatusPresenca, opts?: { comConjuge?: boolean; comFilhos?: boolean; nomes?: string[] }) {
    const s = novoStatus
    const cc = opts?.comConjuge ?? (s === 'confirmado' ? comConjuge : false)
    const cf = opts?.comFilhos ?? (s === 'confirmado' ? comFilhos : false)
    const nomes = opts?.nomes ?? (s === 'confirmado' ? nomesVisitantes : [])

    setStatus(s)
    startTransition(async () => {
      await confirmarPresencaAction(encontroId, s, {
        comConjuge: cc,
        comFilhos: cf,
        nomesVisitantes: nomes,
      })
    })
  }

  function atualizarNomes(nomes: string[]) {
    setNomesVisitantes(nomes)
    salvar('confirmado', { nomes })
  }

  const confirmados = presencas.filter((p) => p.status === 'confirmado')
  const ausentes = presencas.filter((p) => p.status === 'ausente')

  const totalPessoas = confirmados.reduce((acc, p) => {
    let n = 1
    if (p.com_conjuge) n += 1
    if (p.com_filhos) n += 1 // approximate
    n += p.num_visitantes
    return acc + n
  }, 0)

  return (
    <div className="space-y-4">
      {/* Confirmação do usuário */}
      <div className="space-y-3">
        <div className="flex justify-center gap-10">
          {/* Vou estar */}
          <button
            type="button"
            onClick={() => salvar('confirmado')}
            disabled={isPending}
            className="flex flex-col items-center gap-2 group"
          >
            <span className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
              status === 'confirmado'
                ? 'bg-green-500 text-white shadow-md'
                : 'border-2 border-green-400 text-green-500 group-hover:bg-green-50'
            }`}>
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <span className={`text-sm font-medium transition-colors ${
              status === 'confirmado' ? 'text-green-600' : 'text-muted-foreground group-hover:text-green-600'
            }`}>
              Vou estar
            </span>
          </button>

          {/* Não vou */}
          <button
            type="button"
            onClick={() => salvar('ausente')}
            disabled={isPending}
            className="flex flex-col items-center gap-2 group"
          >
            <span className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
              status === 'ausente'
                ? 'bg-red-500 text-white shadow-md'
                : 'border-2 border-red-400 text-red-500 group-hover:bg-red-50'
            }`}>
              <X className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <span className={`text-sm font-medium transition-colors ${
              status === 'ausente' ? 'text-red-600' : 'text-muted-foreground group-hover:text-red-600'
            }`}>
              Não vou
            </span>
          </button>
        </div>

        {status === 'confirmado' && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
            {/* Com cônjuge */}
            {conjugeNome && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={comConjuge}
                  onChange={(e) => {
                    const v = e.target.checked
                    setComConjuge(v)
                    salvar('confirmado', { comConjuge: v, comFilhos })
                  }}
                  className="rounded border-input h-4 w-4 accent-primary"
                />
                <Heart className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="text-sm">Com {conjugeNome}</span>
              </label>
            )}

            {/* Com filhos */}
            {temFilhos && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={comFilhos}
                  onChange={(e) => {
                    const v = e.target.checked
                    setComFilhos(v)
                    salvar('confirmado', { comConjuge, comFilhos: v })
                  }}
                  className="rounded border-input h-4 w-4 accent-primary"
                />
                <Baby className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="text-sm">Com filhos</span>
              </label>
            )}

            {/* Visitantes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <UserPlus className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <span className="text-sm flex-1">Visitantes</span>
                <button
                  type="button"
                  onClick={() => atualizarNomes([...nomesVisitantes, ''])}
                  className="flex items-center gap-1 text-xs text-green-700 font-medium hover:text-green-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>
              {nomesVisitantes.map((nome, i) => (
                <div key={i} className="flex items-center gap-2 pl-6">
                  <input
                    type="text"
                    value={nome}
                    placeholder={`Visitante ${i + 1}`}
                    onChange={(e) => {
                      const novos = [...nomesVisitantes]
                      novos[i] = e.target.value
                      setNomesVisitantes(novos)
                    }}
                    onBlur={() => salvar('confirmado', { nomes: nomesVisitantes })}
                    className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                  />
                  <button
                    type="button"
                    onClick={() => atualizarNomes(nomesVisitantes.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resumo de presenças (para líderes/admins) */}
      {canSeeAll && presencas.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Users className="h-3.5 w-3.5" />
            <span>{confirmados.length} confirmados · {ausentes.length} ausentes · ~{totalPessoas} pessoas</span>
            {showAll ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
          </button>

          {showAll && (
            <div className="rounded-xl border border-border divide-y">
              {confirmados.map((p) => (
                <div key={p.user_id} className="flex items-center gap-2.5 px-3 py-2">
                  <div className="h-6 w-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                    {p.avatar_url ? (
                      <img referrerPolicy="no-referrer" src={p.avatar_url} className="h-full w-full object-cover" alt={p.nome} />
                    ) : p.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                  </div>
                  <span className="text-sm flex-1">{p.nome.split(' ')[0]}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {p.com_conjuge && <Heart className="h-3 w-3 text-rose-400" />}
                    {p.com_filhos && <Baby className="h-3 w-3 text-blue-400" />}
                    {p.num_visitantes > 0 && (
                      <span className="flex items-center gap-0.5">
                        <UserPlus className="h-3 w-3 text-green-500" />{p.num_visitantes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {ausentes.map((p) => (
                <div key={p.user_id} className="flex items-center gap-2.5 px-3 py-2 opacity-50">
                  <div className="h-6 w-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                    {p.avatar_url ? (
                      <img referrerPolicy="no-referrer" src={p.avatar_url} className="h-full w-full object-cover" alt={p.nome} />
                    ) : p.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                  </div>
                  <span className="text-sm flex-1 line-through">{p.nome.split(' ')[0]}</span>
                  <X className="h-3 w-3 text-red-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
