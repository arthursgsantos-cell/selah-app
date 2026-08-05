'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  value: string        // YYYY-MM-DD
  onChange: (iso: string) => void
  id?: string
  className?: string
}

function toDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

function toIso(digits: string): string {
  if (digits.length !== 8) return ''
  const d = digits.slice(0, 2)
  const m = digits.slice(2, 4)
  const y = digits.slice(4, 8)
  const dN = parseInt(d), mN = parseInt(m), yN = parseInt(y)
  if (dN < 1 || dN > 31 || mN < 1 || mN > 12 || yN < 1900) return ''
  return `${y}-${m}-${d}`
}

function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function DataInput({ value, onChange, id, className }: Props) {
  const [display, setDisplay] = useState(() => toDisplay(value))
  const prevIso = useRef(value)

  // Sincroniza se o value externo mudar (ex: reset)
  if (value !== prevIso.current) {
    prevIso.current = value
    const d = toDisplay(value)
    if (d !== display) setDisplay(d)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value)
    setDisplay(masked)
    const digits = masked.replace(/\D/g, '')
    const iso = toIso(digits)
    if (iso) {
      prevIso.current = iso
      onChange(iso)
    } else if (digits.length === 0) {
      prevIso.current = ''
      onChange('')
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      value={display}
      onChange={handleChange}
      maxLength={10}
      className={cn(
        'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring',
        className
      )}
    />
  )
}
