'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Loader2, Palette } from 'lucide-react'
import { MiniaturaLayout } from '@/components/home/miniatura-layout'
import { NOME_LAYOUT, RESUMO_LAYOUT, useTrocaLayout } from '@/components/home/trocar-layout-home'
import type { HomeLayout } from '@/lib/supabase/types'

const OPCOES: HomeLayout[] = ['landing', 'icones']

/**
 * Aparência da Home, dentro do perfil.
 *
 * É aqui que a troca de layout mora de verdade — o botão flutuante que fazia
 * isso antes ficava por cima da home inteira, em toda visita, para uma decisão
 * que se toma uma vez por ano.
 *
 * Salva no toque, sem botão de confirmar: a escolha é reversível no mesmo
 * gesto, e a miniatura já mostra o que vai acontecer. Quem chega sem ter
 * escolhido nada ainda (`atual` nulo) vê as duas opções sem seleção, e não uma
 * marca em algo que não escolheu.
 */
export function AparenciaHome({ atual }: { atual: HomeLayout | null }) {
  const [escolhido, setEscolhido] = useState<HomeLayout | null>(atual)
  const [salvo, setSalvo] = useState(false)
  const { trocar, trocandoPara, erro } = useTrocaLayout()

  useEffect(() => {
    if (!salvo) return
    const t = setTimeout(() => setSalvo(false), 2600)
    return () => clearTimeout(t)
  }, [salvo])

  async function escolher(opcao: HomeLayout) {
    if (opcao === escolhido || trocandoPara) return
    setEscolhido(opcao)
    setSalvo(false)
    // Sem véu e sem animação de saída: aqui não há home na tela para se
    // transformar. A cascata fica guardada para a próxima visita a /home.
    await trocar(opcao, { comVeu: false })
    setSalvo(true)
  }

  return (
    <section id="aparencia" className="scroll-mt-20 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Aparência da Home</h2>
        {trocandoPara && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {salvo && !trocandoPara && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <Check className="h-3 w-3" strokeWidth={3} />
            Salvo
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        Como a página inicial abre para você. Vale em qualquer aparelho onde você entrar.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {OPCOES.map((opcao) => {
          const ativo = escolhido === opcao
          return (
            <button
              key={opcao}
              type="button"
              onClick={() => escolher(opcao)}
              disabled={trocandoPara !== null}
              aria-pressed={ativo}
              className={`relative rounded-2xl border p-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-70 ${
                ativo
                  ? 'border-primary bg-primary/[0.04] shadow-md ring-1 ring-primary'
                  : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
              }`}
            >
              <span
                className={`absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200 ${
                  ativo ? 'scale-100 bg-primary text-primary-foreground' : 'scale-0 bg-transparent'
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <MiniaturaLayout modo={opcao} />
              <span className="mt-2 block text-sm font-semibold leading-tight">{NOME_LAYOUT[opcao]}</span>
              <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                {RESUMO_LAYOUT[opcao]}
              </span>
            </button>
          )
        })}
      </div>

      {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}

      <Link
        href="/home"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
      >
        Ver como ficou
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  )
}
