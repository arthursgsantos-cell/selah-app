'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Props {
  valor: string
  onChange: (v: string) => void
  /** Locais já usados em outras turmas, do mais recente para o mais antigo. */
  historico: string[]
  id?: string
  placeholder?: string
}

/**
 * Local da turma, com o histórico da igreja à mão.
 *
 * As salas se repetem — "Sala 2 — Templo" é digitada a cada semestre, e cada
 * pessoa a escreve de um jeito ("sala 2", "Sala 2 - templo"), o que espalha o
 * mesmo lugar em variações que não se agrupam em lugar nenhum.
 *
 * Continua sendo campo de texto, e não uma lista fechada: turma em casa de
 * membro ou num sítio de retiro acontece, e obrigar a escolher de uma lista
 * impediria justamente o caso novo. A lista só é atalho.
 */
export function CampoLocal({
  valor,
  onChange,
  historico,
  id = 'local',
  placeholder = 'Ex: Sala 2 — Templo',
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [destacado, setDestacado] = useState(-1)
  const caixaRef = useRef<HTMLDivElement>(null)

  const sugestoes = useMemo(() => {
    const termo = valor.trim().toLowerCase()
    // Campo vazio mostra o histórico inteiro: é o caso de "abri para escolher".
    // Com texto, filtra — e esconde a sugestão idêntica ao que já está escrito,
    // que não levaria a lugar nenhum.
    return historico
      .filter((l) => {
        const alvo = l.toLowerCase()
        return termo === '' ? true : alvo.includes(termo) && alvo !== termo
      })
      .slice(0, 8)
  }, [valor, historico])

  // Clique fora fecha. Sem isto o painel ficaria aberto por cima do resto do
  // formulário depois que a pessoa desistisse dele.
  useEffect(() => {
    if (!aberto) return
    function aoClicar(e: MouseEvent) {
      if (!caixaRef.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicar)
    return () => document.removeEventListener('mousedown', aoClicar)
  }, [aberto])

  function escolher(local: string) {
    onChange(local)
    setAberto(false)
    setDestacado(-1)
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setAberto(false); return }
    if (sugestoes.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberto(true)
      setDestacado((i) => (i + 1) % sugestoes.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDestacado((i) => (i <= 0 ? sugestoes.length - 1 : i - 1))
    } else if (e.key === 'Enter' && aberto && destacado >= 0) {
      // Só intercepta o Enter quando há uma sugestão destacada — caso
      // contrário ele continua enviando o formulário, como em qualquer campo.
      e.preventDefault()
      escolher(sugestoes[destacado])
    }
  }

  const mostrar = aberto && sugestoes.length > 0

  return (
    <div ref={caixaRef} className="relative">
      <Input
        id={id}
        placeholder={placeholder}
        value={valor}
        autoComplete="off"
        role="combobox"
        aria-expanded={mostrar}
        aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); setAberto(true); setDestacado(-1) }}
        onFocus={() => setAberto(true)}
        onClick={() => setAberto(true)}
        onKeyDown={aoTeclar}
      />

      {mostrar && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
        >
          {sugestoes.map((local, i) => (
            <li key={local}>
              <button
                type="button"
                role="option"
                aria-selected={i === destacado}
                // `mousedown` e não `click`: o clique tira o foco do campo
                // antes de disparar, e o painel fecharia sem escolher nada.
                onMouseDown={(e) => { e.preventDefault(); escolher(local) }}
                onMouseEnter={() => setDestacado(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  i === destacado ? 'bg-accent' : ''
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{local}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
