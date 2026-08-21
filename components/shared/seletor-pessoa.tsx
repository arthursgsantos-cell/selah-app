'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buscarPessoasDaIgrejaAction, cadastrarPessoaSemContaAction,
  type PessoaDaIgreja,
} from '@/app/actions/pessoas'

interface Props {
  valor: PessoaDaIgreja | null
  onEscolher: (pessoa: PessoaDaIgreja | null) => void
  /** Texto do botão quando ninguém foi escolhido ainda. */
  rotulo?: string
  /** Vai para a ficha de quem for cadastrado na hora. */
  obsCadastro?: string
}

function Retrato({ pessoa }: { pessoa: PessoaDaIgreja }) {
  const iniciais = pessoa.nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  if (pessoa.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pessoa.avatarUrl}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
      {iniciais}
    </span>
  )
}

/**
 * Escolher uma pessoa da igreja — ou cadastrar quem ainda não está lá.
 *
 * Um campo só que **busca** quem o app já conhece enquanto **serve de
 * formulário** para quem ele não conhece, como no cadastro de professor do
 * Ensino. Abre embutido, e não num segundo diálogo, porque quase sempre é
 * usado de dentro de um: diálogo sobre diálogo prende o foco e some no
 * celular.
 */
export function SeletorPessoa({
  valor,
  onEscolher,
  rotulo = 'Escolher pessoa',
  obsCadastro,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [resultados, setResultados] = useState<PessoaDaIgreja[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciarSalvar] = useTransition()

  // Cada busca leva o número da vez: resposta antiga que chega atrasada é
  // descartada em vez de sobrescrever a lista do termo atual.
  const buscaAtual = useRef(0)
  const termo = nome.trim()

  useEffect(() => {
    if (!aberto || termo.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }

    const vez = ++buscaAtual.current
    setBuscando(true)

    // Espera a digitação parar: sem isso, "Maria Aparecida" dispararia quinze
    // consultas para chegar ao mesmo resultado.
    const timer = setTimeout(async () => {
      const achados = await buscarPessoasDaIgrejaAction(termo)
      if (vez !== buscaAtual.current) return
      setResultados(achados)
      setBuscando(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [aberto, termo])

  function fechar() {
    setAberto(false)
    setNome(''); setTelefone(''); setEmail('')
    setResultados([]); setErro(null)
  }

  function escolher(pessoa: PessoaDaIgreja) {
    onEscolher(pessoa)
    fechar()
  }

  function cadastrar() {
    setErro(null)
    iniciarSalvar(async () => {
      const r = await cadastrarPessoaSemContaAction({ nome, telefone, email, obs: obsCadastro })
      if (!r.ok) { setErro(r.erro); return }
      escolher(r.pessoa)
    })
  }

  if (valor) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
        <Retrato pessoa={valor} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{valor.nome}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {valor.tipo === 'profile' ? 'usa o app' : 'na lista da igreja'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEscolher(null)}
          aria-label={`Tirar ${valor.nome}`}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (!aberto) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => setAberto(true)}
      >
        <UserPlus className="h-4 w-4" />
        {rotulo}
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-2.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome, telefone ou e-mail"
            className="pl-8"
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar busca"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {termo.length >= 2 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Já na igreja
            {buscando && <Loader2 className="h-3 w-3 animate-spin" />}
          </p>

          {!buscando && resultados.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ninguém com esse nome. Dá para cadastrar abaixo.
            </p>
          ) : (
            <div className="divide-y overflow-hidden rounded-lg border border-border">
              {resultados.map((p) => (
                <button
                  key={`${p.tipo}-${p.id}`}
                  type="button"
                  onClick={() => escolher(p)}
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
                >
                  <Retrato pessoa={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{p.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.tipo === 'profile' ? 'usa o app' : 'na lista da igreja'}
                      {p.detalhe ? ` · ${p.detalhe}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {termo.length >= 2 && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Cadastrar {termo}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Telefone (opcional)"
              inputMode="tel"
            />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail (opcional)"
              inputMode="email"
              autoCapitalize="none"
            />
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={cadastrar}
            disabled={salvando}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Cadastrar na igreja e escolher
          </Button>
        </div>
      )}
    </div>
  )
}
