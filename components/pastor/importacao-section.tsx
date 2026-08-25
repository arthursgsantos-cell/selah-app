'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, AlertCircle, CircleAlert, Check, Minus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Bloco = {
  importados?: string[]
  atualizados?: string[]
  ignorados?: string[]
  pendentes?: { arquivo: string; motivo: string }[]
  erros?: { arquivo: string; motivo: string }[]
}

type Resposta = {
  ok: boolean
  erro?: string
  roteiros?: Bloco
  fotos?: Bloco
  eventos?: Bloco
  encontros?: Bloco
  lanches?: Bloco
}

export type RegistroImportacao = {
  tipo: string
  chave: string
  arquivo_nome: string | null
  grupo_origem: string | null
  status: string
  motivo: string | null
  importado_em: string
}

const ROTULO_TIPO: Record<string, string> = {
  roteiro: 'Roteiro',
  foto_celula: 'Foto de célula',
  evento: 'Evento',
  encontro_celula: 'Encontro de célula',
  lanche: 'Item de lanche',
}

const ESTILO_STATUS: Record<string, { rotulo: string; classe: string }> = {
  importado: { rotulo: 'Importado', classe: 'bg-green-100 text-green-700' },
  ignorado: { rotulo: 'Sem alteração', classe: 'bg-muted text-muted-foreground' },
  pendente: { rotulo: 'Pendente', classe: 'bg-yellow-100 text-yellow-700' },
  erro: { rotulo: 'Erro', classe: 'bg-red-100 text-red-700' },
}

/**
 * Painel da importação automática: dispara a sincronização e mostra o que a
 * planilha produziu. Pendências são o caso que exige decisão do pastor —
 * célula ou rede que a planilha cita e que ainda não existe no app.
 */
export function ImportacaoSection({ registros }: { registros: RegistroImportacao[] }) {
  const router = useRouter()
  const [rodando, setRodando] = useState(false)
  const [resposta, setResposta] = useState<Resposta | null>(null)

  async function sincronizar() {
    setRodando(true)
    setResposta(null)
    try {
      const res = await fetch('/api/importacao/sync', { method: 'POST' })
      const json = (await res.json()) as Resposta
      setResposta(json)
      if (json.ok) router.refresh()
    } catch {
      setResposta({ ok: false, erro: 'Falha de rede ao sincronizar.' })
    } finally {
      setRodando(false)
    }
  }

  const pendentes = registros.filter((r) => r.status === 'pendente')
  const problemas = registros.filter((r) => r.status === 'erro')

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Importação da planilha
          {pendentes.length > 0 && (
            <span className="ml-2 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendentes.length} {pendentes.length === 1 ? 'pendência' : 'pendências'}
            </span>
          )}
        </p>
        <Button variant="outline" size="sm" onClick={sincronizar} disabled={rodando} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${rodando ? 'animate-spin' : ''}`} />
          {rodando ? 'Sincronizando...' : 'Sincronizar conteúdos'}
        </Button>
      </div>

      {resposta && !resposta.ok && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
          {resposta.erro}
        </p>
      )}

      {resposta?.ok && (
        <Card>
          <CardContent className="py-3 space-y-2.5">
            <ResumoBloco titulo="Roteiros" bloco={resposta.roteiros} />
            <ResumoBloco titulo="Fotos das células" bloco={resposta.fotos} />
            <ResumoBloco titulo="Eventos" bloco={resposta.eventos} />
            <ResumoBloco titulo="Encontros de célula" bloco={resposta.encontros} />
            <ResumoBloco titulo="Lista de lanche" bloco={resposta.lanches} />
          </CardContent>
        </Card>
      )}

      {(pendentes.length > 0 || problemas.length > 0) && (
        <Card>
          <CardContent className="py-3 space-y-2">
            <p className="text-xs font-medium">Precisam de atenção</p>
            {[...pendentes, ...problemas].map((r) => (
              <div key={`${r.tipo}-${r.chave}`} className="flex items-start gap-1.5 text-xs">
                <CircleAlert
                  className={`h-3.5 w-3.5 shrink-0 mt-px ${r.status === 'erro' ? 'text-destructive' : 'text-yellow-600'}`}
                />
                <span className="min-w-0">
                  <span className="font-medium">{r.arquivo_nome ?? r.grupo_origem ?? r.chave}</span>
                  <span className="text-muted-foreground"> — {r.motivo}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {registros.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Histórico da importação ({registros.length})
          </summary>
          <div className="mt-2 space-y-1">
            {registros.map((r) => {
              const estilo = ESTILO_STATUS[r.status] ?? ESTILO_STATUS.ignorado
              return (
                <div key={`${r.tipo}-${r.chave}`} className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${estilo.classe}`}>
                    {estilo.rotulo}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {ROTULO_TIPO[r.tipo] ?? r.tipo}
                  </span>
                  <span className="truncate">{r.arquivo_nome ?? r.grupo_origem ?? r.chave}</span>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </section>
  )
}

function ResumoBloco({ titulo, bloco }: { titulo: string; bloco?: Bloco }) {
  if (!bloco) return null

  const linhas = [
    { icone: Check, classe: 'text-green-700', qtd: bloco.importados?.length ?? 0, texto: 'importados' },
    { icone: Pencil, classe: 'text-blue-700', qtd: bloco.atualizados?.length ?? 0, texto: 'atualizados' },
    { icone: Minus, classe: 'text-muted-foreground', qtd: bloco.ignorados?.length ?? 0, texto: 'já existentes' },
    { icone: CircleAlert, classe: 'text-yellow-600', qtd: bloco.pendentes?.length ?? 0, texto: 'pendentes' },
    { icone: AlertCircle, classe: 'text-destructive', qtd: bloco.erros?.length ?? 0, texto: 'com erro' },
  ].filter((l) => l.qtd > 0)

  return (
    <div className="text-xs">
      <p className="font-medium">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="text-muted-foreground">Nada novo na planilha.</p>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
          {linhas.map((l) => (
            <span key={l.texto} className={`flex items-center gap-1 ${l.classe}`}>
              <l.icone className="h-3 w-3 shrink-0" />
              {l.qtd} {l.texto}
            </span>
          ))}
        </div>
      )}
      {(bloco.pendentes ?? []).concat(bloco.erros ?? []).map((p) => (
        <p key={p.arquivo + p.motivo} className="text-muted-foreground mt-0.5 pl-1">
          <span className="font-medium">{p.arquivo}</span>: {p.motivo}
        </p>
      ))}
    </div>
  )
}

