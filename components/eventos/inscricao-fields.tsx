'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FormBuilder } from '@/components/eventos/form-builder'
import { listarFormulariosAction, criarFormularioAction } from '@/app/actions/formularios'
import { FORMULARIO_TEMPLATES } from '@/lib/formulario-templates'
import { Plus, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import type { TipoInscricao, TipoChavePix, CampoFormulario } from '@/lib/supabase/types'

const selectClass = 'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring'

export interface InscricaoValue {
  tipo: TipoInscricao
  whatsapp?: string
  pixChave?: string
  pixTipo?: TipoChavePix
  pixNome?: string
  pixValor?: string
  formularioId?: string
}

interface Props {
  value: InscricaoValue
  onChange: (v: InscricaoValue) => void
}

type Formulario = { id: string; nome: string; descricao: string | null }

export function InscricaoFields({ value, onChange }: Props) {
  const [formularios, setFormularios] = useState<Formulario[]>([])
  const [modoForm, setModoForm] = useState<'existente' | 'template' | 'novo'>('existente')
  const [campos, setCampos] = useState<CampoFormulario[]>([])
  const [nomeForm, setNomeForm] = useState('')
  const [templateIdx, setTemplateIdx] = useState(0)
  const [criandoForm, setCriandoForm] = useState(false)
  const [expandido, setExpandido] = useState(false)

  const templates = FORMULARIO_TEMPLATES

  useEffect(() => {
    if (value.tipo === 'formulario') {
      listarFormulariosAction().then(setFormularios).catch(() => {})
    }
  }, [value.tipo])

  function set(patch: Partial<InscricaoValue>) {
    onChange({ ...value, ...patch })
  }

  async function salvarNovoFormulario() {
    if (!nomeForm.trim() || campos.length === 0) return
    setCriandoForm(true)
    try {
      const id = await criarFormularioAction({ nome: nomeForm, campos })
      setFormularios((prev) => [{ id, nome: nomeForm, descricao: null }, ...prev])
      set({ formularioId: id })
      setModoForm('existente')
    } catch {
      // silently fail; user can retry
    } finally {
      setCriandoForm(false)
    }
  }

  async function usarTemplate() {
    const tpl = templates[templateIdx]
    const id = await criarFormularioAction({ nome: tpl.nome, descricao: tpl.descricao, campos: tpl.campos }).catch(() => null)
    if (id) {
      setFormularios((prev) => [{ id, nome: tpl.nome, descricao: tpl.descricao }, ...prev])
      set({ formularioId: id })
      setModoForm('existente')
    }
  }

  return (
    <div className="space-y-3 border border-border rounded-xl p-3">
      <button
        type="button"
        className="w-full flex items-center justify-between text-sm font-medium"
        onClick={() => setExpandido((v) => !v)}
      >
        <span>Inscrições</span>
        {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expandido && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de participação</Label>
            <select
              value={value.tipo}
              onChange={(e) => set({ tipo: e.target.value as TipoInscricao })}
              className={selectClass}
            >
              <option value="aberto">Aberto — qualquer um confirma presença</option>
              <option value="whatsapp">Inscrição via WhatsApp</option>
              <option value="formulario">Formulário de inscrição</option>
              <option value="pix">Inscrição com pagamento PIX</option>
            </select>
          </div>

          {/* WhatsApp */}
          {value.tipo === 'whatsapp' && (
            <div className="space-y-1">
              <Label className="text-xs">Número para inscrição (com DDI)</Label>
              <Input
                placeholder="Ex: 5511999999999"
                value={value.whatsapp ?? ''}
                onChange={(e) => set({ whatsapp: e.target.value.replace(/\D/g, '') })}
                className="h-8 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Só números, sem espaços. Ex: 5511999999999</p>
            </div>
          )}

          {/* PIX */}
          {value.tipo === 'pix' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de chave</Label>
                  <select
                    value={value.pixTipo ?? 'aleatoria'}
                    onChange={(e) => set({ pixTipo: e.target.value as TipoChavePix })}
                    className={selectClass}
                  >
                    <option value="aleatoria">Chave aleatória</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$, opcional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ex: 50.00"
                    value={value.pixValor ?? ''}
                    onChange={(e) => set({ pixValor: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Chave PIX</Label>
                <Input
                  placeholder="Sua chave PIX"
                  value={value.pixChave ?? ''}
                  onChange={(e) => set({ pixChave: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome do beneficiário</Label>
                <Input
                  placeholder="Ex: Igreja IBZS"
                  value={value.pixNome ?? ''}
                  onChange={(e) => set({ pixNome: e.target.value })}
                  className="h-8 text-sm"
                  maxLength={25}
                />
              </div>
            </div>
          )}

          {/* Formulário */}
          {value.tipo === 'formulario' && (
            <div className="space-y-3">
              {/* Seletor de modo */}
              <div className="flex gap-1.5">
                {(['existente', 'template', 'novo'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModoForm(m)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                      modoForm === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent/50'
                    }`}
                  >
                    {m === 'existente' ? 'Existente' : m === 'template' ? 'Template' : 'Novo'}
                  </button>
                ))}
              </div>

              {modoForm === 'existente' && (
                <div className="space-y-1">
                  {formularios.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Nenhum formulário criado ainda. Use &ldquo;Template&rdquo; ou &ldquo;Novo&rdquo;.
                    </p>
                  ) : (
                    <select
                      value={value.formularioId ?? ''}
                      onChange={(e) => set({ formularioId: e.target.value })}
                      className={selectClass}
                    >
                      <option value="">— Selecionar formulário —</option>
                      {formularios.map((f) => (
                        <option key={f.id} value={f.id}>{f.nome}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {modoForm === 'template' && (
                <div className="space-y-2">
                  <select
                    value={templateIdx}
                    onChange={(e) => setTemplateIdx(Number(e.target.value))}
                    className={selectClass}
                  >
                    {templates.map((t, i) => (
                      <option key={i} value={i}>{t.nome}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{templates[templateIdx]?.descricao}</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {templates[templateIdx]?.campos.map((c) => (
                      <div key={c.id}>• {c.label}{c.obrigatorio ? ' *' : ''}</div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={usarTemplate}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Usar este template
                  </Button>
                </div>
              )}

              {modoForm === 'novo' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do formulário</Label>
                    <Input
                      placeholder="Ex: Inscrição para o Retiro 2026"
                      value={nomeForm}
                      onChange={(e) => setNomeForm(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <FormBuilder campos={campos} onChange={setCampos} />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={salvarNovoFormulario}
                    disabled={!nomeForm.trim() || campos.length === 0 || criandoForm}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {criandoForm ? 'Salvando...' : 'Criar e usar este formulário'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
