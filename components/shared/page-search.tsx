'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X, ArrowUpDown } from 'lucide-react'

export interface SortOption {
  value: string
  label: string
}

interface Props {
  placeholder?: string
  sortOptions?: SortOption[]
  defaultSort?: string
  /** se true, barra já começa aberta (quando há q na URL) */
  initialOpen?: boolean
}

export function PageSearch({ placeholder = 'Buscar...', sortOptions, defaultSort = '' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const q = searchParams.get('q') ?? ''
  const sort = searchParams.get('sort') ?? defaultSort

  function update(newQ: string, newSort: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (newQ) params.set('q', newQ)
    else params.delete('q')
    if (newSort && newSort !== defaultSort) params.set('sort', newSort)
    else params.delete('sort')
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="relative flex items-center">
        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none transition-colors ${
          isPending ? 'text-primary animate-pulse' : 'text-muted-foreground'
        }`} />
        <input
          value={q}
          onChange={(e) => update(e.target.value, sort)}
          placeholder={placeholder}
          className="h-8 pl-8 pr-7 rounded-lg border border-input text-sm bg-background outline-none focus:border-ring w-40 transition-all"
        />
        {q && (
          <button
            type="button"
            onClick={() => update('', sort)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {sortOptions && sortOptions.length > 0 && (
        <div className="flex items-center gap-1">
          <ArrowUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
          <select
            value={sort}
            onChange={(e) => update(q, e.target.value)}
            className="h-8 rounded-lg border border-input text-xs bg-background px-2 outline-none focus:border-ring cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
