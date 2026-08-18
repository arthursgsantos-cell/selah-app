'use client'

import { useState, useTransition } from 'react'
import { salvarAcessoSolicitacoesAction } from '@/app/actions/solicitacoes-acesso'

interface Pessoa { id: string; nome: string; email: string | null; avatar_url: string | null }

export function AcessoSolicitacoes({ pessoas, autorizadas }: { pessoas: Pessoa[]; autorizadas: string[] }) {
  const [selecionada, setSelecionada] = useState('')
  const [lista, setLista] = useState(autorizadas)
  const [pendente, startTransition] = useTransition()
  function alterar(id: string, permitir: boolean) {
    startTransition(async () => {
      const r = await salvarAcessoSolicitacoesAction(id, permitir)
      if (r.sucesso) setLista((atual) => permitir ? [...atual, id] : atual.filter((x) => x !== id))
    })
  }
  return <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
    <div><p className="text-sm font-semibold">Delegar esta lista</p><p className="text-xs text-muted-foreground mt-1">Escolha um membro para cuidar dos pedidos. Ele não verá outras pendências nem as demais áreas do painel.</p></div>
    <div className="flex gap-2"><select value={selecionada} onChange={(e) => setSelecionada(e.target.value)} className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-xs"><option value="">Escolher membro...</option>{pessoas.filter((p) => !lista.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.nome}{p.email ? ` — ${p.email}` : ''}</option>)}</select><button disabled={!selecionada || pendente} onClick={() => { alterar(selecionada, true); setSelecionada('') }} className="rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">Adicionar</button></div>
    {lista.length > 0 && <div className="space-y-1">{pessoas.filter((p) => lista.includes(p.id)).map((p) => <div key={p.id} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-xs"><span className="font-medium">{p.nome}</span><button disabled={pendente} onClick={() => alterar(p.id, false)} className="text-destructive hover:underline">Remover</button></div>)}</div>}
  </div>
}
