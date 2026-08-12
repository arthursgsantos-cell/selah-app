'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { criarFichaAction } from '@/app/actions/consolidacao'
import { DECISAO_LABELS, ORIGEM_LABELS } from '@/lib/consolidacao'
import type { DecisaoConsolidacao, OrigemConsolidacao } from '@/lib/supabase/types'

const campoClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

interface Props {
  celulas: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
  /** Nome já digitado — usado quando a ficha nasce de um visitante do encontro. */
  nomeInicial?: string
}

/**
 * Acolher alguém que chegou.
 *
 * Só o nome é obrigatório. Tudo o mais — telefone, célula, responsável — pode
 * vir depois: exigir a ficha completa na porta faria a pessoa não ser
 * cadastrada, que é o pior resultado possível.
 */
export function AcolherDialog({ celulas, responsaveis, nomeInicial = '' }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [salvando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState(nomeInicial)
  const [telefone, setTelefone] = useState('')
  const [origem, setOrigem] = useState<OrigemConsolidacao>('culto')
  const [decisao, setDecisao] = useState<DecisaoConsolidacao | ''>('')
  const [celulaId, setCelulaId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))

  function fechar() {
    setAberto(false)
    setErro(null)
    setNome(nomeInicial); setTelefone(''); setOrigem('culto'); setDecisao('')
    setCelulaId(''); setResponsavelId(''); setObservacao('')
  }

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await criarFichaAction({
        nome,
        telefone: telefone || null,
        origem,
        decisao: decisao || null,
        celulaId: celulaId || null,
        responsavelId: responsavelId || null,
        observacao: observacao || null,
        dataAcolhimento: data,
      })
      if (!r.ok) { setErro(r.erro); return }
      fechar()
      router.refresh()
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <UserPlus className="h-4 w-4" />
        Acolher pessoa
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Acolher pessoa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cons-nome">Nome</Label>
            <Input
              id="cons-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como a pessoa se apresentou"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cons-tel">WhatsApp</Label>
              <Input
                id="cons-tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(84) 99999-0000"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cons-data">Chegou em</Label>
              <input
                id="cons-data"
                type="date"
                value={data}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setData(e.target.value)}
                className={campoClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cons-origem">Onde conheceu</Label>
              <select
                id="cons-origem"
                value={origem}
                onChange={(e) => setOrigem(e.target.value as OrigemConsolidacao)}
                className={campoClass}
              >
                {(Object.keys(ORIGEM_LABELS) as OrigemConsolidacao[]).map((o) => (
                  <option key={o} value={o}>{ORIGEM_LABELS[o]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cons-decisao">Decisão</Label>
              <select
                id="cons-decisao"
                value={decisao}
                onChange={(e) => setDecisao(e.target.value as DecisaoConsolidacao | '')}
                className={campoClass}
              >
                {/* Nem toda pessoa acolhida tomou uma decisão naquele dia — e
                    marcar uma que não houve seria inventar história. */}
                <option value="">Não informou</option>
                {(Object.keys(DECISAO_LABELS) as DecisaoConsolidacao[]).map((d) => (
                  <option key={d} value={d}>{DECISAO_LABELS[d]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cons-resp">Quem vai acompanhar</Label>
            <select
              id="cons-resp"
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className={campoClass}
            >
              <option value="">Decidir depois</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Com responsável a ficha já entra como &ldquo;atribuída&rdquo;. Sem, fica
              em &ldquo;acolhido&rdquo; esperando alguém assumir.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cons-celula">Célula de destino</Label>
            <select
              id="cons-celula"
              value={celulaId}
              onChange={(e) => setCelulaId(e.target.value)}
              className={campoClass}
            >
              <option value="">Ainda não sei</option>
              {celulas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cons-obs">Observação</Label>
            <Textarea
              id="cons-obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Onde mora, com quem veio, o que pediu..."
              className="text-sm resize-none"
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={salvar} disabled={salvando || !nome.trim()}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {salvando ? 'Salvando…' : 'Acolher'}
            </Button>
            <Button variant="ghost" onClick={fechar} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
