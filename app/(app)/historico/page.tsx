import { redirect } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import Link from 'next/link'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { carregarPerfil } from '@/lib/auth/perfil'
import { ArrowLeft, Users, Sparkles, CalendarDays, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Suspense } from 'react'
import { PageSearch } from '@/components/shared/page-search'

const SORT_OPTIONS = [
  { value: 'recente', label: 'Mais recentes' },
  { value: 'antigo',  label: 'Mais antigos'  },
]

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string }
}) {
  const user = await getAuthUser()
  if (!user) redirect(loginCom('/historico'))

  const supabase = await createClient()

  const profile = await carregarPerfil(() =>
    supabase.from('profiles').select('id, igreja_id').eq('id', user.id).maybeSingle()
  )
  if (!profile) redirect('/onboarding')

  const { data: membroCelula } = await supabase
    .from('celula_membros')
    .select('celula_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const celulaId = membroCelula?.celula_id ?? null

  const [{ data: encontrosData }, { data: eventosData }] = await Promise.all([
    celulaId
      ? supabase
          .from('encontros')
          .select('id, data_hora, local, card_imagem_url, avisos')
          .eq('celula_id', celulaId)
          .eq('status', 'realizado')
          .lt('data_hora', new Date().toISOString())
          .order('data_hora', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    supabase
      .from('eventos')
      .select('id, titulo, descricao, data_hora, local, tipo, imagem_url')
      .eq('igreja_id', profile.igreja_id)
      .lt('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: false })
      .limit(100),
  ])

  type HistItem = {
    id: string; titulo: string; data_hora: string
    tipo: 'celula' | 'evento'; tipoEvento?: string
    local: string | null; descricao: string | null; img: string | null
  }

  const q = (searchParams.q ?? '').toLowerCase().trim()
  const asc = searchParams.sort === 'antigo'

  let historico: HistItem[] = [
    ...(encontrosData ?? []).map((e) => ({
      id: e.id,
      titulo: format(new Date(e.data_hora), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }),
      data_hora: e.data_hora,
      tipo: 'celula' as const,
      local: e.local,
      descricao: e.avisos ?? null,
      img: e.card_imagem_url ?? null,
    })),
    ...(eventosData ?? []).map((e) => ({
      id: e.id,
      titulo: e.titulo,
      data_hora: e.data_hora,
      tipo: 'evento' as const,
      tipoEvento: e.tipo,
      local: e.local,
      descricao: e.descricao ?? null,
      img: e.imagem_url ?? null,
    })),
  ]

  if (q) {
    historico = historico.filter(
      (item) =>
        item.titulo.toLowerCase().includes(q) ||
        item.local?.toLowerCase().includes(q) ||
        item.descricao?.toLowerCase().includes(q)
    )
  }

  historico.sort((a, b) => {
    const diff = new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
    return asc ? diff : -diff
  })

  // Agrupar por ano-mês para mostrar separadores
  type Grupo = { chave: string; label: string; itens: HistItem[] }
  const grupos: Grupo[] = []
  for (const item of historico) {
    const chave = format(new Date(item.data_hora), 'yyyy-MM')
    const label = format(new Date(item.data_hora), "MMMM 'de' yyyy", { locale: ptBR })
    const ultimo = grupos[grupos.length - 1]
    if (!ultimo || ultimo.chave !== chave) {
      grupos.push({ chave, label, itens: [item] })
    } else {
      ultimo.itens.push(item)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Histórico</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Encontros da célula e eventos da igreja
          </p>
        </div>
        <Suspense>
          <PageSearch placeholder="Buscar..." sortOptions={SORT_OPTIONS} defaultSort="recente" />
        </Suspense>
      </div>

      {historico.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {q ? `Nenhum resultado para "${q}"` : 'Nenhum histórico ainda'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo.chave}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 capitalize">
                {grupo.label}
              </p>
              <div className="space-y-2">
                {grupo.itens.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-accent/20 transition-colors"
                  >
                    {item.img ? (
                      <img
                        src={item.img}
                        alt={item.titulo}
                        className="h-14 w-14 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        {item.tipo === 'celula'
                          ? <Users className="h-5 w-5 text-muted-foreground/60" />
                          : <Sparkles className="h-5 w-5 text-muted-foreground/60" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-semibold capitalize flex-1 leading-snug">{item.titulo}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                          item.tipo === 'celula'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-purple-50 text-purple-600'
                        }`}>
                          {item.tipo === 'celula' ? 'Célula' : (item.tipoEvento ?? 'Evento')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {format(new Date(item.data_hora), "EEEE, d 'de' MMMM", { locale: ptBR })}
                        {' · '}
                        {format(new Date(item.data_hora), "HH'h'mm", { locale: ptBR })}
                      </p>
                      {item.local && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {item.local}
                        </p>
                      )}
                      {item.descricao && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                          {item.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
