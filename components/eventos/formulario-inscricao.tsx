'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { inscreverEventoAction } from '@/app/actions/inscricoes'
import type { CampoFormulario } from '@/lib/supabase/types'
import { validarRespostas } from '@/lib/formulario-condicional'
import { CamposFormulario } from '@/components/shared/campos-formulario'
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

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    // Valida só o que está visível: um campo obrigatório escondido por uma
    // condição não pode impedir o envio.
    const problema = validarRespostas(campos, dados)
    if (problema) {
      setErro(problema)
      return
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

      <CamposFormulario campos={campos} respostas={dados} onChange={set} />

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" disabled={!nome.trim() || isPending} className="w-full">
        {isPending ? 'Enviando...' : 'Confirmar inscrição'}
      </Button>
    </form>
  )
}
