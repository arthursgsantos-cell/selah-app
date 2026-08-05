import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GraduationCap, ArrowLeft, ChevronRight, UserCog, BookOpen, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { listarTurmas, minhasInscricoesPorTurma } from '@/lib/ensino/consultas'
import { TurmaCard } from '@/components/ensino/turma-card'
import { CriarTurmaDialog } from '@/components/ensino/criar-turma-dialog'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Ensino · Igreja Batista Zona Sul',
  description: 'Cursos, turmas e materiais da Escola Bíblica da IBZS.',
}

export default async function EnsinoPage() {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom('/ensino'))

  const supabase = await createClient()

  const [turmas, minhas, cursosRes] = await Promise.all([
    listarTurmas({ igrejaId: acesso.igrejaId }),
    minhasInscricoesPorTurma(acesso.userId),
    supabase
      .from('ensino_cursos')
      .select('id, nome')
      .eq('igreja_id', acesso.igrejaId)
      .eq('ativo', true)
      .order('ordem')
      .order('nome'),
  ])

  const cursos = cursosRes.data ?? []

  // Concluídas e canceladas descem para o fim: a vitrine é de quem ainda pode
  // receber aluno.
  const abertas = turmas.filter((t) => t.status === 'aberta' || t.status === 'em_andamento')
  const encerradas = turmas.filter((t) => t.status === 'concluida' || t.status === 'cancelada')

  const minhasTurmas = turmas.filter((t) => minhas[t.id])

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-6">
      <Link
        href="/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      {/* Capa da área */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0B2447] via-[#19376D] to-[#0F52BA] p-6 text-white shadow-lg">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }}
        />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Ensino</h1>
            <p className="text-white/70 text-sm mt-0.5">
              Cursos, turmas e materiais da Escola Bíblica
            </p>
          </div>
        </div>
      </div>

      {/* Atalhos por perfil */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Atalho
          href="/ensino/aluno"
          icone={<BookOpen className="h-5 w-5" />}
          titulo="Meus cursos"
          descricao={
            minhasTurmas.length > 0
              ? `${minhasTurmas.length} ${minhasTurmas.length === 1 ? 'turma' : 'turmas'}`
              : 'Frequência e materiais'
          }
        />
        {acesso.professor && (
          <Atalho
            href="/ensino/professor"
            icone={<UserCog className="h-5 w-5" />}
            titulo="Painel do professor"
            descricao="Chamada, alunos e materiais"
          />
        )}
        {acesso.coordenador && (
          <Atalho
            href="/ensino/admin"
            icone={<Settings className="h-5 w-5" />}
            titulo="Administração"
            descricao="Cursos, professores e relatórios"
          />
        )}
      </div>

      {/* Turmas abertas */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Turmas
          </p>
          {acesso.professor && <CriarTurmaDialog cursos={cursos} />}
        </div>

        {abertas.length > 0 ? (
          <div className="space-y-3">
            {abertas.map((turma) => (
              <TurmaCard key={turma.id} turma={turma} minhaInscricao={minhas[turma.id] ?? null} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma turma aberta no momento</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {acesso.professor
                  ? 'Crie a primeira turma para começar.'
                  : 'Quando a Escola Bíblica abrir uma turma, ela aparece aqui.'}
              </p>
              {acesso.professor && (
                <div className="mt-4 flex justify-center">
                  <CriarTurmaDialog cursos={cursos} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {encerradas.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Encerradas
          </p>
          <div className="space-y-3 opacity-60">
            {encerradas.map((turma) => (
              <TurmaCard key={turma.id} turma={turma} minhaInscricao={minhas[turma.id] ?? null} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Atalho({
  href,
  icone,
  titulo,
  descricao,
}: {
  href: string
  icone: React.ReactNode
  titulo: string
  descricao: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icone}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{descricao}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
