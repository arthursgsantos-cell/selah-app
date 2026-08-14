'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Coins, ImagePlus, Loader2, Pencil, Play, Plus, Star, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { comprimirImagem } from '@/lib/comprimir-imagem'
import { centavosTexto } from '@/lib/campanhas'
import { resolverVideo } from '@/lib/video-embed'
import {
  criarCampanhaAction, editarCampanhaAction, excluirCampanhaAction,
  subirImagemCampanhaAction,
  type Campanha, type DadosCampanha,
} from '@/app/actions/campanhas'

interface Props {
  campanhas: Campanha[]
}

const VAZIO: DadosCampanha = {
  nome: '', descricao: null, centavos: 1, ativa: true,
  imagem_url: null, video_url: null, destaque: false,
}

function Formulario({
  inicial,
  onSalvar,
  onCancelar,
  salvando,
  erro,
}: {
  inicial: DadosCampanha
  onSalvar: (d: DadosCampanha) => void
  onCancelar: () => void
  salvando: boolean
  erro: string | null
}) {
  const [dados, setDados] = useState<DadosCampanha>(inicial)
  const [subindo, setSubindo] = useState(false)
  const [erroImagem, setErroImagem] = useState<string | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  async function escolherImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErroImagem(null)
    setSubindo(true)
    try {
      // Comprime antes de mandar: o corpo de uma Server Action tem teto de
      // 1 MB, e foto de celular passa disso com folga.
      const menor = await comprimirImagem(file)
      const fd = new FormData()
      fd.append('file', menor)
      const r = await subirImagemCampanhaAction(fd)
      if (!r.ok) setErroImagem(r.erro)
      else setDados((d) => ({ ...d, imagem_url: r.url }))
    } catch (err) {
      setErroImagem(err instanceof Error ? err.message : 'Erro ao subir a imagem')
    } finally {
      setSubindo(false)
      if (arquivoRef.current) arquivoRef.current.value = ''
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-background p-3 space-y-3">
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome da campanha</Label>
          <Input
            value={dados.nome}
            onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))}
            placeholder="Ex: Construção da nova sede"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Final</Label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">,</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={dados.centavos}
              onChange={(e) =>
                setDados((d) => ({ ...d, centavos: Number(e.target.value) }))
              }
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição (opcional)</Label>
        <Textarea
          value={dados.descricao ?? ''}
          onChange={(e) => setDados((d) => ({ ...d, descricao: e.target.value }))}
          placeholder="Uma linha explicando o destino"
          className="text-sm resize-none"
          rows={2}
        />
      </div>

      {/* Card da campanha — a imagem que aparece na página de contribuição */}
      <div className="space-y-1.5">
        <Label className="text-xs">Imagem do card (opcional)</Label>
        {dados.imagem_url ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dados.imagem_url} alt="" className="h-28 w-full object-cover" />
            <button
              type="button"
              onClick={() => setDados((d) => ({ ...d, imagem_url: null }))}
              className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Remover imagem"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => arquivoRef.current?.click()}
            disabled={subindo}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 text-xs text-muted-foreground hover:bg-accent transition-colors disabled:opacity-60"
          >
            {subindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {subindo ? 'Enviando…' : 'Escolher imagem'}
          </button>
        )}
        <input
          ref={arquivoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={escolherImagem}
        />
        {erroImagem && <p className="text-xs text-destructive">{erroImagem}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Vídeo promocional (opcional)</Label>
        <Input
          value={dados.video_url ?? ''}
          onChange={(e) => setDados((d) => ({ ...d, video_url: e.target.value }))}
          placeholder="Link do YouTube, Vimeo ou .mp4"
          className="h-8 text-sm"
        />
        {dados.video_url?.trim() && !resolverVideo(dados.video_url) && (
          <p className="text-xs text-amber-700">
            Não reconheci esse link. Use YouTube, Vimeo ou um arquivo .mp4.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={dados.ativa}
          onChange={(e) => setDados((d) => ({ ...d, ativa: e.target.checked }))}
          className="accent-primary h-3.5 w-3.5"
        />
        Mostrar na página de contribuição
      </label>

      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={dados.destaque ?? false}
          onChange={(e) => setDados((d) => ({ ...d, destaque: e.target.checked }))}
          className="accent-primary h-3.5 w-3.5"
        />
        Destacar também na tela inicial
      </label>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSalvar(dados)} disabled={salvando} className="h-8 text-xs">
          {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar} disabled={salvando} className="h-8 text-xs">
          Cancelar
        </Button>
      </div>
    </div>
  )
}

/**
 * Campanhas de contribuição.
 *
 * Cada uma fica com um final de centavos — é por ele que a tesouraria separa
 * no extrato o que foi dízimo do que foi construção da nova sede, já que o
 * PIX chega todo na mesma conta.
 */
export function CampanhasSection({ campanhas }: Props) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function criar(dados: DadosCampanha) {
    setErro(null)
    iniciar(async () => {
      const r = await criarCampanhaAction(dados)
      if (!r.ok) { setErro(r.erro); return }
      setCriando(false)
      router.refresh()
    })
  }

  function editar(id: string, dados: DadosCampanha) {
    setErro(null)
    iniciar(async () => {
      const r = await editarCampanhaAction(id, dados)
      if (!r.ok) { setErro(r.erro ?? 'Erro ao salvar'); return }
      setEditando(null)
      router.refresh()
    })
  }

  function excluir(id: string) {
    iniciar(async () => {
      await excluirCampanhaAction(id)
      setConfirmando(null)
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Coins className="h-3 w-3" /> Campanhas
        </p>
        {!criando && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setCriando(true); setErro(null) }}
            className="gap-1.5 h-7 px-2.5 text-xs text-muted-foreground"
          >
            <Plus className="h-3 w-3" />
            Nova
          </Button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        Cada campanha fica com um final de centavos. Na página de contribuição
        ela vira um botão, e quem escolhe tem o valor ajustado para terminar
        naquele número — é assim que a tesouraria separa os destinos no extrato.
      </p>

      {criando && (
        <div className="mb-3">
          <Formulario
            inicial={VAZIO}
            onSalvar={criar}
            onCancelar={() => { setCriando(false); setErro(null) }}
            salvando={salvando}
            erro={erro}
          />
        </div>
      )}

      {campanhas.length === 0 && !criando ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Nenhuma campanha cadastrada. Sem elas, a página mostra só o valor
          normal — que continua funcionando.
        </p>
      ) : (
        <div className="space-y-2">
          {campanhas.map((c) =>
            editando === c.id ? (
              <Formulario
                key={c.id}
                inicial={{
                  nome: c.nome,
                  descricao: c.descricao,
                  centavos: c.centavos,
                  ativa: c.ativa,
                  imagem_url: c.imagem_url,
                  video_url: c.video_url,
                  destaque: c.destaque,
                }}
                onSalvar={(d) => editar(c.id, d)}
                onCancelar={() => { setEditando(null); setErro(null) }}
                salvando={salvando}
                erro={erro}
              />
            ) : (
              <div key={c.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-3">
                  {c.imagem_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imagem_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 font-mono text-sm font-bold text-primary tabular-nums">
                      {centavosTexto(c.centavos)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    {c.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{c.descricao}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {c.imagem_url && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary tabular-nums">
                          {centavosTexto(c.centavos)}
                        </span>
                      )}
                      {c.video_url && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          <Play className="h-2.5 w-2.5" /> vídeo
                        </span>
                      )}
                      {c.destaque && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <Star className="h-2.5 w-2.5" /> na tela inicial
                        </span>
                      )}
                      {!c.ativa && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Não aparece na página
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditando(c.id); setErro(null) }}
                    aria-label={`Editar ${c.nome}`}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(c.id)}
                    aria-label={`Apagar ${c.nome}`}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {confirmando === c.id && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs text-red-800">
                      Apagar &ldquo;{c.nome}&rdquo;? O que já foi contribuído continua
                      no extrato — só o botão some da página.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => excluir(c.id)}
                        disabled={salvando}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {salvando ? 'Apagando…' : 'Apagar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        disabled={salvando}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-red-800"
                      >
                        <X className="h-3 w-3" /> Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
