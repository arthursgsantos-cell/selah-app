import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Users, GraduationCap, Award, ClipboardCheck } from 'lucide-react'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { listarAlunos } from '@/lib/ensino/alunos'
import { corFrequencia } from '@/lib/ensino/turma'
import { AlunosTabela, type AlunoLinha } from '@/components/ensino/alunos-tabela'

export const metadata = { title: 'Alunos do Ensino · IBZS' }

/**
 * Todos os alunos da igreja numa tabela só.
 *
 * É a visão que faltava: as outras telas listam quem está *naquela* turma, e a
 * coordenação precisa da pessoa — quem já passou por quais cursos, com que
 * frequência. Cada linha abre a ficha em `/ensino/alunos/[slug]`.
 *
 * Restrito à coordenação, e não a todo professor: a tabela cruza turmas que ele
 * não leciona com célula e contato, e a RLS que protege isso no banco é
 * justamente a que o cliente admin desta consulta ignora.
 */
export default async function AlunosEnsinoPage() {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom('/ensino/alunos'))
  if (!acesso.coordenador) redirect('/ensino')

  const alunos = await listarAlunos(acesso.igrejaId)

  const linhas: AlunoLinha[] = alunos.map((a) => ({
    slug: a.slug,
    nome: a.nome,
    avatarUrl: a.avatarUrl,
    temConta: a.temConta,
    celula: a.celulas[0]?.nome ?? null,
    cursos: [...new Set(a.matriculas.map((m) => m.cursoNome))],
    ativas: a.ativas,
    concluidas: a.concluidas,
    pendentes: a.pendentes,
    percentual: a.percentual,
    registros: a.registros,
    // O que a carteirinha abre ao clicar na linha. `listarAlunos` já traz tudo
    // isto, então não custa uma consulta a mais.
    email: a.email,
    telefone: a.telefone,
    presentes: a.presentes,
    celulas: a.celulas.map((c) => ({ nome: c.nome, papel: c.papel, redeNome: c.redeNome })),
    matriculas: a.matriculas.map((m) => ({
      turmaId: m.turmaId,
      turmaNome: m.turmaNome,
      cursoNome: m.cursoNome,
      status: m.status,
      modo: m.modo,
      presentes: m.presentes,
      registros: m.registros,
      percentual: m.percentual,
    })),
  }))

  const presentes = alunos.reduce((s, a) => s + a.presentes, 0)
  const registros = alunos.reduce((s, a) => s + a.registros, 0)
  const media = registros > 0 ? Math.round((presentes / registros) * 100) : null
  const concluintes = alunos.filter((a) => a.concluidas > 0).length
  const emCurso = alunos.filter((a) => a.ativas > 0).length

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-6">
      <Link
        href="/ensino/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Administração
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Alunos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Todo mundo que já passou pela Escola Bíblica
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Indicador icone={<Users className="h-4 w-4" />} valor={alunos.length} rotulo="alunos" />
        <Indicador icone={<GraduationCap className="h-4 w-4" />} valor={emCurso} rotulo="em curso" />
        <Indicador icone={<Award className="h-4 w-4" />} valor={concluintes} rotulo="concluíram" />
        <Indicador
          icone={<ClipboardCheck className="h-4 w-4" />}
          valor={media === null ? '—' : `${media}%`}
          rotulo="presença média"
          classe={corFrequencia(media)}
        />
      </div>

      <AlunosTabela alunos={linhas} />
    </div>
  )
}

function Indicador({
  icone, valor, rotulo, classe,
}: {
  icone: React.ReactNode
  valor: number | string
  rotulo: string
  classe?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-muted-foreground">{icone}</div>
      <p className={`text-xl font-bold leading-none mt-1.5 ${classe ?? ''}`}>{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{rotulo}</p>
    </div>
  )
}
