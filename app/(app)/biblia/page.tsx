import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, AlertTriangle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loginCom } from '@/lib/destino-login'

export const metadata = { title: 'Bíblia · IBZS' }

/**
 * O índice da Bíblia.
 *
 * Existe por causa dos desafios de leitura — o cronograma manda o aluno para
 * "Tiago 1" e ele precisa de um lugar para onde ir —, mas serve sozinha: é a
 * Bíblia do app, aberta a quem estiver logado.
 *
 * Só versões em domínio público. NVI, ARA, NAA e ACF são licenciadas, e o
 * texto integral delas exigiria contrato com a SBB ou a Biblica. Ver
 * `supabase/migrations/biblia.sql`.
 */
export default async function BibliaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/biblia'))

  const admin = createAdminClient()

  const [livrosRes, versoesRes, amostraRes] = await Promise.all([
    admin.from('biblia_livros').select('id, sigla, nome, testamento, capitulos').order('id'),
    admin.from('biblia_versoes').select('id, nome, abreviacao').order('ordem'),
    // Uma linha basta para saber se o texto já foi importado — `head` com
    // `count` varreria 31 mil linhas por versão sem necessidade.
    admin.from('biblia_versiculos').select('versao_id').limit(1),
  ])

  const livros = (livrosRes.data ?? []) as {
    id: number; sigla: string; nome: string; testamento: 'AT' | 'NT'; capitulos: number
  }[]
  const versoes = (versoesRes.data ?? []) as { id: string; nome: string; abreviacao: string }[]
  const temTexto = (amostraRes.data ?? []).length > 0

  const antigo = livros.filter((l) => l.testamento === 'AT')
  const novo = livros.filter((l) => l.testamento === 'NT')

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Bíblia</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {versoes.map((v) => v.abreviacao).join(' · ')}
          </p>
        </div>
      </div>

      {!temTexto && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold">O texto ainda não foi importado.</p>
            <p className="mt-0.5 leading-relaxed">
              Os livros e a contagem de capítulos já estão aqui, então os desafios
              de leitura funcionam e o cronograma é calculado normalmente. Falta
              carregar os versículos.
            </p>
          </div>
        </div>
      )}

      <Testamento titulo="Antigo Testamento" livros={antigo} />
      <Testamento titulo="Novo Testamento" livros={novo} />
    </div>
  )
}

function Testamento({
  titulo, livros,
}: {
  titulo: string
  livros: { id: number; sigla: string; nome: string; capitulos: number }[]
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {titulo}
      </h2>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
        {livros.map((l) => (
          <Link
            key={l.id}
            href={`/biblia/${l.sigla}/1`}
            className="rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
          >
            <p className="truncate text-sm font-medium leading-tight">{l.nome}</p>
            <p className="text-[11px] text-muted-foreground">
              {l.capitulos} {l.capitulos === 1 ? 'capítulo' : 'capítulos'}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
