'use client'

import { useState, useTransition } from 'react'
import { criarSolicitacaoAction } from '@/app/actions/solicitacoes'
import { MINISTERIOS } from '@/lib/ministerios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { HeartHandshake, CheckCircle } from 'lucide-react'

const selectClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring'

const DISPONIBILIDADE = [
  'Domingo de manhã',
  'Domingo à noite',
  'Durante a semana',
  'Fins de semana',
  'Qualquer horário',
]

interface Props {
  email: string
  nomeInicial: string
  telefoneInicial?: string
  buttonClassName?: string
}

/**
 * "Quero servir".
 *
 * A pessoa marca em quais frentes quer ajudar — mais de uma, porque quem se
 * oferece raramente tem só uma vocação em mente, e obrigar a escolher uma
 * empurra a decisão para quem ainda não conhece a igreja por dentro.
 */
export function QueroServirDialog({ email, nomeInicial, telefoneInicial = '', buttonClassName }: Props) {
  const isGuest = !email
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState(nomeInicial)
  const [emailInput, setEmailInput] = useState(email)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [areas, setAreas] = useState<string[]>([])
  const [disponibilidade, setDisponibilidade] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [mensagem, setMensagem] = useState('')

  function resetForm() {
    setNome(nomeInicial)
    setEmailInput(email)
    setTelefone(telefoneInicial)
    setAreas([])
    setDisponibilidade('')
    setExperiencia('')
    setMensagem('')
    setErro(null)
    setSuccess(false)
  }

  function alternarArea(chave: string) {
    setAreas((atual) =>
      atual.includes(chave) ? atual.filter((a) => a !== chave) : [...atual, chave]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!nome.trim() || !telefone.trim()) {
      setErro('Preencha nome e telefone.')
      return
    }
    if (isGuest && !emailInput.trim()) {
      setErro('Informe seu e-mail para que possamos entrar em contato.')
      return
    }
    if (areas.length === 0) {
      setErro('Escolha ao menos uma área em que gostaria de servir.')
      return
    }

    startTransition(async () => {
      try {
        await criarSolicitacaoAction({
          tipo: 'voluntario',
          nome: nome.trim(),
          telefone: telefone.trim(),
          email: emailInput.trim(),
          mensagem,
          dados: {
            areas,
            disponibilidade,
            experiencia: experiencia.trim(),
          },
        })
        setSuccess(true)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao enviar. Tente novamente.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger
        render={<Button size="sm" className={`gap-2 ${buttonClassName ?? 'mt-3'}`.trim()} />}
      >
        <HeartHandshake className="h-4 w-4" />
        Quero servir
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seja voluntário</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-10 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="font-semibold text-base">Recebemos seu interesse!</p>
            <p className="text-sm text-muted-foreground mt-1">
              A liderança da área vai entrar em contato em breve.
            </p>
            <Button className="mt-5" onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1">
              <Label htmlFor="sv-nome">Nome *</Label>
              <Input id="sv-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sv-email">E-mail {isGuest && '*'}</Label>
              {isGuest ? (
                <Input
                  id="sv-email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="seu@email.com"
                />
              ) : (
                <Input id="sv-email" value={email} readOnly className="bg-muted/40 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="sv-tel">Telefone / WhatsApp *</Label>
              <Input
                id="sv-tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Onde gostaria de servir? *</Label>
              <div className="grid gap-1.5">
                {MINISTERIOS.map((m) => (
                  <label
                    key={m.chave}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-colors ${
                      areas.includes(m.chave)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={areas.includes(m.chave)}
                      onChange={() => alternarArea(m.chave)}
                      className="accent-primary mt-0.5 h-3.5 w-3.5 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug">{m.nome}</span>
                      <span className="block text-[11px] text-muted-foreground leading-snug">
                        {m.descricao}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sv-disp">Disponibilidade</Label>
              <select
                id="sv-disp"
                className={selectClass}
                value={disponibilidade}
                onChange={(e) => setDisponibilidade(e.target.value)}
              >
                <option value="">Selecione...</option>
                {DISPONIBILIDADE.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sv-exp">Já serviu em alguma dessas áreas?</Label>
              <Textarea
                id="sv-exp"
                value={experiencia}
                onChange={(e) => setExperiencia(e.target.value)}
                placeholder="Conte um pouco da sua experiência (opcional)"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sv-msg">Quer dizer mais alguma coisa?</Label>
              <Textarea
                id="sv-msg"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={2}
              />
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
