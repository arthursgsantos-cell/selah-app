import { createAdminClient } from '@/lib/supabase/admin'
import { CalendarDays, MapPin, LogIn } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

const tipoConfig: Record<string, { label: string; className: string }> = {
  culto: { label: 'Culto', className: 'bg-purple-100 text-purple-700' },
  igreja: { label: 'Igreja', className: 'bg-blue-100 text-blue-700' },
  rede: { label: 'Rede', className: 'bg-green-100 text-green-700' },
  celula: { label: 'Célula', className: 'bg-yellow-100 text-yellow-700' },
  outro: { label: 'Outro', className: 'bg-gray-100 text-gray-600' },
}

export default async function LandingPage() {
  const supabase = createAdminClient()

  const { data: eventos } = await supabase
    .from('eventos')
    .select('id, titulo, descricao, data_hora, local, tipo, imagem_url')
    .gte('data_hora', new Date().toISOString())
    .in('tipo', ['culto', 'igreja', 'rede'])
    .order('data_hora', { ascending: true })
    .limit(10)

  const destaque = eventos?.[0]
  const demais = eventos?.slice(1) ?? []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">S</span>
            </div>
            <span className="font-semibold text-sm">Selah</span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Hero text */}
        <div className="text-center space-y-1.5 pt-2">
          <h1 className="text-2xl font-bold tracking-tight">Próximos Eventos</h1>
          <p className="text-sm text-muted-foreground">
            Fique por dentro da agenda da sua igreja
          </p>
        </div>

        {eventos && eventos.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nenhum evento próximo</p>
          </div>
        )}

        {/* Evento destaque */}
        {destaque && (
          <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
            {destaque.imagem_url ? (
              <img
                src={destaque.imagem_url}
                alt={destaque.titulo}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-12 w-12 text-primary/30" />
              </div>
            )}
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold leading-snug">{destaque.titulo}</h2>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${tipoConfig[destaque.tipo]?.className ?? tipoConfig.outro.className}`}
                >
                  {tipoConfig[destaque.tipo]?.label ?? 'Outro'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-medium capitalize">
                {format(new Date(destaque.data_hora), "EEEE, d 'de' MMMM 'às' HH'h'mm", {
                  locale: ptBR,
                })}
              </p>
              {destaque.local && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {destaque.local}
                </p>
              )}
              {destaque.descricao && (
                <p className="text-sm text-muted-foreground line-clamp-3">{destaque.descricao}</p>
              )}
            </div>
          </div>
        )}

        {/* Demais eventos */}
        {demais.length > 0 && (
          <section className="space-y-3">
            {demais.map((evento) => {
              const tipo = tipoConfig[evento.tipo] ?? tipoConfig.outro
              const data = new Date(evento.data_hora)

              return (
                <div
                  key={evento.id}
                  className="flex gap-3 p-4 rounded-xl border border-border hover:bg-accent/30 transition-colors"
                >
                  {evento.imagem_url ? (
                    <img
                      src={evento.imagem_url}
                      alt={evento.titulo}
                      className="h-14 w-14 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-6 w-6 text-primary/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-snug">{evento.titulo}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${tipo.className}`}>
                        {tipo.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {format(data, "EEE, d 'de' MMM 'às' HH'h'mm", { locale: ptBR })}
                    </p>
                    {evento.local && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {evento.local}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* CTA */}
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-6 text-center space-y-3">
          <p className="text-sm font-medium">Faça parte da nossa comunidade</p>
          <p className="text-xs text-muted-foreground">
            Acompanhe sua célula, encontros e muito mais
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-xl hover:bg-primary/90 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Acessar minha conta
          </Link>
        </div>
      </main>
    </div>
  )
}
