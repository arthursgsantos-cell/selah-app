import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CalendarDays, MapPin, Users, ChevronRight } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Role } from '@/lib/supabase/types'

const roleLabels: Record<Role, string> = {
  pastor: 'Pastor',
  supervisor: 'Supervisor',
  lider: 'Líder',
  membro: 'Membro',
}

const roleColors: Record<Role, string> = {
  pastor: 'bg-purple-100 text-purple-700',
  supervisor: 'bg-blue-100 text-blue-700',
  lider: 'bg-green-100 text-green-700',
  membro: 'bg-gray-100 text-gray-600',
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, role, avatar_url, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  // Busca a célula do usuário
  const { data: membroCelula } = await supabase
    .from('celula_membros')
    .select('celula_id, papel, celulas(id, nome)')
    .eq('user_id', user.id)
    .maybeSingle()

  const celulaId = membroCelula?.celula_id ?? null

  // Busca o próximo encontro agendado
  const { data: proximoEncontro } = celulaId
    ? await supabase
        .from('encontros')
        .select('id, data_hora, local, avisos')
        .eq('celula_id', celulaId)
        .eq('status', 'agendado')
        .gte('data_hora', new Date().toISOString())
        .order('data_hora', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null }

  // Busca as funções do usuário no próximo encontro (escala)
  const { data: minhasEscalas } = proximoEncontro
    ? await supabase
        .from('escalas')
        .select('funcao')
        .eq('encontro_id', proximoEncontro.id)
        .eq('responsavel_id', user.id)
    : { data: null }

  // Busca eventos da igreja
  const { data: eventos } = await supabase
    .from('eventos')
    .select('id, titulo, data_hora, local, tipo')
    .eq('igreja_id', profile.igreja_id)
    .gte('data_hora', new Date().toISOString())
    .order('data_hora', { ascending: true })
    .limit(4)

  const primeiroNome = profile.nome.split(' ')[0]
  const iniciais = profile.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

  const funcaoLabels: Record<string, string> = {
    louvor: '🎵 Louvor',
    quebra_gelo: '🎲 Quebra-gelo',
    edificacao: '📖 Edificação',
    compartilhar: '🤝 Compartilhar',
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Card de boas-vindas */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 ring-2 ring-primary/20">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.nome} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {iniciais}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">Bem-vindo de volta,</p>
              <h1 className="text-xl font-bold leading-tight">{primeiroNome}</h1>
              <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[profile.role]}`}>
                {roleLabels[profile.role]}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Próximo encontro */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Próximo encontro
        </h2>

        {proximoEncontro ? (
          <Link href={`/encontro/${proximoEncontro.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                      <CalendarDays className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold capitalize">
                        {format(new Date(proximoEncontro.data_hora), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(proximoEncontro.data_hora), "HH'h'mm", { locale: ptBR })}
                        {' · '}
                        {formatDistanceToNow(new Date(proximoEncontro.data_hora), { locale: ptBR, addSuffix: true })}
                      </p>
                      {proximoEncontro.local && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {proximoEncontro.local}
                        </p>
                      )}
                      {minhasEscalas && minhasEscalas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {minhasEscalas.map((e) => (
                            <Badge key={e.funcao} variant="secondary" className="text-xs">
                              {funcaoLabels[e.funcao]}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : celulaId ? (
          <Card>
            <CardContent className="py-10 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum encontro agendado</p>
              <Button size="sm" className="mt-4" render={<Link href="/celula" />}>
                Agendar encontro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-10 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Você ainda não está em uma célula</p>
              <p className="text-xs text-muted-foreground mt-1">Seu líder vai te adicionar em breve</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Eventos da igreja */}
      {eventos && eventos.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Eventos da igreja
          </h2>
          <div className="space-y-2">
            {eventos.map((evento) => (
              <Card key={evento.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{evento.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(evento.data_hora), "EEEE, d MMM 'às' HH'h'", { locale: ptBR })}
                        {evento.local && ` · ${evento.local}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">
                      {evento.tipo}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
