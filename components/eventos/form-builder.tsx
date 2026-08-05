'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import type { CampoFormulario } from '@/lib/supabase/types'
import { candidatosCondicao, candidatosRepeticao } from '@/lib/formulario-condicional'

const TIPOS = [
  { value: 'texto', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone/WhatsApp' },
  { value: 'numero', label: 'Número' },
  { value: 'opcoes', label: 'Múltipla escolha (radio)' },
  { value: 'checkbox', label: 'Caixas de seleção' },
  { value: 'grupo', label: 'Bloco repetido (ex: um por filho)' },
] as const

const selectClass = 'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring'

interface Props {
  campos: CampoFormulario[]
  onChange: (campos: CampoFormulario[]) => void
}

function gerarId() {
  return Math.random().toString(36).slice(2, 9)
}

export function FormBuilder({ campos, onChange }: Props) {
  function adicionarCampo() {
    onChange([...campos, { id: gerarId(), tipo: 'texto', label: '', obrigatorio: false }])
  }

  function removerCampo(id: string) {
    onChange(campos.filter((c) => c.id !== id))
  }

  function atualizarCampo(id: string, patch: Partial<CampoFormulario>) {
    onChange(campos.map((c) => c.id === id ? { ...c, ...patch } : c))
  }

  // ── Subcampos do bloco repetido ──
  function adicionarSubcampo(grupoId: string) {
    onChange(campos.map((c) => c.id !== grupoId ? c : {
      ...c,
      subcampos: [...(c.subcampos ?? []), { id: gerarId(), tipo: 'texto', label: '', obrigatorio: false }],
    }))
  }

  function atualizarSubcampo(grupoId: string, index: number, patch: Partial<CampoFormulario>) {
    onChange(campos.map((c) => c.id !== grupoId ? c : {
      ...c,
      subcampos: (c.subcampos ?? []).map((s, i) => i === index ? { ...s, ...patch } : s),
    }))
  }

  function removerSubcampo(grupoId: string, index: number) {
    onChange(campos.map((c) => c.id !== grupoId ? c : {
      ...c,
      subcampos: (c.subcampos ?? []).filter((_, i) => i !== index),
    }))
  }

  function atualizarOpcao(campoId: string, index: number, valor: string) {
    onChange(campos.map((c) => {
      if (c.id !== campoId) return c
      const opcoes = [...(c.opcoes ?? [])]
      opcoes[index] = valor
      return { ...c, opcoes }
    }))
  }

  function adicionarOpcao(campoId: string) {
    onChange(campos.map((c) => {
      if (c.id !== campoId) return c
      return { ...c, opcoes: [...(c.opcoes ?? []), ''] }
    }))
  }

  function removerOpcao(campoId: string, index: number) {
    onChange(campos.map((c) => {
      if (c.id !== campoId) return c
      const opcoes = (c.opcoes ?? []).filter((_, i) => i !== index)
      return { ...c, opcoes }
    }))
  }

  return (
    <div className="space-y-3">
      {campos.map((campo, i) => (
        <div key={campo.id} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Campo {i + 1}</span>
            <button
              type="button"
              onClick={() => removerCampo(campo.id)}
              className="ml-auto text-destructive hover:text-destructive/80"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Pergunta</Label>
              <Input
                value={campo.label}
                onChange={(e) => atualizarCampo(campo.id, { label: e.target.value })}
                placeholder="Ex: Nome completo"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <select
                value={campo.tipo}
                onChange={(e) => atualizarCampo(campo.id, { tipo: e.target.value as CampoFormulario['tipo'], opcoes: undefined })}
                className={selectClass}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {(campo.tipo === 'opcoes' || campo.tipo === 'checkbox') && (
            <div className="space-y-1.5 pl-1">
              <Label className="text-xs text-muted-foreground">Opções</Label>
              {(campo.opcoes ?? []).map((opt, oi) => (
                <div key={oi} className="flex gap-1.5">
                  <Input
                    value={opt}
                    onChange={(e) => atualizarOpcao(campo.id, oi, e.target.value)}
                    placeholder={`Opção ${oi + 1}`}
                    className="h-7 text-sm flex-1"
                  />
                  <button type="button" onClick={() => removerOpcao(campo.id, oi)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => adicionarOpcao(campo.id)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Adicionar opção
              </button>
            </div>
          )}

          {/* Grupo repetido: quantas vezes, e quais subcampos */}
          {campo.tipo === 'grupo' && (
            <div className="space-y-2 pl-1 border-l-2 border-primary/20 ml-1">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Repetir conforme o campo</Label>
                <select
                  value={campo.repetirPorCampoId ?? ''}
                  onChange={(e) => atualizarCampo(campo.id, { repetirPorCampoId: e.target.value || undefined })}
                  className={selectClass}
                >
                  <option value="">— Escolha um campo numérico —</option>
                  {candidatosRepeticao(campos, i).map((c) => (
                    <option key={c.id} value={c.id}>{c.label || '(sem título)'}</option>
                  ))}
                </select>
                {candidatosRepeticao(campos, i).length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Crie antes um campo do tipo &ldquo;Número&rdquo; (ex: &ldquo;Quantos filhos?&rdquo;).
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Campos de cada repetição</Label>
                {(campo.subcampos ?? []).map((sub, si) => (
                  <div key={sub.id} className="flex gap-1.5">
                    <Input
                      value={sub.label}
                      onChange={(e) => atualizarSubcampo(campo.id, si, { label: e.target.value })}
                      placeholder="Ex: Nome"
                      className="h-7 text-sm flex-1"
                    />
                    <select
                      value={sub.tipo}
                      onChange={(e) => atualizarSubcampo(campo.id, si, { tipo: e.target.value as CampoFormulario['tipo'] })}
                      className="h-7 rounded-lg border border-input bg-background px-1.5 text-xs"
                    >
                      <option value="texto">Texto</option>
                      <option value="numero">Número</option>
                      <option value="email">E-mail</option>
                      <option value="telefone">Telefone</option>
                    </select>
                    <button type="button" onClick={() => removerSubcampo(campo.id, si)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => adicionarSubcampo(campo.id)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Adicionar campo da repetição
                </button>
              </div>
            </div>
          )}

          {/* Condição: só aparece se outro campo tiver certo valor */}
          {candidatosCondicao(campos, i).length > 0 && (
            <div className="space-y-1 pl-1">
              <Label className="text-xs text-muted-foreground">Mostrar só se…</Label>
              <div className="flex gap-1.5">
                <select
                  value={campo.condicao?.campoId ?? ''}
                  onChange={(e) => atualizarCampo(campo.id, {
                    condicao: e.target.value
                      ? { campoId: e.target.value, valores: [] }
                      : undefined,
                  })}
                  className={selectClass}
                >
                  <option value="">Sempre aparece</option>
                  {candidatosCondicao(campos, i).map((c) => (
                    <option key={c.id} value={c.id}>{c.label || '(sem título)'}</option>
                  ))}
                </select>
              </div>

              {campo.condicao && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(campos.find((c) => c.id === campo.condicao!.campoId)?.opcoes ?? []).map((opt) => {
                    const ativo = campo.condicao!.valores.includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const atuais = campo.condicao!.valores
                          atualizarCampo(campo.id, {
                            condicao: {
                              campoId: campo.condicao!.campoId,
                              valores: ativo ? atuais.filter((v) => v !== opt) : [...atuais, opt],
                            },
                          })
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          ativo
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={campo.obrigatorio}
              onChange={(e) => atualizarCampo(campo.id, { obrigatorio: e.target.checked })}
              className="rounded"
            />
            Obrigatório
          </label>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={adicionarCampo}
        className="w-full gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar campo
      </Button>
    </div>
  )
}
