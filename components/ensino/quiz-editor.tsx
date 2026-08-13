'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronDown, ChevronUp, ImagePlus, Loader2, Plus, Trash2, X, FileQuestion,
} from 'lucide-react'
import { comprimirImagem } from '@/lib/comprimir-imagem'
import { letraOpcao, novaOpcaoId, TIPO_PERGUNTA } from '@/lib/ensino/atividades'
import {
  enviarImagemAtividadeAction, excluirPerguntaAction, reordenarPerguntasAction,
  salvarPerguntaAction,
} from '@/app/actions/ensino/atividades'
import type { PerguntaCompleta } from '@/lib/ensino/atividades-consultas'
import type { OpcaoPergunta, TipoPergunta } from '@/lib/supabase/types'

const TIPOS: TipoPergunta[] = ['unica', 'multipla', 'texto', 'longo']

function perguntaVazia(): PerguntaCompleta {
  return {
    id: '',
    secaoId: null,
    ordem: 0,
    enunciado: '',
    tipo: 'unica',
    opcoes: [
      { id: novaOpcaoId(), texto: '', correta: true },
      { id: novaOpcaoId(), texto: '', correta: false },
    ],
    respostaEsperada: null,
    pontos: 1,
    obrigatoria: true,
    midiaUrl: null,
    midiaTipo: null,
  }
}

/**
 * O construtor de perguntas.
 *
 * Uma pergunta por vez em edição: abrir todas de uma vez num formulário só
 * transformaria a prova de dez questões numa página de rolagem infinita, e
 * cada salvamento teria de reconciliar dez estados. Aqui cada uma salva
 * sozinha, e a lista fechada é a visão de conjunto.
 */
export function QuizEditor({
  atividadeId, perguntas,
}: {
  atividadeId: string
  perguntas: PerguntaCompleta[]
}) {
  const router = useRouter()
  const [editando, setEditando] = useState<PerguntaCompleta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const total = perguntas.reduce((s, p) => s + p.pontos, 0)

  function salvar(pergunta: PerguntaCompleta) {
    setErro(null)
    iniciar(async () => {
      const r = await salvarPerguntaAction(atividadeId, {
        id: pergunta.id || undefined,
        secaoId: pergunta.secaoId,
        enunciado: pergunta.enunciado,
        tipo: pergunta.tipo,
        opcoes: pergunta.opcoes,
        respostaEsperada: pergunta.respostaEsperada,
        pontos: pergunta.pontos,
        obrigatoria: pergunta.obrigatoria,
        midiaUrl: pergunta.midiaUrl,
        midiaTipo: pergunta.midiaTipo,
      })
      if (!r.ok) { setErro(r.erro); return }
      setEditando(null)
      router.refresh()
    })
  }

  function excluir(id: string) {
    if (!confirm('Excluir esta pergunta? As respostas já dadas saem junto.')) return
    iniciar(async () => {
      const r = await excluirPerguntaAction(atividadeId, id)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao
    if (destino < 0 || destino >= perguntas.length) return
    const ordenadas = [...perguntas]
    const [movida] = ordenadas.splice(indice, 1)
    ordenadas.splice(destino, 0, movida)
    iniciar(async () => {
      const r = await reordenarPerguntasAction(atividadeId, ordenadas.map((p) => p.id))
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileQuestion className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Perguntas</h2>
          {perguntas.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {perguntas.length} · {total} {total === 1 ? 'ponto' : 'pontos'}
            </span>
          )}
        </div>
        {!editando && (
          <button
            type="button"
            onClick={() => setEditando(perguntaVazia())}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Pergunta
          </button>
        )}
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {editando && (
        <FormularioPergunta
          atividadeId={atividadeId}
          pergunta={editando}
          onChange={setEditando}
          onSalvar={() => salvar(editando)}
          onCancelar={() => { setEditando(null); setErro(null) }}
          pendente={pendente}
        />
      )}

      {perguntas.length === 0 && !editando ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
          Nenhuma pergunta ainda.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {perguntas.map((p, i) => (
            <li
              key={p.id}
              className="flex items-start gap-2 rounded-xl border border-border px-2.5 py-2"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{p.enunciado}</p>
                <p className="text-[11px] text-muted-foreground">
                  {TIPO_PERGUNTA[p.tipo].label} · {p.pontos} {p.pontos === 1 ? 'ponto' : 'pontos'}
                  {!p.obrigatoria && ' · opcional'}
                  {p.midiaUrl && ' · com mídia'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0 || pendente}
                  aria-label="Subir"
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === perguntas.length - 1 || pendente}
                  aria-label="Descer"
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(p)}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium transition-colors hover:bg-accent"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => excluir(p.id)}
                  disabled={pendente}
                  aria-label="Excluir pergunta"
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FormularioPergunta({
  atividadeId, pergunta, onChange, onSalvar, onCancelar, pendente,
}: {
  atividadeId: string
  pergunta: PerguntaCompleta
  onChange: (p: PerguntaCompleta) => void
  onSalvar: () => void
  onCancelar: () => void
  pendente: boolean
}) {
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const automatica = TIPO_PERGUNTA[pergunta.tipo].automatica

  function trocarTipo(tipo: TipoPergunta) {
    const vaiSerAutomatica = TIPO_PERGUNTA[tipo].automatica
    onChange({
      ...pergunta,
      tipo,
      // Sair de escolha única para múltipla mantém as alternativas; entrar numa
      // de escrever esvazia, porque alternativa ali não significa nada.
      opcoes: vaiSerAutomatica
        ? pergunta.opcoes.length > 0
          ? pergunta.opcoes
          : [
              { id: novaOpcaoId(), texto: '', correta: true },
              { id: novaOpcaoId(), texto: '', correta: false },
            ]
        : [],
    })
  }

  function marcarCorreta(id: string) {
    onChange({
      ...pergunta,
      opcoes: pergunta.opcoes.map((o) => ({
        ...o,
        // Na escolha única, marcar uma desmarca as outras.
        correta: pergunta.tipo === 'unica' ? o.id === id : o.id === id ? !o.correta : o.correta,
      })),
    })
  }

  async function enviarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return

    setEnviandoImagem(true)
    const fd = new FormData()
    fd.append('file', await comprimirImagem(arquivo))
    fd.append('alvo', 'pergunta')
    const r = await enviarImagemAtividadeAction(atividadeId, fd)
    setEnviandoImagem(false)
    if (r.ok && r.url) onChange({ ...pergunta, midiaUrl: r.url, midiaTipo: 'imagem' })
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <textarea
        value={pergunta.enunciado}
        onChange={(e) => onChange({ ...pergunta, enunciado: e.target.value })}
        rows={2}
        placeholder="Escreva a pergunta..."
        aria-label="Enunciado"
        className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
      />

      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => trocarTipo(t)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              pergunta.tipo === t
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-accent'
            }`}
          >
            {TIPO_PERGUNTA[t].label}
          </button>
        ))}
      </div>

      {automatica && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Toque na letra para marcar a alternativa correta.
          </p>
          {pergunta.opcoes.map((opcao, i) => (
            <div key={opcao.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => marcarCorreta(opcao.id)}
                aria-label={`Marcar alternativa ${letraOpcao(i)} como correta`}
                aria-pressed={opcao.correta}
                className={`flex h-8 w-8 shrink-0 items-center justify-center border-2 text-[11px] font-bold transition-colors ${
                  pergunta.tipo === 'unica' ? 'rounded-full' : 'rounded-md'
                } ${
                  opcao.correta
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-muted-foreground/30 bg-background text-muted-foreground'
                }`}
              >
                {opcao.correta ? <Check className="h-4 w-4" /> : letraOpcao(i)}
              </button>
              <input
                value={opcao.texto}
                onChange={(e) =>
                  onChange({
                    ...pergunta,
                    opcoes: pergunta.opcoes.map((o) =>
                      o.id === opcao.id ? { ...o, texto: e.target.value } : o
                    ),
                  })
                }
                placeholder={`Alternativa ${letraOpcao(i)}`}
                aria-label={`Texto da alternativa ${letraOpcao(i)}`}
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({ ...pergunta, opcoes: pergunta.opcoes.filter((o) => o.id !== opcao.id) })
                }
                disabled={pergunta.opcoes.length <= 2}
                aria-label={`Remover alternativa ${letraOpcao(i)}`}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...pergunta,
                opcoes: [...pergunta.opcoes, { id: novaOpcaoId(), texto: '', correta: false }],
              })
            }
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            <Plus className="h-3 w-3" />
            Alternativa
          </button>
        </div>
      )}

      {!automatica && (
        <div>
          <label
            htmlFor="gabarito"
            className="text-[11px] font-medium text-muted-foreground"
          >
            O que você espera ler (só você vê)
          </label>
          <textarea
            id="gabarito"
            value={pergunta.respostaEsperada ?? ''}
            onChange={(e) => onChange({ ...pergunta, respostaEsperada: e.target.value })}
            rows={2}
            placeholder="Anotação para a hora de corrigir..."
            className="mt-1 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
        </div>
      )}

      {/* Mídia da pergunta */}
      <div className="space-y-2">
        {pergunta.midiaUrl && pergunta.midiaTipo === 'imagem' && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pergunta.midiaUrl} alt="" className="max-h-40 w-full rounded-xl object-contain" />
            <button
              type="button"
              onClick={() => onChange({ ...pergunta, midiaUrl: null, midiaTipo: null })}
              aria-label="Remover imagem"
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => arquivoRef.current?.click()}
            disabled={enviandoImagem}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            {enviandoImagem ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ImagePlus className="h-3 w-3" />
            )}
            Imagem
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={enviarImagem}
          />
          <input
            value={pergunta.midiaTipo === 'video' ? pergunta.midiaUrl ?? '' : ''}
            onChange={(e) =>
              onChange({
                ...pergunta,
                midiaUrl: e.target.value || null,
                midiaTipo: e.target.value ? 'video' : null,
              })
            }
            placeholder="ou cole o link de um vídeo"
            aria-label="Link do vídeo da pergunta"
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus-visible:border-ring"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          Pontos
          <input
            type="number"
            min={0}
            step={0.5}
            value={pergunta.pontos}
            onChange={(e) => onChange({ ...pergunta, pontos: Number(e.target.value) || 0 })}
            className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={pergunta.obrigatoria}
            onChange={(e) => onChange({ ...pergunta, obrigatoria: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-input accent-primary"
          />
          Obrigatória
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSalvar}
          disabled={pendente}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar pergunta
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
