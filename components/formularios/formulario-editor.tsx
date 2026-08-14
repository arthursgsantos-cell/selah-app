'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Eye, Save, Star } from 'lucide-react'
import { FormBuilder } from '@/components/eventos/form-builder'
import { criarFormularioAction, atualizarFormularioAction } from '@/app/actions/formularios'
import type { CampoFormulario } from '@/lib/supabase/types'

interface Props {
  /** null quando é um formulário novo. */
  formularioId: string | null
  inicial: {
    nome: string
    descricao: string
    campos: CampoFormulario[]
    template: boolean
  }
}

export function FormularioEditor({ formularioId, inicial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState(inicial.nome)
  const [descricao, setDescricao] = useState(inicial.descricao)
  const [campos, setCampos] = useState<CampoFormulario[]>(inicial.campos)
  const [template, setTemplate] = useState(inicial.template)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  // Alerta do navegador ao sair com alterações não salvas — o motivo de o
  // construtor ter saído do popup.
  const sujo =
    nome !== inicial.nome ||
    descricao !== inicial.descricao ||
    template !== inicial.template ||
    JSON.stringify(campos) !== JSON.stringify(inicial.campos)

  function salvar() {
    if (!nome.trim()) {
      setErro('Dê um nome ao formulário.')
      return
    }
    if (campos.length === 0) {
      setErro('Adicione ao menos um campo.')
      return
    }
    if (campos.some((c) => !c.label.trim())) {
      setErro('Todos os campos precisam de um título.')
      return
    }

    setErro(null)
    startTransition(async () => {
      try {
        if (formularioId) {
          await atualizarFormularioAction(formularioId, {
            nome: nome.trim(),
            descricao: descricao.trim() || undefined,
            campos,
            template,
          })
          setSalvo(true)
          router.refresh()
        } else {
          const novoId = await criarFormularioAction({
            nome: nome.trim(),
            descricao: descricao.trim() || undefined,
            campos,
            template,
          })
          router.push(`/formularios/${novoId}`)
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
      }
    })
  }

  return (
    <div className="space-y-4 pb-24">
      <Button variant="ghost" size="sm" render={<Link href="/eventos?aba=formularios" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Eventos
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{formularioId ? 'Editar formulário' : 'Novo formulário'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="nome" className="text-xs">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => { setNome(e.target.value); setSalvo(false) }}
              placeholder="Ex: Inscrição do Retiro 2026"
            />
          </div>

          <div>
            <Label htmlFor="descricao" className="text-xs">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => { setDescricao(e.target.value); setSalvo(false) }}
              placeholder="Explique para que serve este formulário"
              rows={2}
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={template}
              onChange={(e) => { setTemplate(e.target.checked); setSalvo(false) }}
              className="h-4 w-4 rounded accent-primary mt-0.5"
            />
            <span className="min-w-0">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Star className={`h-3.5 w-3.5 ${template ? 'text-amber-500 fill-amber-400' : 'text-muted-foreground'}`} />
                Usar como template
              </span>
              <span className="text-xs text-muted-foreground block leading-relaxed">
                Templates ficam disponíveis para qualquer líder reaproveitar ao criar um evento.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campos do formulário</CardTitle>
        </CardHeader>
        <CardContent>
          <FormBuilder campos={campos} onChange={(c) => { setCampos(c); setSalvo(false) }} />
        </CardContent>
      </Card>

      {campos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Prévia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PreviaFormulario campos={campos} />
          </CardContent>
        </Card>
      )}

      {/* Barra fixa: salvar sempre alcançável, mesmo em formulário longo */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {erro && <p className="text-xs text-destructive leading-tight">{erro}</p>}
            {!erro && salvo && !sujo && (
              <p className="text-xs text-green-600 leading-tight">Alterações salvas.</p>
            )}
            {!erro && sujo && (
              <p className="text-xs text-muted-foreground leading-tight">Alterações não salvas</p>
            )}
          </div>
          <Button onClick={salvar} disabled={isPending}>
            <Save className="h-4 w-4" />
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Mostra como o inscrito vai ver o formulário. */
function PreviaFormulario({ campos }: { campos: CampoFormulario[] }) {
  return (
    <div className="space-y-3 pointer-events-none opacity-90">
      {campos.map((c) => (
        <div key={c.id}>
          <Label className="text-xs">
            {c.label || <span className="italic text-muted-foreground">(sem título)</span>}
            {c.obrigatorio && <span className="text-destructive ml-0.5">*</span>}
          </Label>

          {c.tipo === 'textarea' ? (
            <Textarea rows={2} readOnly />
          ) : c.tipo === 'opcoes' ? (
            <div className="space-y-1 mt-1">
              {(c.opcoes ?? []).map((o, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input type="radio" disabled className="accent-primary" />
                  {o}
                </label>
              ))}
            </div>
          ) : c.tipo === 'checkbox' ? (
            <div className="space-y-1 mt-1">
              {(c.opcoes ?? []).map((o, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled className="accent-primary" />
                  {o}
                </label>
              ))}
            </div>
          ) : (
            <Input readOnly type={c.tipo === 'numero' ? 'number' : 'text'} />
          )}
        </div>
      ))}
    </div>
  )
}
