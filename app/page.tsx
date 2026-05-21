'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    const t = setTimeout(() => router.replace('/home'), 2200)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1976D2]">
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.85)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
        className="flex flex-col items-center gap-6"
      >
        <img
          src="/icon-splash.png"
          alt="Igreja Batista Zona Sul"
          width={220}
          height={220}
          className="drop-shadow-2xl h-52 w-auto"
          loading="eager"
        />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
