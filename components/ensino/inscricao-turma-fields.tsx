'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { listarFormulariosAction, criarFormularioAction } from '@/app/actions/formularios'
import { FORMULARIO_TEMPLATES } from '@/lib/formulario-templates'
import type { TipoInscricaoTurma } from '@/lib/supabase/types'

const selectClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

export interface InscricaoTurmaValue {
  tipo: TipoInscricaoTurma
  formularioId: string
  linkUrl: string
  /**
   * O grupo da turma no WhatsApp — o mesmo campo nos quatro tipos.
   *
   * Em `whatsapp` ele é o destino da inscrição, e por isso obrigatório; nos
   * outros é o grupo opcional, que aparece só para quem já está na turma.
   */
  grupoUrl: string
}

/**
 * Opções de inscrição da turma — o mesmo leque dos eventos, menos o PIX.
 *
 * Curso da Escola Bíblica não cobra, e oferecer PIX aqui só criaria caminho
 * morto. Se um dia cobrar, o campo entra reaproveitando `lib/pix.ts`.
 *
 * O construtor de formulários é o mesmo dos eventos: um formulário criado para
 * um retiro pode ser reusado numa turma sem recadastrar campo nenhum.
 */
export function InscricaoTurmaFields({
  value,
  onChange,
}: {
  value: InscricaoTurmaValue
  onChange: (v: InscricaoTurmaValue) => void
}) {
  const [formularios, setFormularios] = useState<{ id: string; nome: string }[]>([])
  const [modo, setModo] = useState<'existente' | 'template'>('existente')
  const [templateIdx, setTemplateIdx] = useState(0)
  const [criandoTemplate, setCriandoTemplate] = useState(false)

  useEffect(() => {
    if (value.tipo === 'formulario') {
      listarFormulariosAction()
        .then((f) => setFormularios(f.map((x) => ({ id: x.id, nome: x.nome }))))
        .catch(() => {})
    }
  }, [value.tipo])

  function set(patch: Partial<InscricaoTurmaValue>) {
    onChange({ ...value, ...patch })
  }

  async function usarTemplate() {
    setCriandoTemplate(true)
    const tpl = FORMULARIO_TEMPLATES[templateIdx]
    const id = await criarFormularioAction({
      nome: tpl.nome,
      descricao: tpl.descricao,
      campos: tpl.campos,
    }).catch(() => null)
    setCriandoTemplate(false)
    if (id) {
      setFormularios((prev) => [{ id, nome: tpl.nome }, ...prev])
      set({ formularioId: id })
      setModo('existente')
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="tipo-inscricao">Como o aluno se inscreve</Label>
        <select
          id="tipo-inscricao"
          value={value.tipo}
          onChange={(e) => set({ tipo: e.target.value as TipoInscricaoTurma })}
          className={selectClass}
        >
          <option value="app">Pelo app — usa os dados do perfil</option>
          <option value="formulario">Pelo app, com perguntas extras</option>
          <option value="link">Link externo (Google Forms, etc.)</option>
          <option value="whatsapp">Pelo WhatsApp — registra e leva ao grupo</option>
        </select>
      </div>

      {value.tipo === 'app' && (
        <p className="text-xs text-muted-foreground">
          O aluno confere nome, WhatsApp e e-mail já cadastrados e confirma. É o caminho que
          alimenta a lista de chamada.
        </p>
      )}

      {value.tipo === 'link' && (
        <div className="space-y-1.5">
          <Label htmlFor="link-inscricao">Endereço do formulário</Label>
          <Input
            id="link-inscricao"
            type="url"
            placeholder="https://forms.gle/..."
            value={value.linkUrl}
            onChange={(e) => set({ linkUrl: e.target.value })}
          />
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
            O botão abre esse link em outra aba. O app <strong>não</strong> registra quem se
            inscreveu — a lista de chamada desta turma ficará vazia, e você precisará cadastrar os
            alunos por outro caminho.
          </p>
        </div>
      )}

      {value.tipo === 'whatsapp' && (
        <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2">
          O aluno entra na lista da turma <strong>e</strong> é levado ao grupo em seguida — entrar
          no grupo é a confirmação da inscrição. Diferente do link externo: aqui você continua com
          a chamada e a frequência.
        </p>
      )}

      {value.tipo === 'formulario' && (
        <div className="space-y-2.5">
          <div className="flex gap-1.5">
            {(['existente', 'template'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                  modo === m
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {m === 'existente' ? 'Usar existente' : 'Partir de um modelo'}
              </button>
            ))}
          </div>

          {modo === 'existente' && (
            formularios.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum formulário criado ainda. Use &ldquo;Partir de um modelo&rdquo; ou o
                construtor.
              </p>
            ) : (
              <select
                value={value.formularioId}
                onChange={(e) => set({ formularioId: e.target.value })}
                className={selectClass}
                aria-label="Formulário da inscrição"
              >
                <option value="">— Escolher formulário —</option>
                {formularios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            )
          )}

          {modo === 'template' && (
            <div className="space-y-2">
              <select
                value={templateIdx}
                onChange={(e) => setTemplateIdx(Number(e.target.value))}
                className={selectClass}
                aria-label="Modelo de formulário"
              >
                {FORMULARIO_TEMPLATES.map((t, i) => (
                  <option key={i} value={i}>{t.nome}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {FORMULARIO_TEMPLATES[templateIdx]?.descricao}
              </p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {FORMULARIO_TEMPLATES[templateIdx]?.campos.map((c) => (
                  <div key={c.id}>• {c.label}{c.obrigatorio ? ' *' : ''}</div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
                onClick={usarTemplate}
                disabled={criandoTemplate}
              >
                <FileText className="h-3.5 w-3.5" />
                {criandoTemplate ? 'Criando...' : 'Usar este modelo'}
              </Button>
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full gap-1.5"
            render={<Link href="/formularios/novo" target="_blank" />}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir o construtor de formulários
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Abre em outra aba — esta página não se perde. Ao voltar, escolha em &ldquo;Usar
            existente&rdquo;.
          </p>
        </div>
      )}

      {/* O grupo da turma. Um campo só: no tipo `whatsapp` ele é o destino da
          inscrição, nos outros é o grupo de quem já entrou. */}
      <div className="space-y-1.5">
        <Label htmlFor="zap-grupo">
          {value.tipo === 'whatsapp'
            ? 'Link do grupo no WhatsApp'
            : 'Grupo da turma no WhatsApp (opcional)'}
        </Label>
        <Input
          id="zap-grupo"
          type="url"
          placeholder="https://chat.whatsapp.com/..."
          value={value.grupoUrl}
          onChange={(e) => set({ grupoUrl: e.target.value })}
          required={value.tipo === 'whatsapp'}
        />
        <p className="text-xs text-muted-foreground">
          {value.tipo === 'whatsapp'
            ? 'É para cá que o botão de inscrição leva. No WhatsApp: grupo › Convidar via link.'
            : 'Aparece só para quem está na turma.'}
        </p>
      </div>
    </div>
  )
}
