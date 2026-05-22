'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { inscreverEventoAction } from '@/app/actions/inscricoes'
import type { CampoFormulario } from '@/lib/supabase/types'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  eventoId: string
  formularioId: string
  campos: CampoFormulario[]
  nomeInicial?: string
  telefoneInicial?: string
}

export function FormularioInscricao({ eventoId, formularioId, campos, nomeInicial = '', telefoneInicial = '' }: Props) {
  const router = useRouter()
  const [dados, setDados] = useState<Record<string, string>>({})
  const [nome, setNome] = useState(nomeInicial)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [isPending, startTransition] = useTransition()

  function set(id: string, value: string) {
    setDados((prev) => ({ ...prev, [id]: value }))
  }

  function toggleCheckbox(id: string, opcao: string) {
    const atual = (dados[id] ?? '').split(',').filter(Boolean)
    const novo = atual.includes(opcao)
      ? atual.filter((v) => v !== opcao)
      : [...atual, opcao]
    set(id, novo.join(','))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    for (const campo of campos) {
      if (campo.obrigatorio && !dados[campo.id]?.trim()) {
        setErro(`O campo "${campo.label}" é obrigatório.`)
        return
      }
    }

    startTransition(async () => {
      const result = await inscreverEventoAction({
        eventoId,
        formularioId,
        nome,
        telefone,
        dados,
      })
      if (result.ok) {
        setSucesso(true)
      } else {
        setErro(result.erro ?? 'Erro ao enviar inscrição.')
      }
    })
  }

  if (sucesso) {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
        <p className="font-semibold text-green-700">Inscrição realizada com sucesso!</p>
        <p className="text-sm text-muted-foreground">Você receberá mais informações em breve.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/home')}>
          Voltar ao início
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="f-nome">Nome completo *</Label>
        <Input
          id="f-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          placeholder="Seu nome"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-tel">WhatsApp</Label>
        <Input
          id="f-tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(11) 99999-9999"
          type="tel"
        />
      </div>

      {campos
        .filter((c) => c.id !== 'nome' && c.id !== 'telefone')
        .map((campo) => (
          <div key={campo.id} className="space-y-1.5">
            <Label htmlFor={`f-${campo.id}`}>
              {campo.label}{campo.obrigatorio ? ' *' : ''}
            </Label>

            {campo.tipo === 'textarea' && (
              <Textarea
                id={`f-${campo.id}`}
                value={dados[campo.id] ?? ''}
                onChange={(e) => set(campo.id, e.target.value)}
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
                      checked={dados[campo.id] === opt}
                      onChange={() => set(campo.id, opt)}
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
                      checked={(dados[campo.id] ?? '').split(',').includes(opt)}
                      onChange={() => toggleCheckbox(campo.id, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {!['textarea', 'opcoes', 'checkbox'].includes(campo.tipo) && (
              <Input
                id={`f-${campo.id}`}
                type={campo.tipo === 'email' ? 'email' : campo.tipo === 'numero' ? 'number' : campo.tipo === 'telefone' ? 'tel' : 'text'}
                value={dados[campo.id] ?? ''}
                onChange={(e) => set(campo.id, e.target.value)}
                placeholder={campo.label}
              />
            )}
          </div>
        ))}

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" disabled={!nome.trim() || isPending} className="w-full">
        {isPending ? 'Enviando...' : 'Confirmar inscrição'}
      </Button>
    </form>
  )
}
