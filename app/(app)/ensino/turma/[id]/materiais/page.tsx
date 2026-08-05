import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { MateriaisGestao, type AulaOpcao } from '@/components/ensino/materiais-gestao'
import type { MaterialItem } from '@/components/ensino/materiais-lista'

export const metadata = { title: 'Materiais da turma · Ensino IBZS' }

export default async function MateriaisTurmaPage({ params }: { params: { id: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/turma/${params.id}/materiais`))

  const admin = createAdminClient()

  const { data: turmaRaw } = await admin
    .from('ensino_turmas')
    .select('id, nome, ensino_cursos(nome)')
    .eq('id', params.id)
    .maybeSingle()

  if (!turmaRaw) notFound()
  if (!(await podeLecionar(acesso, params.id))) redirect(`/ensino/turma/${params.id}`)

  const turma = turmaRaw as unknown as {
    id: string; nome: string; ensino_cursos: { nome: string } | null
  }

  const [materiaisRes, aulasRes] = await Promise.all([
    admin
      .from('ensino_materiais')
      .select('id, titulo, descricao, tipo, arquivo_nome, arquivo_tamanho, publico, criado_em, ensino_aulas(numero)')
      .eq('turma_id', turma.id)
      .order('ordem')
      .order('criado_em', { ascending: false }),
    admin
      .from('ensino_aulas')
      .select('id, numero, titulo')
      .eq('turma_id', turma.id)
      .order('numero'),
  ])

  const materiais: MaterialItem[] = ((materiaisRes.data ?? []) as unknown as {
    id: string; titulo: string; descricao: string | null; tipo: MaterialItem['tipo']
    arquivo_nome: string | null; arquivo_tamanho: number | null
    publico: boolean; criado_em: string; ensino_aulas: { numero: number } | null
  }[]).map((m) => ({
    id: m.id,
    titulo: m.titulo,
    descricao: m.descricao,
    tipo: m.tipo,
    arquivoNome: m.arquivo_nome,
    arquivoTamanho: m.arquivo_tamanho,
    publico: m.publico,
    criadoEm: m.criado_em,
    aulaNumero: m.ensino_aulas?.numero ?? null,
  }))

  const aulas = (aulasRes.data ?? []) as AulaOpcao[]

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      <Link
        href={`/ensino/turma/${turma.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        {turma.nome}
      </Link>

      <div>
        <h1 className="text-xl font-bold leading-tight">Materiais</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {turma.ensino_cursos?.nome} · {turma.nome}
        </p>
      </div>

      <MateriaisGestao turmaId={turma.id} materiais={materiais} aulas={aulas} />
    </div>
  )
}
