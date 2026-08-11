import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Check, X, Minus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { corFrequencia, dataBr } from '@/lib/ensino/turma'
import { porSlugOuId } from '@/lib/slug-ou-id'
import type { StatusAula } from '@/lib/supabase/types'

export const metadata = { title: 'Frequência da turma · Ensino IBZS' }

/**
 * Histórico de presença da turma inteira.
 *
 * É a tela que substitui a aba de frequência da planilha: uma linha por aluno,
 * uma coluna por aula realizada, e o percentual calculado só sobre as aulas
 * que já aconteceram.
 */
export default async function PresencasTurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/presencas`))

  const admin = createAdminClient()

  const { data: turmaRaw } = await porSlugOuId(
    admin.from('ensino_turmas').select('id, nome, ensino_cursos(nome)'),
    params.id
  ).maybeSingle()

  if (!turmaRaw) notFound()
  if (!(await podeLecionar(acesso, (turmaRaw as { id: string }).id))) {
    redirect(`/ensino/turma/${params.id}`)
  }

  const turma = turmaRaw as unknown as {
    id: string; nome: string; ensino_cursos: { nome: string } | null
  }

  const [aulasRes, inscricoesRes] = await Promise.all([
    admin
      .from('ensino_aulas')
      .select('id, numero, data, status')
      .eq('turma_id', turma.id)
      .neq('status', 'cancelada')
      .order('numero'),
    admin
      .from('ensino_inscricoes')
      .select('id, nome')
      .eq('turma_id', turma.id)
      .in('status', ['aprovada', 'concluida'])
      .order('nome'),
  ])

  const aulas = (aulasRes.data ?? []) as {
    id: string; numero: number; data: string; status: StatusAula
  }[]
  const alunos = (inscricoesRes.data ?? []) as { id: string; nome: string }[]

  const { data: presencas } = await admin
    .from('ensino_presencas')
    .select('aula_id, inscricao_id, presente')
    .in('aula_id', aulas.length > 0 ? aulas.map((a) => a.id) : ['-'])

  // Chave "aula|inscrição" → presente. Um Map plano evita um objeto aninhado
  // que a tabela teria de navegar a cada célula.
  const mapa = new Map<string, boolean>()
  for (const p of presencas ?? []) {
    mapa.set(`${p.aula_id}|${p.inscricao_id}`, p.presente)
  }

  // Só as realizadas contam: incluir aulas futuras faria todo mundo aparecer
  // com frequência baixa desde o primeiro dia.
  const realizadas = aulas.filter((a) => a.status === 'realizada')

  const linhas = alunos.map((aluno) => {
    const marcadas = realizadas.filter((a) => mapa.has(`${a.id}|${aluno.id}`))
    const presentes = marcadas.filter((a) => mapa.get(`${a.id}|${aluno.id}`) === true).length
    const percentual = marcadas.length > 0 ? Math.round((presentes / marcadas.length) * 100) : null
    return { ...aluno, presentes, total: marcadas.length, percentual }
  })

  if (alunos.length === 0 || aulas.length === 0) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto pb-6">
        <Voltar turmaId={params.id} nome={turma.nome} />
        <Cabecalho turma={turma} />
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {alunos.length === 0
              ? 'Nenhum aluno aprovado nesta turma ainda.'
              : 'Nenhuma aula cadastrada ainda.'}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {alunos.length === 0 ? (
              <Link href={`/ensino/turma/${params.id}/alunos`} className="text-primary hover:underline">
                Ver inscrições
              </Link>
            ) : (
              <Link href={`/ensino/turma/${params.id}/aulas`} className="text-primary hover:underline">
                Cadastrar aulas
              </Link>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      <Voltar turmaId={params.id} nome={turma.nome} />
      <Cabecalho turma={turma} />

      <p className="text-xs text-muted-foreground">
        {realizadas.length} de {aulas.length} aulas realizadas · percentual calculado só sobre as
        realizadas
      </p>

      {/* A tabela rola sozinha na horizontal: com 12 aulas ela não cabe na tela
          do celular, e deixar a página inteira rolar de lado atrapalharia. */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left font-medium px-3 py-2 min-w-[10rem]">
                Aluno
              </th>
              {aulas.map((a) => (
                <th key={a.id} className="px-2 py-2 font-medium text-center min-w-[3rem]">
                  <div className="text-xs">{a.numero}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {dataBr(a.data).slice(0, 5)}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-right min-w-[5rem]">Frequência</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map((linha) => (
              <tr key={linha.id}>
                <td className="sticky left-0 z-10 bg-background px-3 py-2 truncate max-w-[12rem]">
                  {linha.nome}
                </td>
                {aulas.map((a) => {
                  const valor = mapa.get(`${a.id}|${linha.id}`)
                  return (
                    <td key={a.id} className="px-2 py-2 text-center">
                      {valor === true ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : valor === false ? (
                        <X className="h-4 w-4 text-red-500 mx-auto" />
                      ) : (
                        <Minus className="h-3 w-3 text-muted-foreground/30 mx-auto" />
                      )}
                    </td>
                  )
                })}
                <td className={`px-3 py-2 text-right font-semibold ${corFrequencia(linha.percentual)}`}>
                  {linha.percentual === null ? '—' : `${linha.percentual}%`}
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {linha.presentes}/{linha.total}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Check className="h-3.5 w-3.5 text-green-600" /> presente
        </span>
        <span className="flex items-center gap-1">
          <X className="h-3.5 w-3.5 text-red-500" /> falta
        </span>
        <span className="flex items-center gap-1">
          <Minus className="h-3 w-3 text-muted-foreground/40" /> sem registro
        </span>
      </div>
    </div>
  )
}

function Voltar({ turmaId, nome }: { turmaId: string; nome: string }) {
  return (
    <Link
      href={`/ensino/turma/${turmaId}`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
    >
      <ArrowLeft className="h-4 w-4" />
      {nome}
    </Link>
  )
}

function Cabecalho({ turma }: { turma: { nome: string; ensino_cursos: { nome: string } | null } }) {
  return (
    <div>
      <h1 className="text-xl font-bold leading-tight">Frequência</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        {turma.ensino_cursos?.nome} · {turma.nome}
      </p>
    </div>
  )
}
