import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loginCom } from '@/lib/destino-login'

interface Params {
  livro: string
  capitulo: string
}

async function carregarLivro(sigla: string) {
  const { data } = await createAdminClient()
    .from('biblia_livros')
    .select('id, sigla, nome, testamento, capitulos')
    .eq('sigla', decodeURIComponent(sigla).toLowerCase())
    .maybeSingle()

  return data as {
    id: number; sigla: string; nome: string; testamento: 'AT' | 'NT'; capitulos: number
  } | null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const livro = await carregarLivro(params.livro)
  if (!livro) return { title: 'Passagem não encontrada' }
  return { title: `${livro.nome} ${params.capitulo} · Bíblia · IBZS` }
}

/**
 * O capítulo.
 *
 * A versão vem da query (`?v=acf`) e não do caminho: trocar de tradução é
 * mudar a lente sobre a mesma passagem, e o endereço que se compartilha deve
 * ser o da passagem. Quem abrir sem `?v` cai na primeira da ordem.
 */
export default async function CapituloPage({
  params, searchParams,
}: {
  params: Params
  searchParams: { v?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom(`/biblia/${params.livro}/${params.capitulo}`))

  const livro = await carregarLivro(params.livro)
  if (!livro) notFound()

  const capitulo = Number(params.capitulo)
  if (!Number.isInteger(capitulo) || capitulo < 1 || capitulo > livro.capitulos) notFound()

  const admin = createAdminClient()

  const { data: versoesData } = await admin
    .from('biblia_versoes')
    .select('id, nome, abreviacao')
    .order('ordem')

  const versoes = (versoesData ?? []) as { id: string; nome: string; abreviacao: string }[]
  const versaoId = versoes.find((v) => v.id === searchParams.v)?.id ?? versoes[0]?.id

  const { data: versiculosData } = versaoId
    ? await admin
        .from('biblia_versiculos')
        .select('versiculo, texto')
        .eq('versao_id', versaoId)
        .eq('livro_id', livro.id)
        .eq('capitulo', capitulo)
        .order('versiculo')
    : { data: null }

  const versiculos = (versiculosData ?? []) as { versiculo: number; texto: string }[]

  const anterior = capitulo > 1 ? capitulo - 1 : null
  const proximo = capitulo < livro.capitulos ? capitulo + 1 : null
  const sufixo = versaoId && versaoId !== versoes[0]?.id ? `?v=${versaoId}` : ''

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <Link
        href="/biblia"
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Bíblia
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold leading-tight">
          {livro.nome} {capitulo}
        </h1>

        {versoes.length > 1 && (
          <div className="flex gap-1">
            {versoes.map((v) => (
              <Link
                key={v.id}
                href={`/biblia/${livro.sigla}/${capitulo}${v.id === versoes[0].id ? '' : `?v=${v.id}`}`}
                title={v.nome}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  v.id === versaoId
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {v.abreviacao}
              </Link>
            ))}
          </div>
        )}
      </div>

      {versiculos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            O texto desta versão ainda não foi importado.
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground/70">
            Os cronogramas de leitura continuam funcionando — eles dependem só da
            contagem de capítulos.
          </p>
        </div>
      ) : (
        /* Um parágrafo por versículo, com o número sobrescrito: é como se lê
           num capítulo longo, e mantém o alvo de toque grande no celular. */
        <div className="space-y-2 leading-relaxed">
          {versiculos.map((v) => (
            <p key={v.versiculo} className="text-[15px]">
              <span className="mr-1 align-super text-[11px] font-bold text-primary">
                {v.versiculo}
              </span>
              {v.texto}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        {anterior ? (
          <Link
            href={`/biblia/${livro.sigla}/${anterior}${sufixo}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
            {livro.nome} {anterior}
          </Link>
        ) : (
          <span />
        )}
        {proximo && (
          <Link
            href={`/biblia/${livro.sigla}/${proximo}${sufixo}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {livro.nome} {proximo}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
