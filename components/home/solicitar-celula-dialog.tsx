'use client'

import { useState, useTransition } from 'react'
import { solicitarCelulaAction } from '@/app/actions/solicitar-celula'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Users, CheckCircle } from 'lucide-react'
import { ehCasado } from '@/lib/solicitacao-celula'

const selectClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring'

const DIAS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)']

interface Props {
  email: string
  nomeInicial: string
  telefoneInicial?: string
  idadeInicial?: number | null
  estadoCivilInicial?: string
  buttonClassName?: string
}

export function SolicitarCelulaDialog({ email, nomeInicial, telefoneInicial = '', idadeInicial = null, estadoCivilInicial = '', buttonClassName }: Props) {
  const isGuest = !email
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState(nomeInicial)
  const [emailInput, setEmailInput] = useState(email)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [idade, setIdade] = useState(idadeInicial != null ? String(idadeInicial) : '')
  const [estadoCivil, setEstadoCivil] = useState(estadoCivilInicial)
  const [conjugeNome, setConjugeNome] = useState('')
  const [conjugeTelefone, setConjugeTelefone] = useState('')
  const [conjugeIdade, setConjugeIdade] = useState('')
  const [temFilhos, setTemFilhos] = useState(false)
  const [filhosDetalhes, setFilhosDetalhes] = useState('')
  const [bairro, setBairro] = useState('')
  const [tipoMembro, setTipoMembro] = useState('')
  const [melhorDia, setMelhorDia] = useState('')

  const casado = ehCasado(estadoCivil)

  function resetForm() {
    setNome(nomeInicial)
    setEmailInput(email)
    setTelefone(telefoneInicial)
    setIdade(idadeInicial != null ? String(idadeInicial) : '')
    setEstadoCivil(estadoCivilInicial)
    setConjugeNome('')
    setConjugeTelefone('')
    setConjugeIdade('')
    setTemFilhos(false)
    setFilhosDetalhes('')
    setBairro('')
    setTipoMembro('')
    setMelhorDia('')
    setErro(null)
    setSuccess(false)
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) resetForm()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim() || !telefone.trim() || !estadoCivil || !tipoMembro || !melhorDia) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    if (isGuest && !emailInput.trim()) {
      setErro('Informe seu e-mail para que possamos entrar em contato.')
      return
    }

    startTransition(async () => {
      try {
        await solicitarCelulaAction({
          nome: nome.trim(),
          telefone: telefone.trim(),
          email: emailInput.trim(),
          idade: idade ? parseInt(idade, 10) : null,
          estado_civil: estadoCivil,
          tem_filhos: temFilhos,
          filhos_detalhes: filhosDetalhes.trim(),
          bairro: bairro.trim(),
          tipo_membro: tipoMembro,
          melhor_dia: melhorDia,
          conjuge_nome: conjugeNome.trim(),
          conjuge_telefone: conjugeTelefone.trim(),
          conjuge_idade: conjugeIdade ? parseInt(conjugeIdade, 10) : null,
        })
        setSuccess(true)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao enviar solicitação. Tente novamente.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button size="sm" className={`gap-2 ${buttonClassName !== undefined ? buttonClassName : 'mt-3'}`.trim()} />}
      >
        <Users className="h-4 w-4" />
        Quero fazer parte de uma célula
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitação de célula</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-10 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="font-semibold text-base">Solicitação enviada!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nossa equipe vai entrar em contato em breve.
            </p>
            <Button className="mt-5" onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Nome */}
            <div className="space-y-1">
              <Label htmlFor="sc-nome">Nome *</Label>
              <Input id="sc-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>

            {/* E-mail */}
            <div className="space-y-1">
              <Label htmlFor="sc-email">E-mail {isGuest && '*'}</Label>
              {isGuest ? (
                <Input
                  id="sc-email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="seu@email.com"
                />
              ) : (
                <Input id="sc-email" value={email} readOnly className="bg-muted/40 text-muted-foreground" />
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-1">
              <Label htmlFor="sc-tel">Telefone / WhatsApp *</Label>
              <Input
                id="sc-tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            {/* Idade */}
            <div className="space-y-1">
              <Label htmlFor="sc-idade">Idade</Label>
              <Input
                id="sc-idade"
                type="number"
                min={1}
                max={120}
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
                placeholder="Ex: 28"
              />
            </div>

            {/* Estado civil */}
            <div className="space-y-1">
              <Label htmlFor="sc-civil">Estado civil *</Label>
              <select
                id="sc-civil"
                className={selectClass}
                value={estadoCivil}
                onChange={(e) => setEstadoCivil(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {ESTADO_CIVIL.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* Cônjuge — o casal é encaminhado junto, e o líder precisa do
                contato dos dois para convidar. */}
            {casado && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Sobre seu cônjuge
                </p>
                <div className="space-y-1">
                  <Label htmlFor="sc-conj-nome">Nome</Label>
                  <Input
                    id="sc-conj-nome"
                    value={conjugeNome}
                    onChange={(e) => setConjugeNome(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="sc-conj-tel">Contato</Label>
                    <Input
                      id="sc-conj-tel"
                      value={conjugeTelefone}
                      onChange={(e) => setConjugeTelefone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="w-24 shrink-0 space-y-1">
                    <Label htmlFor="sc-conj-idade">Idade</Label>
                    <Input
                      id="sc-conj-idade"
                      type="number"
                      min={1}
                      max={120}
                      value={conjugeIdade}
                      onChange={(e) => setConjugeIdade(e.target.value)}
                      placeholder="Ex: 30"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Filhos */}
            <div className="space-y-2">
              <Label>Tem filhos?</Label>
              <div className="flex gap-4">
                {[{ label: 'Sim', val: true }, { label: 'Não', val: false }].map(({ label, val }) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="temFilhos"
                      checked={temFilhos === val}
                      onChange={() => setTemFilhos(val)}
                      className="accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {temFilhos && (
                <div className="space-y-1">
                  <Label htmlFor="sc-filhos">Quantos filhos e idades</Label>
                  <Textarea
                    id="sc-filhos"
                    value={filhosDetalhes}
                    onChange={(e) => setFilhosDetalhes(e.target.value)}
                    placeholder="Ex: 2 filhos — João (8 anos) e Maria (5 anos)"
                    rows={2}
                  />
                </div>
              )}
            </div>

            {/* Bairro */}
            <div className="space-y-1">
              <Label htmlFor="sc-bairro">Bairro</Label>
              <Input
                id="sc-bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Ex: Centro, Jardim América..."
              />
            </div>

            {/* Membro, congregado ou visitante */}
            <div className="space-y-2">
              <Label>Você é... *</Label>
              <div className="flex flex-wrap gap-4">
                {[
                  { label: 'Membro', val: 'membro' },
                  { label: 'Congregado', val: 'congregado' },
                  { label: 'Visitante', val: 'visitante' },
                ].map(({ label, val }) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="tipoMembro"
                      checked={tipoMembro === val}
                      onChange={() => setTipoMembro(val)}
                      className="accent-primary"
                      required
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Melhor dia */}
            <div className="space-y-1">
              <Label htmlFor="sc-dia">Melhor dia da semana *</Label>
              <select
                id="sc-dia"
                className={selectClass}
                value={melhorDia}
                onChange={(e) => setMelhorDia(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Enviando...' : 'Enviar solicitação'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
