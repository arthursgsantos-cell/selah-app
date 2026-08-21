'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const KEY = 'ibzs-home-layout'
type Layout = 'landing' | 'icons'

export function HomeLayoutChooser({
  enabled,
  igrejaNome,
  logoUrl,
  aoVivo,
}: {
  enabled: boolean
  igrejaNome?: string | null
  logoUrl?: string | null
  aoVivo?: string | null
}) {
  const [layout, setLayout] = useState<Layout>('landing')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const saved = window.localStorage.getItem(KEY) as Layout | null
    if (saved === 'icons' || saved === 'landing') setLayout(saved)
    if (!saved) setOpen(true)
  }, [enabled])

  if (!enabled) return null
  const choose = (value: Layout) => {
    setLayout(value)
    setOpen(false)
    window.localStorage.setItem(KEY, value)
  }
  const cards = [
    { href: '/eventos', label: 'Eventos', emoji: '📅' },
    { href: '/ensino', label: 'Ensino', emoji: '📖' },
    { href: '/celulas', label: 'Células', emoji: '👥' },
    { href: '/contribuir', label: 'Contribuir', emoji: '💙' },
    { href: '/perfil', label: 'Meu perfil', emoji: '🙋' },
    ...(aoVivo ? [{ href: aoVivo, label: 'Ao vivo', emoji: '🔴' }] : []),
  ]
  return (
    <>
      {layout === 'icons' && (
        <div className="fixed inset-0 z-[60] overflow-auto bg-background px-5 py-8">
          <div className="mx-auto flex min-h-full max-w-md flex-col items-center">
            {logoUrl ? <img src={logoUrl} alt={igrejaNome ?? ''} className="mb-4 h-20 w-20 rounded-2xl bg-white object-contain p-2 shadow" /> : <div className="mb-4 text-5xl">⛪</div>}
            <h1 className="text-center text-xl font-bold">{igrejaNome ?? 'Nossa Igreja'}</h1>
            <p className="mb-7 mt-1 text-center text-sm text-muted-foreground">Escolha um caminho</p>
            <div className="grid w-full grid-cols-3 gap-3">
              {cards.map((card) => <Link key={card.label} href={card.href} className="flex aspect-square flex-col items-center justify-center rounded-2xl border bg-card p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="text-3xl">{card.emoji}</span><span className="mt-2 text-xs font-semibold">{card.label}</span></Link>)}
            </div>
            <button onClick={() => choose('landing')} className="mt-auto pt-10 text-sm font-medium text-primary underline underline-offset-4">Usar Landing Page</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-[55] rounded-full border bg-background/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur">⚙️ Layout</button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-background p-5 shadow-2xl">
            <h2 className="text-center text-xl font-bold">Como você quer ver a Home?</h2>
            <p className="mb-5 mt-1 text-center text-sm text-muted-foreground">Você pode trocar essa opção depois.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => choose('landing')} className={`rounded-2xl border-2 p-3 text-left ${layout === 'landing' ? 'border-primary' : 'border-border'}`}><div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 to-blue-500 text-4xl text-white">🏛️</div><strong>Landing Page</strong><span className="mt-1 block text-xs text-muted-foreground">Seções completas e detalhadas</span><span className="mt-3 block rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-primary-foreground">Escolher este layout</span></button>
              <button onClick={() => choose('icons')} className={`rounded-2xl border-2 p-3 text-left ${layout === 'icons' ? 'border-primary' : 'border-border'}`}><div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-muted"><div className="grid grid-cols-3 gap-2 text-xl">📅 📖 👥 💙 🙋 🔴</div></div><strong>Modo Ícones</strong><span className="mt-1 block text-xs text-muted-foreground">Acesso rápido e visual</span><span className="mt-3 block rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-primary-foreground">Escolher este layout</span></button>
            </div>
            {layout && <button onClick={() => setOpen(false)} className="mt-4 block w-full text-center text-sm text-muted-foreground">Continuar sem alterar</button>}
          </div>
        </div>
      )}
    </>
  )
}
