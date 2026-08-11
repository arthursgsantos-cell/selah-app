import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { TurmaForm } from '@/components/ensino/turma-form'
import { listarCandidatosProfessor } from '@/app/actions/ensino/equipe'

export const metadata = { title: 'Nova turma · Ensino IBZS' }

export default async function NovaTurmaPage() {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom('/ensino/turma/nova'))
  if (!acesso.professor) redirect('/ensino')

  const supabase = await createClient()
  const [cursosRes, candidatos] = await Promise.all([
    supabase
      .from('ensino_cursos')
      .select('id, nome')
      .eq('igreja_id', acesso.igrejaId)
      .eq('ativo', true)
      .order('ordem')
      .order('nome'),
    // A coordenação já decide na criação quem vai dar aula; o professor comum
    // continua entrando como professor da turma que cria.
    acesso.coordenador ? listarCandidatosProfessor() : Promise.resolve(undefined),
  ])
  const cursos = cursosRes.data

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      <Link
        href="/ensino"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Ensino
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Nova turma</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {acesso.coordenador
              ? 'Você entra como professor — troque na seção Professores.'
              : 'Você entra como professor. A coordenação pode trocar depois.'}
          </p>
        </div>
      </div>

      <TurmaForm
        cursos={(cursos ?? []) as { id: string; nome: string }[]}
        candidatos={candidatos}
        professoresIniciais={[{ tipo: 'profile', id: acesso.userId }]}
      />
    </div>
  )
}
