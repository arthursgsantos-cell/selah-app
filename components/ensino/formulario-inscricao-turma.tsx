'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Clock, Loader2, UserCircle, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CamposFormulario } from '@/components/shared/campos-formulario'
import { validarRespostas } from '@/lib/formulario-condicional'
import { inscreverAction } from '@/app/actions/ensino/inscricoes'
import type { CampoFormulario, StatusInscricaoEnsino } from '@/lib/supabase/types'

interface Props {
  turmaId: string
  turmaNome: string
  cursoNome: string
  /** Dados do perfil, mostrados para conferência em vez de redigitados. */
  perfil: { nome: string; telefone: string | null; email: string | null }
  campos: CampoFormulario[]
  aprovacaoAutomatica: boolean
}

export function FormularioInscricaoTurma({
  turmaId, turmaNome, cursoNome, perfil, campos, aprovacaoAutomatica,
}: Props) {
  const router = useRouter()
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [concluido, setConcluido] = useState<StatusInscricaoEnsino | null>(null)
  const [isPending, startTransition] = useTransition()

  function set(id: string, valor: string) {
    setRespostas((prev) => ({ ...prev, [id]: valor }))
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (campos.length > 0) {
      const problema = validarRespostas(campos, respostas)
      if (problema) { setErro(problema); return }
    }

    startTransition(async () => {
      const r = await inscreverAction({ turmaId, dados: respostas })
      if (!r.ok) { setErro(r.erro); return }
      setConcluido(r.status)
      router.refresh()
    })
  }

  if (concluido) {
    const aprovada = concluido === 'aprovada'
    return (
      <div
        className={`rounded-2xl border p-6 text-center space-y-3 ${
          aprovada ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        {aprovada ? (
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
        ) : (
          <Clock className="h-10 w-10 text-amber-600 mx-auto" />
        )}
        <p className={`font-semibold ${aprovada ? 'text-green-700' : 'text-amber-700'}`}>
          {aprovada ? 'Inscrição confirmada!' : 'Pedido enviado!'}
        </p>
        <p className="text-sm text-muted-foreground">
          {aprovada
            ? 'Você já faz parte da turma. As aulas e os materiais aparecem na página dela.'
            : 'O professor vai avaliar seu pedido. Você acompanha o resultado em "Meus cursos".'}
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <Button size="sm" render={<Link href={`/ensino/turma/${turmaId}`} />}>
            Ver a turma
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/ensino/aluno" />}>
            Meus cursos
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      {/* Dados do perfil — conferência, não digitação */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Seus dados</p>
        </div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-20 shrink-0">Nome</dt>
            <dd className="font-medium">{perfil.nome}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-20 shrink-0">WhatsApp</dt>
            <dd className={perfil.telefone ? 'font-medium' : 'text-muted-foreground italic'}>
              {perfil.telefone ?? 'não cadastrado'}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-20 shrink-0">E-mail</dt>
            <dd className={perfil.email ? 'font-medium truncate' : 'text-muted-foreground italic'}>
              {perfil.email ?? 'não cadastrado'}
            </dd>
          </div>
        </dl>
        <Link
          href="/perfil"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
        >
          <Pencil className="h-3 w-3" />
          Corrigir no meu perfil
        </Link>
      </div>

      {campos.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Perguntas da turma
          </p>
          <CamposFormulario campos={campos} respostas={respostas} onChange={set} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-muted/40 p-4">
        <p className="text-sm">
          Confirmar inscrição em <span className="font-semibold">{turmaNome}</span>
          <span className="text-muted-foreground"> ({cursoNome})</span>?
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {aprovacaoAutomatica
            ? 'Sua vaga é confirmada na hora.'
            : 'Seu pedido fica pendente até o professor aprovar.'}
        </p>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isPending ? 'Enviando...' : 'Confirmar inscrição'}
      </Button>
    </form>
  )
}
