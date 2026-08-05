'use client'

import { useRef, useState, useTransition } from 'react'
import { Palette, Camera, Check, X } from 'lucide-react'
import {
  atualizarAparenciaRedeAction,
  uploadFundoRedeAction,
  atualizarFundoGaleriaRedeAction,
  alternarAutoCorRedeAction,
  salvarAutoCorRedeAction,
} from '@/app/actions/rede'
import { fundoStyle, ajustarCor, FUNDO_LABELS, type FundoTipo } from '@/lib/rede-fundo'
import { FundoGaleriaControle } from '@/components/shared/fundo-galeria-controle'
import { AutoCorControle } from '@/components/shared/auto-cor-controle'
import { AutoCorCapa } from '@/components/shared/auto-cor-capa'

interface Props {
  redeId: string
  cor: string
  corSecundaria: string | null
  fundoTipo: string
  fundoImagemUrl: string | null
  fundoOpacidade?: number | null
  galeriaAtiva: boolean
  galeriaOpacidade: number
  totalFotos: number
  /** Capa de onde as cores automáticas são extraídas. */
  capaUrl: string | null
  autoCorAtivo: boolean
  autoCorOrigem: string | null
  canEdit: boolean
}

const PALETA = [
  '#6366f1', '#0ea5e9', '#06b6d4', '#22c55e', '#84cc16',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
  '#64748b', '#0f172a',
]

export function RedeFundoPagina({
  redeId,
  cor: corInicial,
  corSecundaria: corSecInicial,
  fundoTipo: fundoInicial,
  fundoImagemUrl,
  fundoOpacidade,
  galeriaAtiva,
  galeriaOpacidade,
  totalFotos,
  capaUrl,
  autoCorAtivo,
  autoCorOrigem,
  canEdit,
}: Props) {
  const [autoCor, setAutoCor] = useState(autoCorAtivo)
  const [cor, setCor] = useState(corInicial)
  const [corSec, setCorSec] = useState(corSecInicial ?? ajustarCor(corInicial, -0.45))
  const [fundo, setFundo] = useState<FundoTipo>((fundoInicial as FundoTipo) ?? 'cor')
  const [imagem, setImagem] = useState<string | null>(fundoImagemUrl)
  const [opacidade, setOpacidade] = useState(fundoOpacidade ?? 100)
  const [aberto, setAberto] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const estilo = fundoStyle({
    cor,
    cor_secundaria: corSec,
    fundo_tipo: fundo,
    fundo_imagem_url: imagem,
    fundo_opacidade: opacidade,
  })

  function salvar(novoFundo: FundoTipo, novaCor: string, novaCorSec: string, novaOpacidade = opacidade) {
    setFundo(novoFundo)
    setCor(novaCor)
    setCorSec(novaCorSec)
    setOpacidade(novaOpacidade)
    startTransition(async () => {
      try {
        await atualizarAparenciaRedeAction(redeId, {
          cor: novaCor,
          cor_secundaria: novaCorSec,
          fundo_tipo: novoFundo,
          fundo_opacidade: novaOpacidade,
        })
        setSalvo(true)
        setTimeout(() => setSalvo(false), 1800)
      } catch {
        /* mantém o estado otimista; recarregar restaura o valor real */
      }
    })
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const anterior = imagem
    setImagem(URL.createObjectURL(file))
    setFundo('imagem')
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      try {
        const url = await uploadFundoRedeAction(redeId, fd)
        setImagem(url)
        await atualizarAparenciaRedeAction(redeId, {
          cor,
          cor_secundaria: corSec,
          fundo_tipo: 'imagem',
        })
      } catch {
        setImagem(anterior)
      }
    })
  }

  return (
    <>
      {/* Camada de fundo: cobre a viewport atrás de todo o conteúdo */}
      {/* A camada de cor fica ATRÁS da galeria (-z-[20] contra o -z-10 dela),
          para que as duas personalizações se somem em vez de competir. */}
      <div className="fixed inset-0 -z-[20] pointer-events-none" style={estilo} />

      {/* Recalcula as cores quando a capa muda. Só quem pode editar grava. */}
      {canEdit && (
        <AutoCorCapa
          capaUrl={capaUrl}
          ativo={autoCor}
          origem={autoCorOrigem}
          salvar={async (c, cs, origem) => {
            await salvarAutoCorRedeAction(redeId, { cor: c, corSecundaria: cs, origem })
          }}
        />
      )}

      {canEdit && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 backdrop-blur px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
          >
            {aberto ? <X className="h-3.5 w-3.5" /> : <Palette className="h-3.5 w-3.5" />}
            {aberto ? 'Fechar' : 'Fundo'}
            {salvo && <Check className="h-3.5 w-3.5 text-green-600" />}
          </button>

          {aberto && (
            <div className="absolute top-full right-0 mt-2 z-30 w-72 rounded-2xl border border-border bg-card p-4 space-y-4 shadow-xl">
              <AutoCorControle
                ativoInicial={autoCor}
                temCapa={Boolean(capaUrl)}
                alternar={async (a) => {
                  setAutoCor(a)
                  await alternarAutoCorRedeAction(redeId, a)
                }}
              />

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Estilo do fundo</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(FUNDO_LABELS) as FundoTipo[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={isPending || (t === 'imagem' && !imagem)}
                      onClick={() => salvar(t, cor, corSec)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                        fundo === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      {FUNDO_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transparência — vale para qualquer estilo (cor, degradê, nébula ou imagem) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Transparência</p>
                  <span className="text-xs text-muted-foreground tabular-nums">{opacidade}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacidade}
                  onChange={(e) => setOpacidade(Number(e.target.value))}
                  onMouseUp={(e) => salvar(fundo, cor, corSec, Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => salvar(fundo, cor, corSec, Number((e.target as HTMLInputElement).value))}
                  onKeyUp={(e) => salvar(fundo, cor, corSec, Number((e.target as HTMLInputElement).value))}
                  disabled={isPending}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Cor principal</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PALETA.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={isPending || autoCor}
                      onClick={() => salvar(fundo, c, corSec)}
                      aria-label={`Cor ${c}`}
                      className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-40 ${
                        cor.toLowerCase() === c ? 'border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={cor}
                    disabled={isPending || autoCor}
                    onChange={(e) => salvar(fundo, e.target.value, corSec)}
                    className="h-6 w-6 rounded-full border border-border bg-transparent p-0 cursor-pointer"
                    title="Cor personalizada"
                  />
                </div>
              </div>

              {(fundo === 'gradiente' || fundo === 'nebula') && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Cor secundária</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PALETA.map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={isPending || autoCor}
                        onClick={() => salvar(fundo, cor, c)}
                        aria-label={`Cor secundária ${c}`}
                        className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-40 ${
                          corSec.toLowerCase() === c ? 'border-foreground' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={corSec}
                      disabled={isPending || autoCor}
                      onChange={(e) => salvar(fundo, cor, e.target.value)}
                      className="h-6 w-6 rounded-full border border-border bg-transparent p-0 cursor-pointer"
                      title="Cor personalizada"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Imagem de fundo</p>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors disabled:opacity-40"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {imagem ? 'Trocar imagem' : 'Enviar imagem'}
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Diferente da capa: esta imagem preenche o fundo da página inteira.
                </p>
              </div>

              <FundoGaleriaControle
                ativoInicial={galeriaAtiva}
                opacidadeInicial={galeriaOpacidade}
                totalFotos={totalFotos}
                salvar={(ativo, opacidade) =>
                  atualizarFundoGaleriaRedeAction(redeId, { ativo, opacidade })
                }
              />

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
