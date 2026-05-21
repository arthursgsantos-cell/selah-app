import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CelulaTabs } from '@/components/celula/celula-tabs'
import { CelulaLogoUpload } from '@/components/celula/celula-logo-upload'
import { EditarCelulaDialog } from '@/components/supervisor/editar-celula-dialog'

type MembroComProfile = {
  user_id: string
  papel: 'lider' | 'membro'
  profiles: { nome: string; avatar_url: string | null; conjuge_id: string | null; data_nascimento_1: string | null; data_nascimento_2: string | null; data_casamento: string | null; endereco: string | null; endereco_maps: string | null } | null
}

type EncontroRow = {
  id: string
  data_hora: string
  local: string | null
  local_maps_url: string | null
  status: string
  card_imagem_url: string | null
}

export default async function CelulaDetalhesPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const canView = ['supervisor', 'supervisor_treinamento', 'pastor', 'admin'].includes(profile.role)
  if (!canView) redirect('/celula')

  const admin = createAdminClient()

  const [
    { data: celula },
    { data: membrosData },
    { data: encontrosData },
    { data: fotosData },
  ] = await Promise.all([
    admin
      .from('celulas')
      .select('id, nome, descricao, logo_url, frequencia, local_padrao, rede_id')
      .eq('id', params.id)
      .single(),
    admin
      .from('celula_membros')
      .select('user_id, papel, profiles(nome, avatar_url, conjuge_id, data_nascimento_1, data_nascimento_2, data_casamento, endereco, endereco_maps)')
      .eq('celula_id', params.id),
    admin
      .from('encontros')
      .select('id, data_hora, local, local_maps_url, status, card_imagem_url')
      .eq('celula_id', params.id)
      .order('data_hora', { ascending: false })
      .limit(20),
    admin
      .from('fotos_comunidade')
      .select('id, url')
      .eq('celula_id', params.id)
      .order('criado_em', { ascending: false }),
  ])

  if (!celula) notFound()

  const membros = ((membrosData ?? []) as unknown as MembroComProfile[]).map((m) => ({
    user_id: m.user_id,
    nome: m.profiles?.nome ?? 'Membro',
    avatar_url: m.profiles?.avatar_url ?? null,
    conjuge_id: m.profiles?.conjuge_id ?? null,
    data_nascimento_1: m.profiles?.data_nascimento_1 ?? null,
    data_nascimento_2: m.profiles?.data_nascimento_2 ?? null,
    data_casamento: m.profiles?.data_casamento ?? null,
    endereco: m.profiles?.endereco ?? null,
    endereco_maps: m.profiles?.endereco_maps ?? null,
    papel: m.papel,
  }))

  const lideres = membros.filter((m) => m.papel === 'lider')

  const encontros = ((encontrosData ?? []) as EncontroRow[]).map((e) => ({
    id: e.id,
    data_hora: e.data_hora,
    local: e.local,
    local_maps_url: e.local_maps_url,
    status: e.status,
    card_imagem_url: e.card_imagem_url,
  }))

  const membroIds = membros.map((m) => m.user_id)
  const { data: dependentesData } = membroIds.length
    ? await admin
        .from('dependentes')
        .select('profile_id, nome, data_nascimento, tipo')
        .in('profile_id', membroIds)
    : { data: [] }

  const iniciais = celula.nome
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()

  const frequenciaLabel = celula.frequencia === 'semanal' ? 'Semanal' : 'Quinzenal'

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" render={<Link href="/supervisor" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a rede
      </Button>

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <CelulaLogoUpload celulaId={params.id} logoUrl={celula.logo_url} iniciais={iniciais} cor={null} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-bold leading-tight">{celula.nome}</h1>
                <EditarCelulaDialog
                  celulaId={params.id}
                  nome={celula.nome}
                  descricao={celula.descricao}
                  localPadrao={celula.local_padrao}
                  frequencia={celula.frequencia}
                  cor={null}
                  canDelete={true}
                />
              </div>
              {celula.descricao && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{celula.descricao}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="secondary" className="text-xs">{frequenciaLabel}</Badge>
                {celula.local_padrao && (
                  <Badge variant="outline" className="text-xs">{celula.local_padrao}</Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {membros.length} {membros.length === 1 ? 'membro' : 'membros'}
                </Badge>
              </div>
            </div>
          </div>

          {lideres.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">{lideres.length === 1 ? 'Líder' : 'Líderes'}</p>
              <div className="flex flex-wrap gap-2">
                {lideres.map((lider) => (
                  <div key={lider.user_id} className="flex items-center gap-1.5 bg-muted rounded-full pl-0.5 pr-3 py-0.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={lider.avatar_url ?? undefined} alt={lider.nome} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {lider.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{lider.nome.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CelulaTabs
        encontros={encontros}
        membros={membros}
        celulaId={params.id}
        localPadrao={celula.local_padrao}
        dependentes={dependentesData ?? []}
        celulaColor={null}
        fotosInit={(fotosData ?? []) as { id: string; url: string }[]}
        canUpload={true}
      />
    </div>
  )
}
