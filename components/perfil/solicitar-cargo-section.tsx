'use client'

import { useState } from 'react'
import { solicitarCargoAction } from '@/app/actions/solicitacoes-cargo'
import { ChevronDown, Loader2, Send, CheckCircle2 } from 'lucide-react'

const opcoesCargo = [
  { value: 'lider_treinamento', label: 'Líder em Treinamento' },
  { value: 'lider', label: 'Líder' },
  { value: 'supervisor_treinamento', label: 'Supervisor em Treinamento' },
  { value: 'supervisor', label: 'Supervisor' },
]

const rolesQuePodemSolicitar = ['membro', 'lider_treinamento', 'lider', 'supervisor_treinamento']

export function SolicitarCargoSection({
  roleAtual,
  jaPendente,
}: {
  roleAtual: string
  jaPendente: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [cargo, setCargo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(jaPendente)
  const [erro, setErro] = useState<string | null>(null)

  if (!rolesQuePodemSolicitar.includes(roleAtual)) return null

  const opcoesDisponiveis = opcoesCargo.filter((o) => {
    const ordem = ['membro', 'lider_treinamento', 'lider', 'supervisor_treinamento', 'supervisor']
    return ordem.indexOf(o.value) > ordem.indexOf(roleAtual)
  })

  async function enviar() {
    if (!cargo) return
    setLoading(true)
    setErro(null)
    const result = await solicitarCargoAction(cargo, mensagem)
    setLoading(false)
    if (result.ok) {
      setEnviado(true)
    } else {
      setErro(result.erro ?? 'Erro ao enviar')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div>
          <p className="text-sm font-medium">Solicitar cargo</p>
          <p className="text-xs text-muted-foreground">
            {enviado ? 'Solicitação enviada — aguardando aprovação' : 'Peça para ser líder ou supervisor'}
          </p>
        </div>
        {enviado
          ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          : <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />}
      </button>

      {aberto && !enviado && (
        <div className="px-4 pb-4 border-t border-border space-y-3 pt-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cargo desejado</label>
            <select
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Selecionar...</option>
              {opcoesDisponiveis.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mensagem (opcional)</label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Conte um pouco sobre sua trajetória..."
              rows={2}
              className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}

          <button
            type="button"
            onClick={enviar}
            disabled={!cargo || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar solicitação
          </button>
        </div>
      )}
    </div>
  )
}
