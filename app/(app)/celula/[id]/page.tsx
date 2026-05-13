import { redirect, notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CelulaTabs } from '@/components/celula/celula-tabs'
import { CriarEncontroDialog } from '@/components/celula/criar-encontro-dialog'

type MembroComProfile = {
  user_id: string
  papel: 'lider' | 'membro'
  profiles: { nome: string; avatar_url: string | null } | null
}

type EncontroRow = {
  id: string
  data_hora: string
  local: string | null
  status: string
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

  // Check access: supervisor or pastor only
  const canView = profile.role === 'supervisor' || profile.role === 'pastor' || profile.role === 'admin'
  if (!canView) redirect('/celula')

  const [
    { data: celula },
    { data: membrosData },
    { data: encontrosData },
  ] = await Promise.all([
    supabase
      .from('celulas')
      .select('id, nome, descricao, capa_url, logo_url, frequencia, local_padrao, rede_id')
      .eq('id', params.id)
      .single(),
    supabase
      .from('celula_membros')
      .select('user_id, papel, profiles(nome, avatar_url)')
      .eq('celula_id', params.id),
    supabase
      .from('encontros')
      .select('id, data_hora, local, status')
      .eq('celula_id', params.id)
      .order('data_hora', { ascending: false })
      .limit(20),
  ])

  if (!celula) notFound()

  const membros = ((membrosData ?? []) as unknown as MembroComProfile[]).map((m) => ({
    user_id: m.user_id,
    nome: m.profiles?.nome ?? 'Membro',
    avatar_url: m.profiles?.avatar_url ?? null,
    papel: m.papel,
  }))

  const lider = membros.find((m) => m.papel === 'lider')

  const encontros = ((encontrosData ?? []) as EncontroRow[]).map((e) => ({
    id: e.id,
    data_hora: e.data_hora,
    local: e.local,
    status: e.status,
  }))

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

      {celula.capa_url && (
        <div className="h-32 rounded-xl overflow-hidden relative">
          <Image src={celula.capa_url} alt="Capa da célula" fill className="object-cover" />
        </div>
      )}

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0 overflow-hidden relative">
              {celula.logo_url ? (
                <Image
                  src={celula.logo_url}
                  alt={celula.nome}
                  fill
                  className="object-cover"
                />
              ) : (
                iniciais
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold leading-tight">{celula.nome}</h1>
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

          {lider && (
            <div className="mt-4 pt-4 border-t flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={lider.avatar_url ?? undefined} alt={lider.nome} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {lider.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Líder</p>
                <p className="text-sm font-medium">{lider.nome}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <CriarEncontroDialog celulaId={params.id} localPadrao={celula.local_padrao} />
      </div>

      <CelulaTabs encontros={encontros} membros={membros} />
    </div>
  )
}
