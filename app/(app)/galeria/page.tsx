import Link from 'next/link'
import { ArrowLeft, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GaleriaComunidade, type FotoComunidade } from '@/components/shared/galeria-comunidade'

export const metadata = {
  title: 'Galeria da comunidade',
  description: 'Fotos das células, agrupadas por rede.',
}

/**
 * Galeria completa da igreja.
 *
 * A home e o painel do pastor mostram só as fotos mais recentes — o acervo
 * inteiro numa lista corrida não diz de quem é cada foto. Aqui elas vêm
 * agrupadas por rede e por célula, que é como a igreja pensa a comunidade.
 *
 * Página aberta a visitante: as fotos já são públicas na home, e o convite
 * para conhecer a igreja não deveria esbarrar num login.
 */
export default async function GaleriaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // Sem login não há perfil para dizer a igreja; a única igreja cadastrada é o
  // que a home de visitante já usa.
  const { data: profile } = user
    ? await supabase.from('profiles').select('igreja_id').eq('id', user.id).single()
    : { data: null }

  let igrejaId = (profile as { igreja_id: string } | null)?.igreja_id ?? null
  if (!igrejaId) {
    const { data: igreja } = await admin.from('igrejas').select('id').limit(1).maybeSingle()
    igrejaId = (igreja as { id: string } | null)?.id ?? null
  }

  const { data: fotosData } = igrejaId
    ? await admin
        .from('fotos_comunidade')
        .select('id, url, criado_em, celulas(nome, redes(nome, cor))')
        .eq('igreja_id', igrejaId)
        .order('criado_em', { ascending: false })
        .limit(500)
    : { data: [] }

  const fotos: FotoComunidade[] = ((fotosData ?? []) as unknown as {
    id: string; url: string; criado_em: string
    celulas: { nome: string; redes: { nome: string; cor: string | null } | null } | null
  }[]).map((f) => ({
    id: f.id,
    url: f.url,
    criado_em: f.criado_em,
    celula: f.celulas?.nome ?? null,
    rede: f.celulas?.redes?.nome ?? null,
    cor: f.celulas?.redes?.cor ?? null,
  }))

  const celulas = new Set(fotos.map((f) => f.celula).filter(Boolean)).size
  const redes = new Set(fotos.map((f) => f.rede).filter(Boolean)).size

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Images className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Nossa comunidade</h1>
          <p className="text-sm text-muted-foreground">
            {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
            {redes > 0 && ` · ${redes} ${redes === 1 ? 'rede' : 'redes'}`}
            {celulas > 0 && ` · ${celulas} ${celulas === 1 ? 'célula' : 'células'}`}
          </p>
        </div>
      </div>

      <GaleriaComunidade fotos={fotos} />
    </div>
  )
}
