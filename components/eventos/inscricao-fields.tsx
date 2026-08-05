'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { listarFormulariosAction, criarFormularioAction } from '@/app/actions/formularios'
import { FORMULARIO_TEMPLATES } from '@/lib/formulario-templates'
import Link from 'next/link'
import { FileText, ChevronDown, ChevronUp, Link2, ExternalLink } from 'lucide-react'
import type { TipoInscricao, TipoChavePix } from '@/lib/supabase/types'

const selectClass = 'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring'

export interface InscricaoValue {
  tipo: TipoInscricao
  whatsapp?: string
  pixChave?: string
  pixTipo?: TipoChavePix
  pixNome?: string
  pixValor?: string
  formularioId?: string
  linkUrl?: string
}

interface Props {
  value: InscricaoValue
  onChange: (v: InscricaoValue) => void
  /** Abre a seção já expandida e rola até ela — usado pelo atalho "Editar inscrição". */
  abrirExpandido?: boolean
}

type Formulario = { id: string; nome: string; descricao: string | null }

export function InscricaoFields({ value, onChange, abrirExpandido = false }: Props) {
  const [formularios, setFormularios] = useState<Formulario[]>([])
  const [modoForm, setModoForm] = useState<'existente' | 'template' | 'novo'>('existente')
  const [templateIdx, setTemplateIdx] = useState(0)
  const [expandido, setExpandido] = useState(abrirExpandido)
  const secaoRef = useRef<HTMLDivElement>(null)

  const templates = FORMULARIO_TEMPLATES

  useEffect(() => {
    if (value.tipo === 'formulario') {
      listarFormulariosAction().then(setFormularios).catch(() => {})
    }
  }, [value.tipo])

  useEffect(() => {
    if (abrirExpandido) {
      setExpandido(true)
      // Espera o dialog terminar de abrir/renderizar antes de rolar
      const t = setTimeout(() => secaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
      return () => clearTimeout(t)
    }
  }, [abrirExpandido])

  function set(patch: Partial<InscricaoValue>) {
    onChange({ ...value, ...patch })
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
    <div ref={secaoRef} className="space-y-3 border border-border rounded-xl p-3 scroll-mt-4">
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
              <option value="link">Link externo (Google Forms, etc.)</option>
              <option value="pix">Inscrição com pagamento PIX</option>
            </select>
          </div>

          {/* Link externo */}
          {value.tipo === 'link' && (
            <div className="space-y-1">
              <Label className="text-xs">Link do formulário</Label>
              <Input
                type="url"
                placeholder="https://forms.gle/..."
                value={value.linkUrl ?? ''}
                onChange={(e) => set({ linkUrl: e.target.value })}
                className="h-8 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Use quando o formulário já existir em outro lugar — Google Forms, Typeform, etc.
                O botão &ldquo;Fazer inscrição&rdquo; abre esse link em uma nova aba; o app não
                acompanha quem respondeu.
              </p>
            </div>
          )}

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
                <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Montar um formulário aqui dentro é arriscado: fechar esta janela sem
                    querer perde tudo. O construtor agora tem página própria, com prévia
                    e aviso de alterações não salvas.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    render={<Link href="/formularios/novo" target="_blank" />}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir construtor de formulários
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Abre em outra aba. Ao terminar, volte aqui e escolha o formulário
                    em &ldquo;Existente&rdquo;.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
