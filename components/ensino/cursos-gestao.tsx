'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookPlus, Loader2, Trash2, Pencil, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { criarCursoAction, editarCursoAction, excluirCursoAction } from '@/app/actions/ensino/cursos'

export interface CursoGestao {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
  turmas: number
}

export function CursosGestao({
  cursos,
  podeExcluir,
}: {
  cursos: CursoGestao[]
  podeExcluir: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  function excluir(id: string) {
    setErro(null)
    startTransition(async () => {
      const r = await excluirCursoAction(id)
      setConfirmando(null)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <CursoDialog />

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {cursos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum curso cadastrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            O curso é o guarda-chuva das turmas — ex: &ldquo;Fundamentos da Fé&rdquo;.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border divide-y overflow-hidden">
          {cursos.map((c) => (
            <div key={c.id} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">
                    {c.nome}
                    {!c.ativo && (
                      <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.turmas} {c.turmas === 1 ? 'turma' : 'turmas'}
                    {c.descricao && ` · ${c.descricao}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <CursoDialog curso={c} />
                  {podeExcluir && (
                    <button
                      type="button"
                      onClick={() => setConfirmando(c.id)}
                      disabled={isPending}
                      aria-label={`Excluir ${c.nome}`}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {confirmando === c.id && (
                <div className="mt-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <p className="text-xs">
                    Excluir <strong>{c.nome}</strong> apaga também{' '}
                    {c.turmas === 0 ? 'nenhuma turma' : `${c.turmas} ${c.turmas === 1 ? 'turma' : 'turmas'}`},
                    com as inscrições, presenças e materiais. Não dá para desfazer.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="xs" onClick={() => excluir(c.id)} disabled={isPending}>
                      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Excluir mesmo assim
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CursoDialog({ curso }: { curso?: CursoGestao }) {
  const editando = curso !== undefined
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState(curso?.nome ?? '')
  const [descricao, setDescricao] = useState(curso?.descricao ?? '')
  const [ativo, setAtivo] = useState(curso?.ativo ?? true)

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setErro(null)

    startTransition(async () => {
      const r = editando
        ? await editarCursoAction(curso!.id, { nome, descricao: descricao || null, ativo })
        : await criarCursoAction({ nome, descricao: descricao || null })

      if (!r.ok) { setErro(r.erro); return }
      setOpen(false)
      if (!editando) { setNome(''); setDescricao('') }
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editando ? (
            <button
              type="button"
              aria-label={`Editar ${curso.nome}`}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            />
          ) : (
            <Button size="sm" variant="outline" />
          )
        }
      >
        {editando ? (
          <Pencil className="h-3.5 w-3.5" />
        ) : (
          <>
            <BookPlus className="h-4 w-4" />
            Novo curso
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar curso' : 'Novo curso'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submeter} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="curso-nome">Nome</Label>
            <Input
              id="curso-nome"
              placeholder="Ex: Fundamentos da Fé"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="curso-desc">Descrição (opcional)</Label>
            <Textarea
              id="curso-desc"
              placeholder="Sobre o que é o curso..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          {editando && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="rounded border-input h-4 w-4 accent-primary"
              />
              <span className="text-sm">
                Curso ativo
                <span className="block text-xs text-muted-foreground">
                  Inativo some da lista ao criar turmas novas.
                </span>
              </span>
            </label>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={!nome.trim() || isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editando ? 'Salvar' : 'Criar curso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
