import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, HeartHandshake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginCom } from '@/lib/destino-login'
import { acessoConsolidacao, carregarFichas } from '@/lib/consolidacao-servidor'
import { FunilConsolidacao } from '@/components/consolidacao/funil-consolidacao'
import { AcolherDialog } from '@/components/consolidacao/acolher-dialog'

export const metadata = { title: 'Consolidação · IBZS' }

/**
 * Consolidação — quem chegou e quem está cuidando.
 *
 * A página é da liderança, mas não só da direção: o líder abre e vê as pessoas
 * da célula dele e as que ele ficou de acompanhar. É quem faz o contato, então
 * é quem precisa da lista.
 */
export default async function ConsolidacaoPage() {
  const acesso = await acessoConsolidacao()
  if (!acesso) redirect(loginCom('/consolidacao'))

  // Membro sem célula nem ficha atribuída não tem o que ver aqui.
  if (!acesso.podeAcolher && acesso.celulaIds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="py-16 text-center">
            <HeartHandshake className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-base font-semibold">Acesso restrito</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta área é da liderança que acompanha quem chega.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const admin = createAdminClient()

  const [fichas, { data: celulasData }, { data: responsaveisData }] = await Promise.all([
    carregarFichas(acesso),
    // A direção escolhe entre todas as células; líder e supervisor, entre as
    // suas — atribuir alguém a uma célula que não é sua não faria sentido.
    acesso.direcao
      ? admin
          .from('celulas')
          .select('id, nome, redes!inner(igreja_id)')
          .eq('redes.igreja_id', acesso.igrejaId)
          .neq('ativa', false)
          .order('nome')
      : acesso.celulaIds.length > 0
        ? admin.from('celulas').select('id, nome').in('id', acesso.celulaIds).order('nome')
        : Promise.resolve({ data: [] }),
    admin
      .from('profiles')
      .select('id, nome')
      .eq('igreja_id', acesso.igrejaId)
      .in('role', ['lider', 'lider_treinamento', 'supervisor', 'supervisor_treinamento', 'pastor', 'admin'])
      .order('nome'),
  ])

  const celulas = (celulasData ?? []) as { id: string; nome: string }[]
  const responsaveis = (responsaveisData ?? []) as { id: string; nome: string }[]

  const esfriando = fichas.filter((f) => f.esfriando).length
  const emAndamento = fichas.filter(
    (f) => f.etapa !== 'integrado' && f.etapa !== 'afastado'
  ).length
  const integrados = fichas.filter((f) => f.etapa === 'integrado').length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Consolidação</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Quem chegou, e quem está cuidando
          </p>
        </div>
        {acesso.podeAcolher && (
          <AcolherDialog celulas={celulas} responsaveis={responsaveis} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pb-4 pt-4 text-center">
            <p className={`text-2xl font-bold ${esfriando > 0 ? 'text-red-600' : 'text-primary'}`}>
              {esfriando}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Esfriando</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-4 pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{emAndamento}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Em acompanhamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-4 pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{integrados}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Integrados</p>
          </CardContent>
        </Card>
      </div>

      <FunilConsolidacao
        fichas={fichas}
        celulas={celulas}
        responsaveis={responsaveis}
        podeExcluir={acesso.direcao}
      />
    </div>
  )
}
