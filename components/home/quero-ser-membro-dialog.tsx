'use client'

import { useState, useTransition } from 'react'
import { criarSolicitacaoAction } from '@/app/actions/solicitacoes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { BadgeCheck, CheckCircle } from 'lucide-react'

const selectClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring'

const SITUACAO = [
  { valor: 'visitante',    rotulo: 'Visito a igreja' },
  { valor: 'congregado',   rotulo: 'Congrego aqui, mas não sou membro' },
  { valor: 'transferencia', rotulo: 'Sou membro de outra igreja (transferência)' },
]

const COMO_CONHECEU = [
  'Um amigo ou familiar me convidou',
  'Uma célula',
  'Redes sociais',
  'Passei em frente',
  'Um evento da igreja',
  'Outro',
]

/**
 * "Quero ser membro".
 *
 * Não cria conta nem aprova ninguém: membresia na igreja passa por conversa e
 * pelo curso, não por formulário. O que este diálogo faz é registrar o
 * interesse com o que a secretaria precisa para dar o primeiro telefonema —
 * inclusive batismo e igreja de origem, que decidem se o caminho é curso ou
 * carta de transferência.
 */
export function QueroSerMembroDialog({
  email, nomeInicial, telefoneInicial = '', buttonClassName,
}: {
  email: string
  nomeInicial: string
  telefoneInicial?: string
  buttonClassName?: string
}) {
  const isGuest = !email
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState(nomeInicial)
  const [emailInput, setEmailInput] = useState(email)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [nascimento, setNascimento] = useState('')
  const [situacao, setSituacao] = useState('')
  const [batizado, setBatizado] = useState<boolean | null>(null)
  const [igrejaOrigem, setIgrejaOrigem] = useState('')
  const [comoConheceu, setComoConheceu] = useState('')
  const [mensagem, setMensagem] = useState('')

  function resetForm() {
    setNome(nomeInicial)
    setEmailInput(email)
    setTelefone(telefoneInicial)
    setNascimento('')
    setSituacao('')
    setBatizado(null)
    setIgrejaOrigem('')
    setComoConheceu('')
    setMensagem('')
    setErro(null)
    setSuccess(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!nome.trim() || !telefone.trim() || !situacao) {
      setErro('Preencha nome, telefone e sua situação hoje.')
      return
    }
    if (isGuest && !emailInput.trim()) {
      setErro('Informe seu e-mail para que possamos entrar em contato.')
      return
    }

    startTransition(async () => {
      try {
        await criarSolicitacaoAction({
          tipo: 'membresia',
          nome: nome.trim(),
          telefone: telefone.trim(),
          email: emailInput.trim(),
          mensagem,
          dados: {
            nascimento,
            situacao,
            batizado,
            igreja_origem: igrejaOrigem.trim(),
            como_conheceu: comoConheceu,
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
        render={<Button size="sm" variant="outline" className={`gap-2 ${buttonClassName ?? 'mt-3'}`.trim()} />}
      >
        <BadgeCheck className="h-4 w-4" />
        Quero ser membro
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seja membro</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-10 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="font-semibold text-base">Interesse registrado!</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              A secretaria vai entrar em contato para conversar sobre os próximos passos.
            </p>
            <Button className="mt-5" onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Este é o primeiro passo. Depois dele vem uma conversa com a liderança e o
              curso de membresia — ninguém vira membro só preenchendo formulário.
            </p>

            <div className="space-y-1">
              <Label htmlFor="sm-nome">Nome completo *</Label>
              <Input id="sm-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sm-email">E-mail {isGuest && '*'}</Label>
              {isGuest ? (
                <Input
                  id="sm-email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="seu@email.com"
                />
              ) : (
                <Input id="sm-email" value={email} readOnly className="bg-muted/40 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="sm-tel">Telefone / WhatsApp *</Label>
              <Input
                id="sm-tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sm-nasc">Data de nascimento</Label>
              <Input
                id="sm-nasc"
                type="date"
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sm-sit">Sua situação hoje *</Label>
              <select
                id="sm-sit"
                className={selectClass}
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {SITUACAO.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Você já foi batizado?</Label>
              <div className="flex gap-4">
                {[{ rotulo: 'Sim', val: true }, { rotulo: 'Não', val: false }].map(({ rotulo, val }) => (
                  <label key={rotulo} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="batizado"
                      checked={batizado === val}
                      onChange={() => setBatizado(val)}
                      className="accent-primary"
                    />
                    {rotulo}
                  </label>
                ))}
              </div>
            </div>

            {/* Só quem vem de outra igreja precisa dizer de onde — perguntar isso
                a um visitante é ruído. */}
            {situacao === 'transferencia' && (
              <div className="space-y-1">
                <Label htmlFor="sm-origem">De qual igreja você vem?</Label>
                <Input
                  id="sm-origem"
                  value={igrejaOrigem}
                  onChange={(e) => setIgrejaOrigem(e.target.value)}
                  placeholder="Nome e cidade da igreja"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="sm-como">Como conheceu a igreja?</Label>
              <select
                id="sm-como"
                className={selectClass}
                value={comoConheceu}
                onChange={(e) => setComoConheceu(e.target.value)}
              >
                <option value="">Selecione...</option>
                {COMO_CONHECEU.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sm-msg">Quer dizer mais alguma coisa?</Label>
              <Textarea
                id="sm-msg"
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
