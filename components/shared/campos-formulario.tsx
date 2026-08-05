'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CampoFormulario } from '@/lib/supabase/types'
import { campoVisivel, repeticoesDoGrupo, idSubcampo } from '@/lib/formulario-condicional'

/**
 * Renderiza os campos de um formulário montado no construtor.
 *
 * Estava dentro de `formulario-inscricao.tsx`, atendendo só aos eventos.
 * Saiu para cá quando o Ensino passou a aceitar campos extras na inscrição das
 * turmas: são as mesmas regras de condição e de grupo repetido, e mantê-las em
 * dois lugares faria uma divergir da outra na primeira correção.
 */
export function CamposFormulario({
  campos,
  respostas,
  onChange,
  /** Campos já cobertos pelo perfil, que não devem ser pedidos de novo. */
  ignorar = ['nome', 'telefone'],
}: {
  campos: CampoFormulario[]
  respostas: Record<string, string>
  onChange: (id: string, valor: string) => void
  ignorar?: string[]
}) {
  function alternarCheckbox(id: string, opcao: string) {
    const atual = (respostas[id] ?? '').split(',').filter(Boolean)
    const novo = atual.includes(opcao)
      ? atual.filter((v) => v !== opcao)
      : [...atual, opcao]
    onChange(id, novo.join(','))
  }

  return (
    <>
      {campos
        .filter((c) => !ignorar.includes(c.id))
        // Some quando a condição não é satisfeita — ex: "Nome dos filhos" só
        // aparece depois de responder "Sim" em "Tem filhos?".
        .filter((c) => campoVisivel(c, respostas))
        .map((campo) =>
          campo.tipo === 'grupo' ? (
            <GrupoRepetido key={campo.id} grupo={campo} respostas={respostas} onChange={onChange} />
          ) : (
            <div key={campo.id} className="space-y-1.5">
              <Label htmlFor={`f-${campo.id}`}>
                {campo.label}{campo.obrigatorio ? ' *' : ''}
              </Label>

              {campo.tipo === 'textarea' && (
                <Textarea
                  id={`f-${campo.id}`}
                  value={respostas[campo.id] ?? ''}
                  onChange={(e) => onChange(campo.id, e.target.value)}
                  rows={3}
                />
              )}

              {campo.tipo === 'opcoes' && (
                <div className="space-y-1.5">
                  {(campo.opcoes ?? []).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={`f-${campo.id}`}
                        value={opt}
                        checked={respostas[campo.id] === opt}
                        onChange={() => onChange(campo.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {campo.tipo === 'checkbox' && (
                <div className="space-y-1.5">
                  {(campo.opcoes ?? []).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(respostas[campo.id] ?? '').split(',').includes(opt)}
                        onChange={() => alternarCheckbox(campo.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {!['textarea', 'opcoes', 'checkbox'].includes(campo.tipo) && (
                <Input
                  id={`f-${campo.id}`}
                  type={
                    campo.tipo === 'email'
                      ? 'email'
                      : campo.tipo === 'numero'
                        ? 'number'
                        : campo.tipo === 'telefone'
                          ? 'tel'
                          : 'text'
                  }
                  value={respostas[campo.id] ?? ''}
                  onChange={(e) => onChange(campo.id, e.target.value)}
                  placeholder={campo.label}
                />
              )}
            </div>
          )
        )}
    </>
  )
}

/**
 * Bloco que se repete conforme um campo numérico anterior.
 * Ex.: "Quantos filhos?" = 3 → três blocos de "Nome" e "Idade".
 */
function GrupoRepetido({
  grupo,
  respostas,
  onChange,
}: {
  grupo: CampoFormulario
  respostas: Record<string, string>
  onChange: (id: string, valor: string) => void
}) {
  const n = repeticoesDoGrupo(grupo, respostas)
  if (n === 0) return null

  return (
    <div className="space-y-2">
      <Label>{grupo.label}</Label>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {grupo.label} {i + 1}
          </p>
          {(grupo.subcampos ?? []).map((sub) => {
            const campoId = idSubcampo(grupo.id, i, sub.id)
            return (
              <div key={sub.id} className="space-y-1">
                <Label htmlFor={`f-${campoId}`} className="text-xs">
                  {sub.label}{sub.obrigatorio ? ' *' : ''}
                </Label>
                <Input
                  id={`f-${campoId}`}
                  type={sub.tipo === 'numero' ? 'number' : sub.tipo === 'email' ? 'email' : 'text'}
                  value={respostas[campoId] ?? ''}
                  onChange={(e) => onChange(campoId, e.target.value)}
                  placeholder={sub.label}
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
