'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus, Loader2, Trash2, Pencil, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { MateriaisLista, type MaterialItem } from '@/components/ensino/materiais-lista'
import {
  salvarMaterialAction, editarMaterialAction, excluirMaterialAction,
} from '@/app/actions/ensino/materiais'
import type { TipoMaterial } from '@/lib/supabase/types'

const campoClass =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

export interface AulaOpcao {
  id: string
  numero: number
  titulo: string | null
}

export function MateriaisGestao({
  turmaId,
  materiais,
  aulas,
}: {
  turmaId: string
  materiais: MaterialItem[]
  aulas: AulaOpcao[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function excluir(id: string) {
    setErro(null)
    startTransition(async () => {
      const r = await excluirMaterialAction(id)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <NovoMaterialDialog turmaId={turmaId} aulas={aulas} />

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <MateriaisLista
        materiais={materiais}
        acoes={(m) => (
          <>
            <EditarMaterialDialog material={m} aulas={aulas} />
            <button
              type="button"
              onClick={() => excluir(m.id)}
              disabled={isPending}
              aria-label={`Excluir ${m.titulo}`}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      />
    </div>
  )
}

function NovoMaterialDialog({ turmaId, aulas }: { turmaId: string; aulas: AulaOpcao[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoMaterial>('arquivo')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const formData = new FormData(e.currentTarget)
    formData.set('turmaId', turmaId)

    startTransition(async () => {
      const r = await salvarMaterialAction(formData)
      if (!r.ok) { setErro(r.erro); return }
      setOpen(false)
      setArquivo(null)
      formRef.current?.reset()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FilePlus className="h-4 w-4" />
        Novo material
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo material</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={submeter} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mat-titulo">Título</Label>
            <Input id="mat-titulo" name="titulo" placeholder="Ex: Apostila da aula 1" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mat-tipo">Tipo</Label>
            <select
              id="mat-tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoMaterial)}
              className={campoClass}
            >
              <option value="arquivo">Arquivo (PDF, imagem, slides)</option>
              <option value="link">Link</option>
              <option value="video">Vídeo</option>
            </select>
          </div>

          {tipo === 'arquivo' ? (
            <div className="space-y-1.5">
              <Label htmlFor="mat-arquivo">Arquivo</Label>
              <label
                htmlFor="mat-arquivo"
                className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed border-input px-3 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
              >
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {arquivo ? arquivo.name : 'Escolher arquivo · até 50 MB'}
                </span>
              </label>
              <input
                id="mat-arquivo"
                name="arquivo"
                type="file"
                required
                className="hidden"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                O arquivo fica em área privada: só quem tem inscrição aprovada consegue abrir.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="mat-url">Endereço</Label>
              <Input
                id="mat-url"
                name="url"
                type="url"
                placeholder="https://..."
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="mat-aula">Aula (opcional)</Label>
            <select id="mat-aula" name="aulaId" className={campoClass} defaultValue="">
              <option value="">Material da turma inteira</option>
              {aulas.map((a) => (
                <option key={a.id} value={a.id}>
                  Aula {a.numero}
                  {a.titulo ? ` — ${a.titulo}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mat-desc">Descrição (opcional)</Label>
            <Textarea id="mat-desc" name="descricao" rows={2} />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border bg-muted/30 p-3">
            <input type="checkbox" name="publico" className="rounded border-input h-4 w-4 accent-primary mt-0.5" />
            <span className="text-sm">
              Material público
              <span className="block text-xs text-muted-foreground">
                Qualquer pessoa da igreja pode abrir, mesmo sem estar inscrita na turma.
              </span>
            </span>
          </label>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? 'Enviando...' : 'Publicar material'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditarMaterialDialog({
  material,
  aulas,
}: {
  material: MaterialItem
  aulas: AulaOpcao[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [titulo, setTitulo] = useState(material.titulo)
  const [descricao, setDescricao] = useState(material.descricao ?? '')
  const [publico, setPublico] = useState(material.publico)
  const [aulaId, setAulaId] = useState(
    aulas.find((a) => a.numero === material.aulaNumero)?.id ?? ''
  )

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const r = await editarMaterialAction(material.id, {
        titulo,
        descricao: descricao || null,
        aulaId: aulaId || null,
        publico,
      })
      if (!r.ok) { setErro(r.erro); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Editar ${material.titulo}`}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          />
        }
      >
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar material</DialogTitle>
        </DialogHeader>

        <form onSubmit={submeter} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ed-titulo">Título</Label>
            <Input id="ed-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ed-aula">Aula</Label>
            <select
              id="ed-aula"
              value={aulaId}
              onChange={(e) => setAulaId(e.target.value)}
              className={campoClass}
            >
              <option value="">Material da turma inteira</option>
              {aulas.map((a) => (
                <option key={a.id} value={a.id}>
                  Aula {a.numero}
                  {a.titulo ? ` — ${a.titulo}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ed-desc">Descrição</Label>
            <Textarea
              id="ed-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={publico}
              onChange={(e) => setPublico(e.target.checked)}
              className="rounded border-input h-4 w-4 accent-primary"
            />
            <span className="text-sm">Material público</span>
          </label>

          {material.tipo === 'arquivo' && (
            <p className="text-xs text-muted-foreground">
              Para trocar o arquivo, exclua este material e publique outro.
            </p>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
