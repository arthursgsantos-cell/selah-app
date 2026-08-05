export interface PastorItem {
  id: string
  nome: string
  avatar_url: string | null
  titulo: string | null
}

/**
 * Cartão da liderança na página inicial.
 *
 * Saiu de dentro de `home/page.tsx` quando o bloco precisou subir para logo
 * abaixo da saudação: mover sessenta linhas de JSX inline num arquivo de mil
 * linhas é onde se perde um `)` sem perceber.
 *
 * Sem perfis com `role = 'pastor'`, cai no nome avulso cadastrado em
 * `igrejas.pastor_nome` — é o estado de uma igreja recém-cadastrada.
 */
export function PastoresCard({
  pastores,
  igrejaNome,
  fallback,
}: {
  pastores: PastorItem[]
  igrejaNome: string
  fallback?: { nome: string; titulo: string | null; fotoUrl: string | null } | null
}) {
  const iniciaisDe = (nome: string) =>
    nome.split(' ').slice(0, 2).map((n) => n[0]).join('')

  if (pastores.length === 0 && fallback?.nome) {
    return (
      <Moldura>
        <div className="p-4 flex items-center gap-4">
          {fallback.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fallback.fotoUrl}
              alt={fallback.nome}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-100 shadow-md shrink-0"
            />
          ) : (
            <Inicial texto={iniciaisDe(fallback.nome)} grande />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-widest">
              {fallback.titulo ?? 'Pastor'}
            </p>
            <p className="font-bold text-lg text-gray-900 leading-tight mt-0.5">{fallback.nome}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{igrejaNome}</p>
          </div>
        </div>
      </Moldura>
    )
  }

  if (pastores.length === 0) return null

  return (
    <Moldura>
      <div className="divide-y divide-blue-50">
        {pastores.map((pastor) => (
          <div key={pastor.id} className="p-4 flex items-center gap-4">
            {pastor.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                referrerPolicy="no-referrer"
                src={pastor.avatar_url}
                alt={pastor.nome}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-100 shadow-md shrink-0"
              />
            ) : (
              <Inicial texto={iniciaisDe(pastor.nome)} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-widest">
                {pastor.titulo ?? 'Pastor'}
              </p>
              <p className="font-bold text-base text-gray-900 leading-tight mt-0.5">{pastor.nome}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{igrejaNome}</p>
            </div>
          </div>
        ))}
      </div>
    </Moldura>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
      <div className="h-1 bg-gradient-to-r from-[#0B2447] via-[#0F52BA] to-[#4DA6FF]" />
      {children}
    </div>
  )
}

function Inicial({ texto, grande = false }: { texto: string; grande?: boolean }) {
  return (
    <div
      className={`${grande ? 'h-16 w-16' : 'h-14 w-14'} rounded-full bg-gradient-to-br from-[#0B2447] to-[#0F52BA] flex items-center justify-center ring-2 ring-blue-100 shadow-md shrink-0`}
    >
      <span className={`${grande ? 'text-xl' : 'text-lg'} font-bold text-white`}>{texto}</span>
    </div>
  )
}
