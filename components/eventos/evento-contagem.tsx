'use client'

import { useEffect, useState } from 'react'

interface Props {
  /** ISO com fuso, vindo de `eventos.data_hora`. */
  dataHora: string
}

type Restante = { dias: number; horas: number; minutos: number; segundos: number }

function calcular(alvo: number): Restante | null {
  const diff = alvo - Date.now()
  if (diff <= 0) return null
  const s = Math.floor(diff / 1000)
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
  }
}

/**
 * Contagem regressiva até o evento.
 *
 * Renderiza nulo no servidor e no primeiro passo do cliente: a diferença é
 * calculada com o relógio de quem está lendo, e desenhá-la no servidor daria
 * erro de hidratação (o HTML do servidor mostraria outro segundo).
 */
export function EventoContagem({ dataHora }: Props) {
  const alvo = new Date(dataHora).getTime()
  const [restante, setRestante] = useState<Restante | null>(null)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    setMontado(true)
    setRestante(calcular(alvo))
    const id = setInterval(() => setRestante(calcular(alvo)), 1000)
    return () => clearInterval(id)
  }, [alvo])

  if (!montado || !restante) return null

  const blocos = [
    { valor: restante.dias, rotulo: restante.dias === 1 ? 'dia' : 'dias' },
    { valor: restante.horas, rotulo: restante.horas === 1 ? 'hora' : 'horas' },
    { valor: restante.minutos, rotulo: 'min' },
    { valor: restante.segundos, rotulo: 'seg' },
  ]

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-4 text-primary-foreground shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-widest opacity-80">
        Faltam
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {blocos.map((b) => (
          <div
            key={b.rotulo}
            className="rounded-xl bg-white/15 py-2 text-center backdrop-blur-sm"
          >
            <p className="text-2xl font-bold leading-none tabular-nums">
              {String(b.valor).padStart(2, '0')}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide opacity-80">{b.rotulo}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
