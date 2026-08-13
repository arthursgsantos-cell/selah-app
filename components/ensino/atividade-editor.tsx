'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronDown, ChevronUp, Eye, EyeOff, ImagePlus, Loader2, Plus, Trash2,
  X, Layers, Palette, Type, Film, Image as ImageIcon,
} from 'lucide-react'
import { EditorTexto } from '@/components/shared/editor-texto'
import { comprimirImagem } from '@/lib/comprimir-imagem'
import { TIPO_ATIVIDADE } from '@/lib/ensino/atividades'
import {
  adicionarSecaoAction, enviarImagemAtividadeAction, excluirAtividadeAction,
  excluirSecaoAction, publicarAtividadeAction, removerImagemAtividadeAction,
  reordenarSecoesAction, salvarAtividadeAction, salvarSecaoAction,
} from '@/app/actions/ensino/atividades'
import { LeituraConfig } from '@/components/ensino/leitura-config'
import { QuizEditor } from '@/components/ensino/quiz-editor'
import type { LivroBiblia } from '@/lib/ensino/leitura'
import type { AtividadeCompleta, PerguntaCompleta, SecaoAtividade } from '@/lib/ensino/atividades-consultas'
import type { ConfigLeitura, TipoSecaoAtividade } from '@/lib/supabase/types'

interface Props {
  atividade: AtividadeCompleta
  perguntas: PerguntaCompleta[]
  livros: LivroBiblia[]
}

const BLOCOS: { tipo: TipoSecaoAtividade; label: string; icone: React.ComponentType<{ className?: string }> }[] = [
  { tipo: 'texto', label: 'Texto', icone: Type },
  { tipo: 'imagem', label: 'Imagem', icone: ImageIcon },
  { tipo: 'video', label: 'Vídeo', icone: Film },
]

/**
 * A tela de montagem da atividade.
 *
 * Cada bloco salva por conta própria: um formulário único com botão de salvar
 * no fim perderia o trabalho de quem fecha a aba no meio, e aqui o meio é
 * longo — capa, prazo, texto, blocos e dez perguntas.
 *
 * A ordem da tela é a da decisão: primeiro o que a atividade é (título, prazo),
 * depois o miolo do tipo, e por último a aparência — que é enfeite, e não deve
 * estar entre o professor e a pergunta que ele veio escrever.
 */
export function AtividadeEditor({ atividade, perguntas, livros }: Props) {
  const router = useRouter()
  const [titulo, setTitulo] = useState(atividade.titulo)
  const [descricao, setDescricao] = useState(atividade.descricao ?? '')
  const [prazo, setPrazo] = useState(atividade.prazo ?? '')
  const [abreEm, setAbreEm] = useState(atividade.abreEm ?? '')
  const [videoUrl, setVideoUrl] = useState(atividade.videoUrl ?? '')
  const [opacidade, setOpacidade] = useState(atividade.fundoOpacidade)
  const [leitura, setLeitura] = useState<ConfigLeitura>(
    atividade.leitura ?? { modo: 'percurso', trechos: [], repeticoes: 1 }
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pendente, iniciar] = useTransition()

  function salvar(extra?: { leitura?: ConfigLeitura }) {
    setErro(null)
    iniciar(async () => {
      const r = await salvarAtividadeAction(atividade.id, {
        titulo,
        descricao,
        prazo: prazo || null,
        abreEm: abreEm || null,
        videoUrl: videoUrl || null,
        fundoOpacidade: opacidade,
        ...(atividade.tipo === 'leitura' ? { leitura: extra?.leitura ?? leitura } : {}),
      })
      if (!r.ok) { setErro(r.erro); return }
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
      router.refresh()
    })
  }

  function publicar() {
    setErro(null)
    iniciar(async () => {
      const r = await publicarAtividadeAction(atividade.id, !atividade.publicada)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  function excluir() {
    if (!confirm('Excluir esta atividade? As entregas e o cronograma saem junto.')) return
    iniciar(async () => {
      const r = await excluirAtividadeAction(atividade.id)
      if (!r.ok) { setErro(r.erro); return }
      router.push(`/ensino/turma/${atividade.turmaId}/atividades`)
    })
  }

  return (
    <div className="space-y-4">
      {/* Publicar, e o estado atual. Fica no topo porque é a decisão que muda
          se a turma vê ou não o que está sendo montado. */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            atividade.publicada ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
          }`}
        >
          {atividade.publicada ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {atividade.publicada ? 'Publicada' : 'Rascunho'}
        </span>
        <span className="text-xs text-muted-foreground">{TIPO_ATIVIDADE[atividade.tipo].label}</span>

        <div className="ml-auto flex gap-2">
          <Link
            href={`/ensino/atividade/${atividade.id}`}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
          >
            Ver como aluno
          </Link>
          <button
            type="button"
            onClick={publicar}
            disabled={pendente}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
              atividade.publicada
                ? 'border border-border'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {atividade.publicada ? 'Despublicar' : 'Publicar'}
          </button>
        </div>
      </div>

      {erro && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      {/* O que a atividade é */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <label htmlFor="titulo" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Título
          </label>
          <input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => salvar()}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus-visible:border-ring"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="abre-em" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Abre em
            </label>
            <input
              id="abre-em"
              type="date"
              value={abreEm}
              onChange={(e) => setAbreEm(e.target.value)}
              onBlur={() => salvar()}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Vazio: assim que publicar.</p>
          </div>
          <div>
            <label htmlFor="prazo" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Prazo
            </label>
            <input
              id="prazo"
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              onBlur={() => salvar()}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
            {atividade.tipo === 'leitura' && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                É o prazo que divide a leitura por dia.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Enunciado
          </p>
          <EditorTexto
            value={descricao}
            onChange={setDescricao}
            minRows={4}
            placeholder="O que o aluno precisa saber para fazer..."
          />
          <button
            type="button"
            onClick={() => salvar()}
            disabled={pendente}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-50"
          >
            {pendente ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : salvo ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : null}
            {salvo ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      </section>

      {/* O miolo do tipo */}
      {atividade.tipo === 'leitura' && (
        <LeituraConfig
          livros={livros}
          config={leitura}
          prazo={prazo || null}
          abreEm={abreEm || null}
          onChange={(c) => {
            setLeitura(c)
            // Salva na hora: a config vive no jsonb, e um "salvar" separado
            // faria o professor perder os trechos ao trocar de aba.
            salvar({ leitura: c })
          }}
        />
      )}

      {atividade.tipo === 'quiz' && (
        <QuizEditor atividadeId={atividade.id} perguntas={perguntas} />
      )}

      {/* Blocos livres */}
      <SecoesEditor atividadeId={atividade.id} secoes={atividade.secoes} />

      {/* Aparência */}
      <Aparencia
        atividade={atividade}
        videoUrl={videoUrl}
        setVideoUrl={setVideoUrl}
        opacidade={opacidade}
        setOpacidade={setOpacidade}
        onSalvar={() => salvar()}
      />

      <button
        type="button"
        onClick={excluir}
        disabled={pendente}
        className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        Excluir atividade
      </button>
    </div>
  )
}

/** Os blocos de texto, imagem e vídeo que se arrastam antes das perguntas. */
function SecoesEditor({ atividadeId, secoes }: { atividadeId: string; secoes: SecaoAtividade[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  // Só os blocos livres: o de 'perguntas' é âncora do quiz e não se arrasta.
  const livres = secoes.filter((s) => s.tipo !== 'perguntas')

  function adicionar(tipo: TipoSecaoAtividade) {
    iniciar(async () => {
      const r = await adicionarSecaoAction(atividadeId, tipo)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao
    if (destino < 0 || destino >= livres.length) return
    const ordenadas = [...livres]
    const [movida] = ordenadas.splice(indice, 1)
    ordenadas.splice(destino, 0, movida)
    iniciar(async () => {
      const r = await reordenarSecoesAction(atividadeId, ordenadas.map((s) => s.id))
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  function excluir(id: string) {
    if (!confirm('Excluir este bloco?')) return
    iniciar(async () => {
      const r = await excluirSecaoAction(id)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Blocos da página</h2>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Texto, imagem ou vídeo entre o enunciado e o que o aluno responde.
      </p>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {livres.map((secao, i) => (
        <BlocoEditor
          key={secao.id}
          atividadeId={atividadeId}
          secao={secao}
          primeiro={i === 0}
          ultimo={i === livres.length - 1}
          onSubir={() => mover(i, -1)}
          onDescer={() => mover(i, 1)}
          onExcluir={() => excluir(secao.id)}
          pendente={pendente}
        />
      ))}

      <div className="flex flex-wrap gap-1.5">
        {BLOCOS.map((b) => (
          <button
            key={b.tipo}
            type="button"
            onClick={() => adicionar(b.tipo)}
            disabled={pendente}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {b.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function BlocoEditor({
  atividadeId, secao, primeiro, ultimo, onSubir, onDescer, onExcluir, pendente,
}: {
  atividadeId: string
  secao: SecaoAtividade
  primeiro: boolean
  ultimo: boolean
  onSubir: () => void
  onDescer: () => void
  onExcluir: () => void
  pendente: boolean
}) {
  const router = useRouter()
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [titulo, setTitulo] = useState(secao.titulo ?? '')
  const [conteudo, setConteudo] = useState(secao.conteudo ?? '')
  const [videoUrl, setVideoUrl] = useState(secao.videoUrl ?? '')
  const [enviando, setEnviando] = useState(false)
  const [, iniciar] = useTransition()

  const Icone = BLOCOS.find((b) => b.tipo === secao.tipo)?.icone ?? Type

  function salvar(extra?: { midiaUrl?: string | null }) {
    iniciar(async () => {
      await salvarSecaoAction(secao.id, {
        titulo,
        conteudo,
        videoUrl: videoUrl || null,
        ...(extra?.midiaUrl !== undefined ? { midiaUrl: extra.midiaUrl } : {}),
      })
      router.refresh()
    })
  }

  async function enviarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return

    setEnviando(true)
    const fd = new FormData()
    fd.append('file', await comprimirImagem(arquivo))
    fd.append('alvo', 'secao')
    const r = await enviarImagemAtividadeAction(atividadeId, fd)
    setEnviando(false)
    if (r.ok && r.url) salvar({ midiaUrl: r.url })
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <Icone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => salvar()}
          placeholder="Título do bloco (opcional)"
          aria-label="Título do bloco"
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs font-medium outline-none focus-visible:border-ring"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button" onClick={onSubir} disabled={primeiro || pendente}
            aria-label="Subir bloco"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button" onClick={onDescer} disabled={ultimo || pendente}
            aria-label="Descer bloco"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button" onClick={onExcluir} disabled={pendente}
            aria-label="Excluir bloco"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {secao.tipo === 'texto' && (
        <>
          <EditorTexto value={conteudo} onChange={setConteudo} minRows={3} placeholder="Escreva..." />
          <button
            type="button"
            onClick={() => salvar()}
            className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            Salvar bloco
          </button>
        </>
      )}

      {secao.tipo === 'imagem' && (
        <div className="space-y-2">
          {secao.midiaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={secao.midiaUrl} alt="" className="max-h-48 w-full rounded-lg object-contain" />
          )}
          <button
            type="button"
            onClick={() => arquivoRef.current?.click()}
            disabled={enviando}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
            {secao.midiaUrl ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={enviarImagem}
          />
        </div>
      )}

      {secao.tipo === 'video' && (
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          onBlur={() => salvar()}
          placeholder="Link do YouTube ou Vimeo"
          aria-label="Link do vídeo do bloco"
          className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus-visible:border-ring"
        />
      )}
    </div>
  )
}

function Aparencia({
  atividade, videoUrl, setVideoUrl, opacidade, setOpacidade, onSalvar,
}: {
  atividade: AtividadeCompleta
  videoUrl: string
  setVideoUrl: (v: string) => void
  opacidade: number
  setOpacidade: (v: number) => void
  onSalvar: () => void
}) {
  const router = useRouter()
  const capaRef = useRef<HTMLInputElement>(null)
  const fundoRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState<'capa' | 'fundo' | null>(null)
  const [, iniciar] = useTransition()

  async function enviar(alvo: 'capa' | 'fundo', e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return

    setEnviando(alvo)
    const fd = new FormData()
    fd.append('file', await comprimirImagem(arquivo))
    fd.append('alvo', alvo)
    await enviarImagemAtividadeAction(atividade.id, fd)
    setEnviando(null)
    router.refresh()
  }

  function remover(alvo: 'capa' | 'fundo') {
    iniciar(async () => {
      await removerImagemAtividadeAction(atividade.id, alvo)
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Aparência</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['capa', 'fundo'] as const).map((alvo) => {
          const url = alvo === 'capa' ? atividade.capaUrl : atividade.fundoUrl
          const ref = alvo === 'capa' ? capaRef : fundoRef
          return (
            <div key={alvo}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {alvo === 'capa' ? 'Capa' : 'Fundo da página'}
              </p>
              {url ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-24 w-full rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => remover(alvo)}
                    aria-label={`Remover ${alvo}`}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => ref.current?.click()}
                  disabled={enviando !== null}
                  className="flex h-24 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {enviando === alvo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  Enviar
                </button>
              )}
              <input
                ref={ref}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => enviar(alvo, e)}
              />
            </div>
          )
        })}
      </div>

      {atividade.fundoUrl && (
        <div>
          <label htmlFor="opacidade" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Intensidade do fundo — {Math.round(opacidade * 100)}%
          </label>
          <input
            id="opacidade"
            type="range"
            min={0}
            max={100}
            value={Math.round(opacidade * 100)}
            onChange={(e) => setOpacidade(Number(e.target.value) / 100)}
            onMouseUp={onSalvar}
            onTouchEnd={onSalvar}
            className="mt-1 w-full accent-primary"
          />
        </div>
      )}

      <div>
        <label htmlFor="video-abertura" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Vídeo de abertura
        </label>
        <input
          id="video-abertura"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          onBlur={onSalvar}
          placeholder="Link do YouTube ou Vimeo"
          className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Aparece no topo, antes do enunciado.
        </p>
      </div>
    </section>
  )
}
