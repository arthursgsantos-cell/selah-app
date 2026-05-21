'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { MapPin } from 'lucide-react'

export interface EnderecoSelecionado {
  endereco_maps: string
  endereco_latitude: number
  endereco_longitude: number
}

interface Props {
  defaultValue?: string | null
  onSelect: (dados: EnderecoSelecionado) => void
}

setOptions({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  language: 'pt-BR',
  region: 'BR',
})

export function EnderecoAutocomplete({ defaultValue, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)
  const onSelectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    importLibrary('places')
      .then(() => setReady(true))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'br' },
      fields: ['formatted_address', 'geometry'],
    })

    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place?.formatted_address) return
      onSelectRef.current({
        endereco_maps: place.formatted_address,
        endereco_latitude: place.geometry?.location?.lat() ?? 0,
        endereco_longitude: place.geometry?.location?.lng() ?? 0,
      })
    })

    acRef.current = ac
  }, [ready])

  return (
    <div className="relative">
      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
      <input
        ref={inputRef}
        type="text"
        defaultValue={defaultValue ?? ''}
        disabled={!ready}
        placeholder={ready ? 'Buscar endereço...' : 'Carregando...'}
        className="w-full h-8 rounded-lg border border-input bg-background pl-8 pr-2.5 py-1 text-sm outline-none focus-visible:border-ring disabled:opacity-50"
      />
    </div>
  )
}
