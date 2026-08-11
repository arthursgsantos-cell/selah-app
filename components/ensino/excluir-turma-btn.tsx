'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { excluirTurmaAction } from '@/app/actions/ensino/turmas'

/**
 * Excluir a turma — só coordenação, e só depois de ler o que vai junto.
 *
 * Vive fora do `<form>` da turma de propósito: um botão dentro dele
 * concorreria com o "Salvar alterações", e não é para ficar à mão de quem só
 * veio corrigir o horário.
 *
 * A confirmação diz os números em vez de perguntar "tem certeza?": a cascata
 * do banco leva inscrições, presenças, aulas e materiais, e é isso que a
 * pessoa precisa pesar antes de clicar.
 */
export function ExcluirTurmaBtn({
  turmaId,
  nome,
  alunos,
  aulas,
  materiais,
}: {
  turmaId: string
  nome: string
  alunos: number
  aulas: number
  materiais: number
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function excluir() {
    setErro(null)
    startTransition(async () => {
      const r = await excluirTurmaAction(turmaId)
      if (!r.ok) { setErro(r.erro); return }
      router.push('/ensino')
      router.refresh()
    })
  }

  const leva = [
    alunos > 0 && `${alunos} ${alunos === 1 ? 'inscrição' : 'inscrições'}`,
    aulas > 0 && `${aulas} ${aulas === 1 ? 'aula' : 'aulas'} (com as presenças)`,
    materiais > 0 && `${materiais} ${materiais === 1 ? 'material' : 'materiais'}`,
  ].filter((x): x is string => typeof x === 'string')

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div>
        <h2 className="text-xs font-semibold text-destructive uppercase tracking-widest">
          Excluir turma
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Some do app para todo mundo. Para tirar do ar sem apagar nada, mude a
          situação para <strong>Cancelada</strong> ali em cima.
        </p>
      </div>

      {confirmando ? (
        <div className="space-y-2.5">
          <p className="text-sm">
            Excluir <strong>{nome}</strong>
            {leva.length > 0 ? (
              <> apaga junto {leva.join(', ')}.</>
            ) : (
              <> — ela ainda não tem inscrição, aula nem material.</>
            )}{' '}
            Não dá para desfazer.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={excluir} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Excluir mesmo assim
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
          <Trash2 className="h-3.5 w-3.5" />
          Excluir esta turma
        </Button>
      )}

      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </section>
  )
}
