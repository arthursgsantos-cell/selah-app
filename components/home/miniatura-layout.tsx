import type { HomeLayout } from '@/lib/supabase/types'

/**
 * A prévia de cada layout, desenhada — não é print nem ícone.
 *
 * As duas camadas ficam sempre montadas e trocam por opacidade e escala: é o
 * que faz o cartão *virar* a outra coisa quando a pessoa escolhe, em vez de
 * piscar uma imagem nova. A mesma peça serve ao convite, à tela de Aparência e
 * ao véu da troca, para que os três falem da mesma home.
 */
export function MiniaturaLayout({ modo }: { modo: HomeLayout }) {
  const emIcones = modo === 'icones'

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 p-2.5 ring-1 ring-black/5">
      {/* Barra de topo — comum aos dois modos, é o cabeçalho do app. */}
      <div className="mb-1.5 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="h-1.5 w-8 rounded-full bg-slate-400/70" />
        <span className="ml-auto h-1.5 w-4 rounded-full bg-slate-300" />
      </div>

      <div className="relative h-[calc(100%-0.875rem)]">
        {/* Landing: capa, faixas largas e dois cartões lado a lado. */}
        <div
          className={`absolute inset-0 flex flex-col gap-1.5 transition-all duration-500 ease-out ${
            emIcones ? 'scale-90 opacity-0 blur-[2px]' : 'scale-100 opacity-100 blur-0'
          }`}
        >
          <span className="h-1/3 w-full rounded-md bg-gradient-to-br from-[#19376D] to-[#0F52BA]" />
          <span className="h-3 w-full rounded-md bg-white shadow-sm" />
          <span className="h-3 w-full rounded-md bg-white shadow-sm" />
          <div className="flex flex-1 gap-1.5">
            <span className="flex-1 rounded-md bg-white shadow-sm" />
            <span className="flex-1 rounded-md bg-white shadow-sm" />
          </div>
        </div>

        {/* Ícones: capa baixa e a grade de atalhos. */}
        <div
          className={`absolute inset-0 flex flex-col gap-1.5 transition-all duration-500 ease-out ${
            emIcones ? 'scale-100 opacity-100 blur-0' : 'scale-110 opacity-0 blur-[2px]'
          }`}
        >
          <span className="h-1/5 w-full rounded-md bg-gradient-to-br from-[#19376D] to-[#0F52BA]" />
          <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-1.5">
            {LADRILHOS.map((cor, i) => (
              <span
                key={i}
                className="rounded-[5px] shadow-sm"
                style={{ backgroundImage: `linear-gradient(150deg, ${cor[0]}, ${cor[1]})` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** As mesmas famílias de cor da grade de verdade (ver `lib/home-atalhos.ts`). */
const LADRILHOS: [string, string][] = [
  ['#3B82F6', '#1D4ED8'],
  ['#8B5CF6', '#5B21B6'],
  ['#22D3EE', '#0369A1'],
  ['#34D399', '#047857'],
  ['#FBBF24', '#B45309'],
  ['#F472B6', '#9D174D'],
]
