import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import { CriarEventoDialog } from '@/components/shared/criar-evento-dialog'
import { EditarEventoDialog } from '@/components/shared/editar-evento-dialog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Suspense } from 'react'
import { PageSearch } from '@/components/shared/page-search'

const tipoConfig: Record<string, { label: string; className: string }> = {
  culto: { label: 'Culto', className: 'bg-purple-100 text-purple-700' },
  igreja: { label: 'Igreja', className: 'bg-blue-100 text-blue-700' },
  rede: { label: 'Rede', className: 'bg-green-100 text-green-700' },
  celula: { label: 'Célula', className: 'bg-yellow-100 text-yellow-700' },
  outro: { label: 'Outro', className: 'bg-gray-100 text-gray-600' },
}

const TIPO_OPTS = [
  { value: '',        label: 'Todos os tipos' },
  { value: 'culto',   label: 'Culto'  },
  { value: 'igreja',  label: 'Igreja' },
  { value: 'rede',    label: 'Rede'   },
  { value: 'celula',  label: 'Célula' },
  { value: 'outro',   label: 'Outro'  },
]

const SORT_OPTS = [
  { value: 'asc',  label: 'Mais próximos' },
  { value: 'desc', label: 'Mais recentes' },
  { value: 'az',   label: 'A → Z'         },
]

export default async function EventosPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; tipo?: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const canCreate = profile.role === 'pastor' || profile.role === 'supervisor' || profile.role === 'admin'

  const q = (searchParams.q ?? '').toLowerCase().trim()
  const tipoFiltro = searchParams.tipo ?? ''
  const sort = searchParams.sort ?? 'asc'

  let proximosQuery = supabase
    .from('eventos')
    .select('id, titulo, descricao, data_hora, local, tipo, rede_id, imagem_url, recorrencia_id, recorrencia_tipo')
    .eq('igreja_id', profile.igreja_id)
    .gte('data_hora', new Date().toISOString())
    .limit(50)

  if (tipoFiltro) proximosQuery = proximosQuery.eq('tipo', tipoFiltro)

  const { data: proximosRaw } = await proximosQuery

  let proximos = (proximosRaw ?? []).filter((e) =>
    !q || e.titulo.toLowerCase().includes(q) || e.local?.toLowerCase().includes(q) || e.descricao?.toLowerCase().includes(q)
  )

  if (sort === 'az') proximos.sort((a, b) => a.titulo.localeCompare(b.titulo))
  else if (sort === 'desc') proximos.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
  else proximos.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

  const { data: passados } = await supabase
    .from('eventos')
    .select('id, titulo, data_hora, local, tipo, imagem_url, recorrencia_id, recorrencia_tipo')
    .eq('igreja_id', profile.igreja_id)
    .lt('data_hora', new Date().toISOString())
    .order('data_hora', { ascending: false })
    .limit(10)

  const passadosFiltrados = (passados ?? []).filter((e) =>
    (!q || e.titulo.toLowerCase().includes(q) || e.local?.toLowerCase().includes(q)) &&
    (!tipoFiltro || e.tipo === tipoFiltro)
  )

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Eventos</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Suspense>
            <PageSearch placeholder="Buscar evento..." sortOptions={SORT_OPTS} defaultSort="asc" />
          </Suspense>
          {canCreate && <CriarEventoDialog label="Criar evento" />}
        </div>
      </div>

      {/* Filtro por tipo */}
      <div className="flex gap-1.5 flex-wrap">
        {TIPO_OPTS.map((opt) => (
          <Link
            key={opt.value}
            href={`/eventos?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), ...(opt.value ? { tipo: opt.value } : {}), ...(searchParams.sort ? { sort: searchParams.sort } : {}) }).toString()}`}
            className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
              tipoFiltro === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Próximos eventos */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Próximos
        </p>

        {proximos && proximos.length > 0 ? (
          <div className="space-y-3">
            {proximos.map((evento) => {
              const tipo = tipoConfig[evento.tipo] ?? tipoConfig.outro
              const data = new Date(evento.data_hora)

              return (
                <Card key={evento.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      {evento.imagem_url ? (
                        <img
                          src={evento.imagem_url}
                          alt={evento.titulo}
                          className="h-14 w-14 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                          <CalendarDays className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm leading-snug">{evento.titulo}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipo.className}`}>
                              {tipo.label}
                            </span>
                            {canCreate && (
                              <EditarEventoDialog
                                evento={{
                                  id: evento.id,
                                  titulo: evento.titulo,
                                  descricao: evento.descricao ?? null,
                                  data_hora: evento.data_hora,
                                  local: evento.local ?? null,
                                  tipo: evento.tipo,
                                  imagem_url: evento.imagem_url ?? null,
                                  recorrencia_id: evento.recorrencia_id ?? null,
                                  recorrencia_tipo: evento.recorrencia_tipo ?? null,
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {format(data, "EEEE, d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })}
                        </p>
                        {evento.local && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {evento.local}
                          </p>
                        )}
                        {evento.descricao && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                            {evento.descricao}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum evento próximo</p>
              {canCreate && (
                <div className="mt-3">
                  <CriarEventoDialog label="Criar evento" />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Eventos passados */}
      {passadosFiltrados.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Anteriores
          </p>
          <div className="space-y-2">
            {passadosFiltrados.map((evento) => {
              const tipo = tipoConfig[evento.tipo] ?? tipoConfig.outro
              return (
                <Card key={evento.id} className="opacity-60">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {evento.imagem_url && (
                          <img
                            src={evento.imagem_url}
                            alt={evento.titulo}
                            className="h-10 w-10 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{evento.titulo}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {format(new Date(evento.data_hora), "d 'de' MMMM", { locale: ptBR })}
                            {evento.local && ` · ${evento.local}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipo.className}`}>
                          {tipo.label}
                        </span>
                        {canCreate && (
                          <EditarEventoDialog
                            evento={{
                              id: evento.id,
                              titulo: evento.titulo,
                              descricao: null,
                              data_hora: evento.data_hora,
                              local: evento.local ?? null,
                              tipo: evento.tipo,
                              imagem_url: evento.imagem_url ?? null,
                              recorrencia_id: evento.recorrencia_id ?? null,
                              recorrencia_tipo: evento.recorrencia_tipo ?? null,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
