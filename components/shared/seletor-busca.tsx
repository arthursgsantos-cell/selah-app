'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'

export interface OpcaoBusca {
  id: string
  nome: string
  /** Texto secundário (ex: e-mail, cargo) — também entra na busca. */
  detalhe?: string
}

interface Props {
  valor: string | null
  opcoes: OpcaoBusca[]
  onSelecionar: (id: string) => void
  disabled?: boolean
  /** Rótulo da opção vazia. Passe null para não oferecer "limpar". */
  rotuloVazio?: string | null
  placeholder?: string
  className?: string
}

/**
 * Seletor com campo de busca.
 *
 * Existe porque as listas do app (dezenas de células, dezenas de membros)
 * ficam impraticáveis num `select` nativo — a pessoa rola procurando o nome.
 */
export function SeletorBusca({
  valor,
  opcoes,
  onSelecionar,
  disabled = false,
  rotuloVazio = 'Nenhum',
  placeholder = 'Buscar...',
  className = 'w-32',
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  // Posição do painel: ele vai para um portal no body, senão qualquer ancestral
  // com overflow-hidden o corta (acontecia na lista de usuários).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)

  function abrir() {
    const r = botaoRef.current?.getBoundingClientRect()
    if (r) {
      const largura = 224 // w-56
      setPos({
        top: r.bottom + 4,
        // Alinha à direita do botão sem sair da tela
        left: Math.max(8, Math.min(r.right - largura, window.innerWidth - largura - 8)),
      })
    }
    setAberto(true)
  }

  const atual = opcoes.find((o) => o.id === valor)
  const termo = busca.trim().toLowerCase()
  const filtradas = termo
    ? opcoes.filter(
        (o) =>
          o.nome.toLowerCase().includes(termo) ||
          (o.detalhe ?? '').toLowerCase().includes(termo)
      )
    : opcoes

  function escolher(id: string) {
    setAberto(false)
    setBusca('')
    onSelecionar(id)
  }

  function fechar() {
    setAberto(false)
    setBusca('')
  }

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => (aberto ? fechar() : abrir())}
        disabled={disabled}
        className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs flex items-center gap-1 hover:bg-muted transition-colors disabled:opacity-50"
      >
        <span className="truncate flex-1 text-left">
          {atual?.nome ?? rotuloVazio ?? placeholder}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      {aberto && pos && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={fechar} />

          <div
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
            className="z-[9999] w-56 rounded-lg border border-border bg-background shadow-lg overflow-hidden"
          >
            <div className="p-1.5 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') fechar()
                    // Enter escolhe quando sobrou só uma — atalho para quem digita o nome inteiro
                    if (e.key === 'Enter' && filtradas.length === 1) escolher(filtradas[0].id)
                  }}
                  placeholder={placeholder}
                  className="w-full h-7 rounded-md border border-input bg-background pl-6 pr-2 text-xs outline-none focus-visible:border-ring"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto py-1">
              {rotuloVazio !== null && (
                <button
                  type="button"
                  onClick={() => escolher('')}
                  className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted transition-colors ${
                    !valor ? 'bg-muted font-medium' : ''
                  }`}
                >
                  {rotuloVazio}
                </button>
              )}

              {filtradas.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">Nada encontrado.</p>
              ) : (
                filtradas.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => escolher(o.id)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted transition-colors ${
                      o.id === valor ? 'bg-primary/10 text-primary font-medium' : ''
                    }`}
                  >
                    <span className="block truncate">{o.nome}</span>
                    {o.detalhe && (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {o.detalhe}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
