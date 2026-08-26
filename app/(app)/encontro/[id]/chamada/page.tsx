import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { loginCom } from '@/lib/destino-login'
import { carregarChamada } from '@/app/actions/chamada'
import { ChamadaEncontro } from '@/components/encontro/chamada-encontro'

export const metadata = { title: 'Chamada da célula · Selah' }

/**
 * A chamada é página, não modal.
 *
 * Mesma razão da chamada do Ensino: um diálogo que fecha ao clicar fora perde
 * a lista pela metade. Com URL própria dá para recarregar, voltar e deixar
 * aberta no celular durante o encontro inteiro.
 */
export default async function ChamadaEncontroPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom(`/encontro/${params.id}/chamada`))

  const chamada = await carregarChamada(params.id)

  // `null` cobre os dois casos: encontro que não existe e gente que não faz a
  // chamada dele. Quem não pode marcar volta para o encontro, onde vê a
  // própria presença.
  if (!chamada) {
    const { data: encontro } = await supabase
      .from('encontros')
      .select('id')
      .eq('id', params.id)
      .maybeSingle()
    if (!encontro) notFound()
    redirect(`/encontro/${params.id}`)
  }

  const dataFormatada = format(new Date(chamada.dataHora), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      <Link
        href={`/encontro/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para o encontro
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Chamada</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{chamada.celulaNome}</p>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{dataFormatada}</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/70">
        Cada toque é salvo na hora. Marcar alguém já dá o encontro como realizado.
      </p>

      <ChamadaEncontro
        encontroId={params.id}
        linhasIniciais={chamada.linhas}
        visitantesIniciais={chamada.visitantes}
      />
    </div>
  )
}
