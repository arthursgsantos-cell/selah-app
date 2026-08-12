'use client'

import { useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Download, Eraser, Search, Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import {
  FILTROS_VAZIOS, filtrarPessoas, listaParaCsv, MESES,
  type FiltrosLista, type PessoaLista,
} from '@/lib/listas'

const POR_PAGINA = 25

const campoClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

interface Props {
  pessoas: PessoaLista[]
  redes: { id: string; nome: string }[]
  celulas: { id: string; nome: string; redeId: string }[]
}

const CARGOS: { valor: string; label: string }[] = [
  { valor: 'pastor', label: 'Pastor' },
  { valor: 'supervisor', label: 'Supervisor' },
  { valor: 'supervisor_treinamento', label: 'Supervisor em treinamento' },
  { valor: 'lider', label: 'Líder' },
  { valor: 'lider_treinamento', label: 'Líder em treinamento' },
  { valor: 'membro', label: 'Membro' },
  { valor: 'convidado', label: 'Convidado' },
]

function whatsappLink(telefone: string, nome: string) {
  const num = telefone.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`
  return `https://wa.me/${full}?text=${encodeURIComponent(`Oi ${nome.split(' ')[0]}! `)}`
}

/**
 * Construtor de listas.
 *
 * Os filtros valem sobre a igreja inteira já carregada, então cada ajuste
 * responde na hora — sem ida ao servidor a cada clique, que é o que tornaria
 * o recorte penoso de montar.
 */
export function ConstrutorListas({ pessoas, redes, celulas }: Props) {
  const [f, setF] = useState<FiltrosLista>(FILTROS_VAZIOS)
  const [pagina, setPagina] = useState(0)

  function set<K extends keyof FiltrosLista>(campo: K, valor: FiltrosLista[K]) {
    setF((atual) => ({ ...atual, [campo]: valor }))
    setPagina(0)
  }

  const resultado = useMemo(() => filtrarPessoas(pessoas, f), [pessoas, f])

  // Escolher uma rede estreita as células oferecidas: oferecer célula de outra
  // rede junto com o filtro de rede daria sempre lista vazia.
  const celulasDisponiveis = f.redeId ? celulas.filter((c) => c.redeId === f.redeId) : celulas

  const comTelefone = resultado.filter((p) => p.telefone).length
  const totalPaginas = Math.max(1, Math.ceil(resultado.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = resultado.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)

  const limpo = JSON.stringify(f) === JSON.stringify(FILTROS_VAZIOS)

  function baixarCsv() {
    const blob = new Blob([listaParaCsv(resultado)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lista-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 px-4 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={f.busca}
              onChange={(e) => set('busca', e.target.value)}
              placeholder="Buscar por nome..."
              className="pl-8"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Rede</Label>
              <select
                value={f.redeId}
                onChange={(e) => { set('redeId', e.target.value); set('celulaId', '') }}
                className={campoClass}
              >
                <option value="">Todas</option>
                {redes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Célula</Label>
              <select
                value={f.celulaId}
                onChange={(e) => set('celulaId', e.target.value)}
                className={campoClass}
              >
                <option value="">Todas</option>
                {/* O recorte mais pedido da lista inteira: quem ainda não foi
                    para nenhuma célula. */}
                <option value="sem">Sem célula</option>
                {celulasDisponiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cargo</Label>
              <select value={f.role} onChange={(e) => set('role', e.target.value)} className={campoClass}>
                <option value="">Todos</option>
                {CARGOS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Aniversariantes de</Label>
              <select
                value={f.mesAniversario}
                onChange={(e) => set('mesAniversario', Number(e.target.value))}
                className={campoClass}
              >
                <option value={0}>Qualquer mês</option>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1} className="capitalize">{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <select value={f.telefone} onChange={(e) => set('telefone', e.target.value)} className={campoClass}>
                <option value="">Tanto faz</option>
                <option value="com">Tem telefone</option>
                <option value="sem">Sem telefone</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Conta no app</Label>
              <select value={f.conta} onChange={(e) => set('conta', e.target.value)} className={campoClass}>
                <option value="">Tanto faz</option>
                <option value="app">Já usa o app</option>
                <option value="sem_app">Ainda não tem conta</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Idade mínima</Label>
              <Input
                type="number" min={0} max={120} value={f.idadeMin}
                onChange={(e) => set('idadeMin', e.target.value)}
                placeholder="—" className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Idade máxima</Label>
              <Input
                type="number" min={0} max={120} value={f.idadeMax}
                onChange={(e) => set('idadeMax', e.target.value)}
                placeholder="—" className="h-9"
              />
            </div>
          </div>

          {(f.idadeMin || f.idadeMax) && (
            <p className="text-[11px] text-muted-foreground">
              Quem não tem data de nascimento cadastrada fica de fora do recorte
              por idade.
            </p>
          )}

          {!limpo && (
            <button
              type="button"
              onClick={() => { setF(FILTROS_VAZIOS); setPagina(0) }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Eraser className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <strong>{resultado.length}</strong>{' '}
          {resultado.length === 1 ? 'pessoa' : 'pessoas'}
          <span className="text-muted-foreground">
            {' · '}{comTelefone} com telefone
          </span>
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={baixarCsv}
          disabled={resultado.length === 0}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="px-4 py-2">
          {resultado.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Nenhuma pessoa com esses filtros
              </p>
            </div>
          ) : (
            <>
              {visiveis.map((p) => (
                <div
                  key={p.chave}
                  className="flex items-center gap-3 border-b border-border py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{p.nome}</p>
                      {!p.temConta && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          sem conta
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        p.celulaNome,
                        p.redeNome,
                        p.idade !== null ? `${p.idade} anos` : null,
                        p.telefone,
                      ].filter(Boolean).join(' · ') || 'Sem célula'}
                    </p>
                  </div>
                  {p.telefone && (
                    <a
                      href={whatsappLink(p.telefone, p.nome)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg p-1.5 text-green-600 transition-colors hover:bg-green-50"
                      aria-label={`Falar com ${p.nome} no WhatsApp`}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}

              {totalPaginas > 1 && (
                <div className="flex items-center justify-between py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {paginaAtual * POR_PAGINA + 1}–
                    {Math.min((paginaAtual + 1) * POR_PAGINA, resultado.length)} de {resultado.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPagina(paginaAtual - 1)}
                      disabled={paginaAtual === 0}
                      aria-label="Página anterior"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {paginaAtual + 1}/{totalPaginas}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPagina(paginaAtual + 1)}
                      disabled={paginaAtual >= totalPaginas - 1}
                      aria-label="Próxima página"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
