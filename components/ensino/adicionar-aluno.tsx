'use client'

/**
 * Cadastro de aluno pela mão do professor.
 *
 * A tela foi desenhada para copiar uma lista de papel, não para preencher uma
 * ficha: um campo só de nome, que ao mesmo tempo **busca** quem o app já
 * conhece e **serve de formulário** para quem ele não conhece. Telefone e
 * e-mail ficam abertos ao lado, opcionais — se o professor souber, digita; se
 * não, segue.
 *
 * O diálogo não fecha ao adicionar. Quem está com quinze nomes na mão precisa
 * do próximo campo limpo e do foco de volta, não de reabrir tudo a cada aluno;
 * os já lançados ficam listados embaixo para ele não perder a conta.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2, Search, Check, Smartphone, ListPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  buscarPessoasParaTurma,
  adicionarPessoaTurmaAction,
  cadastrarAlunoManualAction,
  type PessoaEncontrada,
} from '@/app/actions/ensino/alunos-manuais'

function iniciais(nome: string): string {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export function AdicionarAluno({ turmaId }: { turmaId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [resultados, setResultados] = useState<PessoaEncontrada[]>([])
  const [buscando, setBuscando] = useState(false)
  const [salvando, startSalvar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [adicionados, setAdicionados] = useState<string[]>([])

  // Ref no contêiner, e não no `Input`: ele é um componente de função sem
  // `forwardRef`, então uma ref passada direto chegaria nula.
  const campoNome = useRef<HTMLDivElement>(null)
  // Cada busca leva o número da vez: resposta antiga que chega atrasada é
  // descartada em vez de sobrescrever a lista do termo atual.
  const buscaAtual = useRef(0)

  const termo = nome.trim()

  useEffect(() => {
    if (!open || termo.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }

    const vez = ++buscaAtual.current
    setBuscando(true)

    // Espera a digitação parar: sem isso, "Maria Aparecida" dispararia quinze
    // consultas para chegar ao mesmo resultado.
    const timer = setTimeout(async () => {
      const achados = await buscarPessoasParaTurma(turmaId, termo)
      if (vez !== buscaAtual.current) return
      setResultados(achados)
      setBuscando(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [open, termo, turmaId])

  /** Limpa para o próximo da lista, sem fechar. */
  function concluir(nomeAdicionado: string) {
    setAdicionados((a) => [nomeAdicionado, ...a])
    setNome('')
    setTelefone('')
    setEmail('')
    setResultados([])
    campoNome.current?.querySelector('input')?.focus()
    router.refresh()
  }

  function adicionarExistente(pessoa: PessoaEncontrada) {
    setErro(null)
    startSalvar(async () => {
      const r = await adicionarPessoaTurmaAction({
        turmaId,
        tipo: pessoa.tipo,
        pessoaId: pessoa.id,
      })
      if (!r.ok) { setErro(r.erro); return }
      concluir(r.nome)
    })
  }

  function cadastrarNovo() {
    setErro(null)
    startSalvar(async () => {
      const r = await cadastrarAlunoManualAction({ turmaId, nome, telefone, email })
      if (!r.ok) { setErro(r.erro); return }
      concluir(r.nome)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        setOpen(aberto)
        if (!aberto) {
          setNome(''); setTelefone(''); setEmail('')
          setResultados([]); setErro(null); setAdicionados([])
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlus className="h-4 w-4" />
        Adicionar aluno
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar aluno à turma</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative" ref={campoNome}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && termo.length >= 2 && !salvando) {
                  e.preventDefault()
                  cadastrarNovo()
                }
              }}
              placeholder="Nome do aluno"
              className="pl-8"
              autoFocus
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {/* Quem o app já conhece aparece antes do formulário: cadastrar de
              novo alguém que já tem perfil criaria uma segunda ficha, sem o
              histórico da primeira. */}
          {termo.length >= 2 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                Já cadastrados na igreja
                {buscando && <Loader2 className="h-3 w-3 animate-spin" />}
              </p>

              {!buscando && resultados.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Ninguém com esse nome. Cadastre abaixo.
                </p>
              ) : (
                <div className="rounded-xl border border-border divide-y overflow-hidden">
                  {resultados.map((p) => (
                    <div key={`${p.tipo}-${p.id}`} className="flex items-center gap-2.5 px-2.5 py-2">
                      <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            referrerPolicy="no-referrer"
                            src={p.avatarUrl}
                            alt={p.nome}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          iniciais(p.nome)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight truncate">{p.nome}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {p.tipo === 'profile' ? 'usa o app' : 'na lista da igreja'}
                          {p.telefone && ` · ${p.telefone}`}
                          {!p.telefone && p.email && ` · ${p.email}`}
                        </p>
                      </div>

                      {p.jaNaTurma ? (
                        <span className="text-[11px] text-muted-foreground shrink-0 px-1.5">
                          já está
                        </span>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => adicionarExistente(p)}
                          disabled={salvando}
                        >
                          Adicionar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cadastro na mão */}
          <div className="rounded-xl border border-border p-3 space-y-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Cadastrar na mão
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

            <Button
              className="w-full"
              onClick={cadastrarNovo}
              disabled={salvando || termo.length < 2}
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
              {termo.length >= 2 ? `Cadastrar ${termo}` : 'Cadastrar aluno'}
            </Button>

            <p className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5">
              <Smartphone className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>
                Só o nome é obrigatório. Quando a pessoa criar conta no app, a inscrição e as
                presenças que você lançar agora passam para ela.
              </span>
            </p>
          </div>

          {adicionados.length > 0 && (
            <div className="border-t pt-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                Adicionados agora ({adicionados.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {adicionados.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700"
                  >
                    <Check className="h-3 w-3" />
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
