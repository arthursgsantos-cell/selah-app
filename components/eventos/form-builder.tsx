'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import type { CampoFormulario } from '@/lib/supabase/types'

const TIPOS = [
  { value: 'texto', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone/WhatsApp' },
  { value: 'numero', label: 'Número' },
  { value: 'opcoes', label: 'Múltipla escolha (radio)' },
  { value: 'checkbox', label: 'Caixas de seleção' },
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
