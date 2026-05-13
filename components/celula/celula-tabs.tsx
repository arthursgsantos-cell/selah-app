'use client'

import Link from 'next/link'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, ChevronRight, MapPin, Users } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Membro {
  user_id: string
  nome: string
  avatar_url: string | null
  papel: 'lider' | 'membro'
}

interface Encontro {
  id: string
  data_hora: string
  local: string | null
  status: string
}

interface Props {
  encontros: Encontro[]
  membros: Membro[]
}

const papelLabel = { lider: 'Líder', membro: 'Membro' }
const papelColor = {
  lider: 'bg-green-100 text-green-700',
  membro: 'bg-gray-100 text-gray-600',
}

const statusConfig = {
  agendado: { label: 'Agendado', className: 'bg-blue-100 text-blue-700' },
  realizado: { label: 'Realizado', className: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
}

export function CelulaTabs({ encontros, membros }: Props) {
  const agendados = encontros.filter((e) => e.status === 'agendado')
  const historico = encontros.filter((e) => e.status !== 'agendado')

  return (
    <Tabs defaultValue="encontros">
      <TabsList className="w-full">
        <TabsTrigger value="encontros" className="flex-1">
          Encontros
        </TabsTrigger>
        <TabsTrigger value="membros" className="flex-1">
          Membros ({membros.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="encontros" className="mt-4 space-y-2">
        {agendados.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Próximos
            </p>
            {agendados.map((e) => (
              <EncontroCard key={e.id} encontro={e} />
            ))}
          </>
        )}

        {historico.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-4 mb-2">
              Histórico
            </p>
            {historico.map((e) => (
              <EncontroCard key={e.id} encontro={e} />
            ))}
          </>
        )}

        {encontros.length === 0 && (
          <div className="py-10 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum encontro ainda</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="membros" className="mt-4">
        {membros.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum membro ainda</p>
          </div>
        ) : (
          <div className="space-y-1">
            {membros.map((m) => {
              const iniciais = m.nome
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')
                .toUpperCase()
              return (
                <div key={m.user_id} className="flex items-center gap-3 py-2">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={m.avatar_url ?? undefined} alt={m.nome} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {iniciais}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.nome}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${papelColor[m.papel]}`}
                  >
                    {papelLabel[m.papel]}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

function EncontroCard({ encontro }: { encontro: Encontro }) {
  const status = encontro.status as keyof typeof statusConfig
  const statusInfo = statusConfig[status] ?? statusConfig.agendado
  const data = new Date(encontro.data_hora)

  return (
    <Link href={`/encontro/${encontro.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium capitalize">
                  {format(data, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(data, "HH'h'mm", { locale: ptBR })}
                  {encontro.status === 'agendado' && (
                    <>
                      {' · '}
                      {formatDistanceToNow(data, { locale: ptBR, addSuffix: true })}
                    </>
                  )}
                  {encontro.local && (
                    <>
                      {' · '}
                      <MapPin className="h-3 w-3 inline" /> {encontro.local}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
