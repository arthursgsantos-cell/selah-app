'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, FileText, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { deletarFormularioAction, duplicarFormularioAction } from '@/app/actions/formularios'
import { FORMULARIO_TEMPLATES } from '@/lib/formulario-templates'
import type { CampoFormulario } from '@/lib/supabase/types'

export interface FormularioItem {
  id: string
  nome: string
  descricao: string | null
  campos: CampoFormulario[]
  template: boolean
  emUso: number
}

export function FormulariosLista({ formularios }: { formularios: FormularioItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const templates = formularios.filter((f) => f.template)
  const normais = formularios.filter((f) => !f.template)

  function excluir(id: string) {
    setErro(null)
    startTransition(async () => {
      try {
        await deletarFormularioAction(id)
        setConfirmando(null)
        router.refresh()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível excluir.')
        setConfirmando(null)
      }
    })
  }

  function duplicar(id: string) {
    setErro(null)
    startTransition(async () => {
      try {
        const novoId = await duplicarFormularioAction(id)
        router.push(`/formularios/${novoId}`)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível duplicar.')
      }
    })
  }

  function Item({ f }: { f: FormularioItem }) {
    return (
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link href={`/formularios/${f.id}`} className="font-medium text-sm hover:underline flex items-center gap-1.5">
                {f.template && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                {f.nome}
              </Link>
              {f.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.descricao}</p>
              )}
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                {f.campos.length} {f.campos.length === 1 ? 'campo' : 'campos'}
                {f.emUso > 0 && ` · usado em ${f.emUso} evento${f.emUso > 1 ? 's' : ''}`}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" render={<Link href={`/formularios/${f.id}`} />}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => duplicar(f.id)}
                disabled={isPending}
                title="Duplicar"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmando(f.id)}
                disabled={isPending}
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {confirmando === f.id && (
            <div className="mt-2.5 pt-2.5 border-t border-border flex items-center gap-2">
              <p className="text-xs text-muted-foreground flex-1">Excluir &quot;{f.nome}&quot;?</p>
              <Button size="xs" variant="destructive" onClick={() => excluir(f.id)} disabled={isPending}>
                Excluir
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setConfirmando(null)}>
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {erro && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{erro}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/formularios/novo" />}>
          <Plus className="h-4 w-4" />
          Criar formulário
        </Button>
      </div>

      {/* Modelos prontos que ainda não viraram formulário */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Começar de um modelo pronto
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FORMULARIO_TEMPLATES.map((t, i) => (
            <Link
              key={i}
              href={`/formularios/novo?tpl=${i}`}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-muted hover:bg-accent border border-border transition-colors"
              title={t.descricao}
            >
              <FileText className="h-3 w-3" />
              {t.nome}
            </Link>
          ))}
        </div>
      </section>

      {templates.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Templates da igreja
          </p>
          {templates.map((f) => <Item key={f.id} f={f} />)}
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Formulários
        </p>
        {normais.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum formulário criado ainda.
          </p>
        ) : (
          normais.map((f) => <Item key={f.id} f={f} />)
        )}
      </section>
    </div>
  )
}
