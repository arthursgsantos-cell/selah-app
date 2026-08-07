'use client'

import { useRef, useState } from 'react'
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link2, Minus, Eye, PenLine,
} from 'lucide-react'
import { textoRicoParaHtml } from '@/lib/texto-rico'
import { LinkPreviewLayer } from '@/components/shared/link-preview-layer'

/**
 * Editor de texto formatado.
 *
 * É uma caixa de texto comum com uma barra de botões em cima. A pessoa
 * seleciona um trecho, clica em "negrito", e o botão põe os `**` em volta —
 * mesmo resultado de digitar à mão, sem precisar saber a marcação.
 *
 * Não é um editor visual (o texto continua aparecendo com os asteriscos): um
 * `contentEditable` traria HTML de fora, colagem do Word e um mundo de
 * higienização junto. Aqui o que sai é texto puro, e a aba "Visualizar" mostra
 * exatamente como vai ficar na página — que é a garantia que faltava.
 */

const AJUDA = 'Selecione um trecho e use os botões, ou digite a marcação direto.'

export function EditorTexto({
  value,
  onChange,
  placeholder,
  minRows = 10,
  id,
}: {
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  minRows?: number
  id?: string
}) {
  const caixa = useRef<HTMLTextAreaElement>(null)
  const [vendo, setVendo] = useState(false)

  /** Devolve o foco e a seleção à caixa depois que o botão a roubou. */
  function aplicar(texto: string, inicio: number, fim: number) {
    onChange(texto)
    requestAnimationFrame(() => {
      const el = caixa.current
      if (!el) return
      el.focus()
      el.setSelectionRange(inicio, fim)
    })
  }

  /** Envolve a seleção — `**` para negrito, `*` para itálico. */
  function envolver(marca: string) {
    const el = caixa.current
    if (!el) return
    const { selectionStart: i, selectionEnd: f } = el
    const dentro = value.slice(i, f)

    // Clicar de novo com o mesmo trecho selecionado desfaz a marcação.
    if (dentro.startsWith(marca) && dentro.endsWith(marca) && dentro.length > marca.length * 2) {
      const limpo = dentro.slice(marca.length, -marca.length)
      aplicar(value.slice(0, i) + limpo + value.slice(f), i, i + limpo.length)
      return
    }

    const alvo = dentro || 'texto'
    aplicar(
      value.slice(0, i) + marca + alvo + marca + value.slice(f),
      i + marca.length,
      i + marca.length + alvo.length
    )
  }

  /**
   * Põe (ou tira) um prefixo em cada linha tocada pela seleção — é assim que
   * título, lista e citação funcionam.
   */
  function prefixar(prefixo: string | ((n: number) => string)) {
    const el = caixa.current
    if (!el) return
    const { selectionStart: i, selectionEnd: f } = el

    const inicioLinha = value.lastIndexOf('\n', i - 1) + 1
    const fimLinha = value.indexOf('\n', f) === -1 ? value.length : value.indexOf('\n', f)
    const linhas = value.slice(inicioLinha, fimLinha).split('\n')

    const marca = (n: number) => (typeof prefixo === 'string' ? prefixo : prefixo(n))
    const jaTem = linhas.every((l, n) => l.startsWith(marca(n)))

    const novas = linhas.map((l, n) =>
      jaTem
        ? l.slice(marca(n).length)
        : // Trocar de "## " para "- " não deve empilhar os dois.
          marca(n) + l.replace(/^(#{1,3}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/, '')
    )

    const texto = value.slice(0, inicioLinha) + novas.join('\n') + value.slice(fimLinha)
    aplicar(texto, inicioLinha, inicioLinha + novas.join('\n').length)
  }

  /** Insere um bloco solto — a linha divisória. */
  function inserirBloco(bloco: string) {
    const el = caixa.current
    if (!el) return
    const { selectionStart: i } = el
    const fimLinha = value.indexOf('\n', i) === -1 ? value.length : value.indexOf('\n', i)
    const antes = value.slice(0, fimLinha)
    const trecho = (antes && !antes.endsWith('\n') ? '\n\n' : '') + bloco + '\n\n'
    const texto = antes + trecho + value.slice(fimLinha).replace(/^\n+/, '')
    aplicar(texto, antes.length + trecho.length, antes.length + trecho.length)
  }

  function inserirLink() {
    const el = caixa.current
    if (!el) return
    const { selectionStart: i, selectionEnd: f } = el
    const rotulo = value.slice(i, f) || 'texto do link'
    const trecho = `[${rotulo}](https://)`
    // Cursor dentro dos parênteses: é o endereço que falta digitar.
    const posicao = i + rotulo.length + 3
    aplicar(value.slice(0, i) + trecho + value.slice(f), posicao, posicao + 'https://'.length)
  }

  const html = textoRicoParaHtml(value)

  return (
    <div className="rounded-xl border border-input overflow-hidden bg-background">
      <div className="flex items-center gap-0.5 flex-wrap border-b border-border bg-muted/40 px-1.5 py-1">
        <Ferramenta titulo="Título" onClick={() => prefixar('# ')} desabilitada={vendo}>
          <Heading2 className="h-4 w-4" />
        </Ferramenta>
        <Ferramenta titulo="Subtítulo" onClick={() => prefixar('## ')} desabilitada={vendo}>
          <Heading3 className="h-4 w-4" />
        </Ferramenta>
        <Divisoria />
        <Ferramenta titulo="Negrito" onClick={() => envolver('**')} desabilitada={vendo}>
          <Bold className="h-4 w-4" />
        </Ferramenta>
        <Ferramenta titulo="Itálico" onClick={() => envolver('*')} desabilitada={vendo}>
          <Italic className="h-4 w-4" />
        </Ferramenta>
        <Divisoria />
        <Ferramenta titulo="Lista" onClick={() => prefixar('- ')} desabilitada={vendo}>
          <List className="h-4 w-4" />
        </Ferramenta>
        <Ferramenta
          titulo="Lista numerada"
          onClick={() => prefixar((n) => `${n + 1}. `)}
          desabilitada={vendo}
        >
          <ListOrdered className="h-4 w-4" />
        </Ferramenta>
        <Ferramenta titulo="Citação" onClick={() => prefixar('> ')} desabilitada={vendo}>
          <Quote className="h-4 w-4" />
        </Ferramenta>
        <Divisoria />
        <Ferramenta titulo="Link" onClick={inserirLink} desabilitada={vendo}>
          <Link2 className="h-4 w-4" />
        </Ferramenta>
        <Ferramenta titulo="Linha divisória" onClick={() => inserirBloco('---')} desabilitada={vendo}>
          <Minus className="h-4 w-4" />
        </Ferramenta>

        <button
          type="button"
          onClick={() => setVendo((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {vendo ? <PenLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {vendo ? 'Escrever' : 'Visualizar'}
        </button>
      </div>

      {vendo ? (
        <div className="px-3 py-2.5" style={{ minHeight: `${minRows * 1.5}rem` }}>
          {value.trim() ? (
            <LinkPreviewLayer className="texto-rico" html={html} />
          ) : (
            <p className="text-sm text-muted-foreground">Nada escrito ainda.</p>
          )}
        </div>
      ) : (
        <textarea
          id={id}
          ref={caixa}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={minRows}
          placeholder={placeholder}
          className="w-full resize-y bg-transparent px-3 py-2.5 text-base md:text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        />
      )}

      <p className="border-t border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        {AJUDA}
      </p>
    </div>
  )
}

function Ferramenta({
  titulo,
  onClick,
  desabilitada,
  children,
}: {
  titulo: string
  onClick: () => void
  desabilitada?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitada}
      title={titulo}
      aria-label={titulo}
      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  )
}

const Divisoria = () => <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
