'use client'

import { useRef, useState, useTransition } from 'react'
import { Palette, Camera, Check, X, Eraser } from 'lucide-react'
import { comprimirImagem } from '@/lib/comprimir-imagem'
import { fundoStyle, ajustarCor, FUNDO_LABELS, type FundoTipo } from '@/lib/rede-fundo'
import { FundoGaleriaControle } from '@/components/shared/fundo-galeria-controle'
import { AutoCorControle } from '@/components/shared/auto-cor-controle'
import { AutoCorCapa } from '@/components/shared/auto-cor-capa'

/**
 * Como a página grava cada ajuste. Quem usa amarra as próprias server actions —
 * é o único ponto em que evento e turma diferem.
 */
export interface AcoesFundo {
  salvarAparencia: (dados: {
    cor: string
    cor_secundaria: string
    fundo_tipo: string | null
    fundo_opacidade?: number
  }) => Promise<unknown>
  uploadImagem: (formData: FormData) => Promise<string>
  salvarGaleria: (dados: { ativo: boolean; opacidade: number }) => Promise<unknown>
  alternarAutoCor: (ativo: boolean) => Promise<unknown>
  salvarAutoCor: (cores: { cor: string; corSecundaria: string; origem: string }) => Promise<unknown>
}

export interface FundoPaginaProps {
  cor: string | null
  corSecundaria: string | null
  fundoTipo: string | null
  fundoImagemUrl: string | null
  fundoOpacidade: number | null
  galeriaAtiva: boolean
  galeriaOpacidade: number
  totalFotos: number
  /** Capa de onde as cores automáticas são extraídas. */
  capaUrl: string | null
  autoCorAtivo: boolean
  autoCorOrigem: string | null
  canEdit: boolean
  acoes: AcoesFundo
}

const PALETA = [
  '#6366f1', '#0ea5e9', '#06b6d4', '#22c55e', '#84cc16',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
  '#64748b', '#0f172a',
]

const COR_PADRAO = '#6366f1'

/**
 * Painel de fundo de uma página — cor, gradiente, nébula, imagem e a galeria
 * da comunidade em cascata.
 *
 * Nasceu dentro da página de evento e saiu para cá quando as turmas do Ensino
 * precisaram do mesmo controle. As ações de gravação chegam por `acoes`, então
 * a mecânica (estado otimista, upload comprimido, auto-cor a partir da capa) é
 * uma só, e cada página só diz em qual tabela salvar.
 *
 * `fundoTipo` nulo significa "sem personalização": a página mantém o fundo
 * normal do app. É o que impede um evento antigo de mudar de cara sozinho.
 */
export function FundoPagina({
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
  acoes,
}: FundoPaginaProps) {
  const [cor, setCor] = useState(corInicial ?? COR_PADRAO)
  const [corSec, setCorSec] = useState(corSecInicial ?? ajustarCor(corInicial ?? COR_PADRAO, -0.45))
  const [fundo, setFundo] = useState<FundoTipo | null>((fundoInicial as FundoTipo) ?? null)
  const [imagem, setImagem] = useState<string | null>(fundoImagemUrl)
  const [opacidade, setOpacidade] = useState(fundoOpacidade ?? 100)
  const [aberto, setAberto] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [autoCor, setAutoCor] = useState(autoCorAtivo)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const estilo = fundo
    ? fundoStyle({
        cor,
        cor_secundaria: corSec,
        fundo_tipo: fundo,
        fundo_imagem_url: imagem,
        fundo_opacidade: opacidade,
      })
    : null

  function salvar(
    novoFundo: FundoTipo | null,
    novaCor: string,
    novaCorSec: string,
    novaOpacidade = opacidade
  ) {
    setFundo(novoFundo)
    setCor(novaCor)
    setCorSec(novaCorSec)
    setOpacidade(novaOpacidade)
    startTransition(async () => {
      try {
        await acoes.salvarAparencia({
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
    e.target.value = ''
    if (!file) return

    const anterior = imagem
    const fundoAnterior = fundo
    setErro(null)
    setImagem(URL.createObjectURL(file))
    setFundo('imagem')

    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('file', await comprimirImagem(file))
        setImagem(await acoes.uploadImagem(fd))
      } catch (err) {
        setImagem(anterior)
        setFundo(fundoAnterior)
        setErro(err instanceof Error ? err.message : 'Erro ao enviar a imagem')
      }
    })
  }

  return (
    <>
      {/* Camada de fundo: cobre a viewport atrás de todo o conteúdo.
          A camada de cor fica ATRÁS da galeria (-z-[20] contra o -z-10 dela),
          para que as duas personalizações se somem em vez de competir. */}
      {estilo && <div className="fixed inset-0 -z-[20] pointer-events-none" style={estilo} />}

      {/* Recalcula as cores quando a capa muda. Só quem pode editar grava. */}
      {canEdit && (
        <AutoCorCapa
          capaUrl={capaUrl}
          ativo={autoCor}
          origem={autoCorOrigem}
          salvar={async (c, corSecundaria, origem) => {
            await acoes.salvarAutoCor({ cor: c, corSecundaria, origem })
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
                  await acoes.alternarAutoCor(a)
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
                  <button
                    type="button"
                    disabled={isPending || !fundo}
                    onClick={() => salvar(null, cor, corSec)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors disabled:opacity-40"
                  >
                    <Eraser className="h-3 w-3" />
                    Padrão
                  </button>
                </div>
              </div>

              {/* Transparência — vale para qualquer estilo */}
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
                  disabled={isPending || !fundo}
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
                      onClick={() => salvar(fundo ?? 'cor', c, corSec)}
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
                    onChange={(e) => salvar(fundo ?? 'cor', e.target.value, corSec)}
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
                {erro && <p className="text-[11px] text-destructive">{erro}</p>}
              </div>

              <FundoGaleriaControle
                ativoInicial={galeriaAtiva}
                opacidadeInicial={galeriaOpacidade}
                totalFotos={totalFotos}
                salvar={async (ativo, opacidadeGaleria) => {
                  await acoes.salvarGaleria({ ativo, opacidade: opacidadeGaleria })
                }}
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
