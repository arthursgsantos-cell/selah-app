'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, LayoutGrid, Loader2, Move, Palette, RotateCcw, Scaling, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { atualizarSecoesHomeAction } from '@/app/actions/home-secoes'
import { fundoStyle, ajustarCor } from '@/lib/rede-fundo'
import {
  ALTURA_MIN, LAYOUT_PADRAO, SECAO_LABELS, SECAO_TEM_TEXTO, textoClaroSobre,
  type EstiloSecao, type LayoutSecao, type LayoutSecoes, type SecaoHomeId,
  type TextosSecoes,
} from '@/lib/home-secoes'

interface Props {
  ordem: SecaoHomeId[]
  layout: LayoutSecoes
  textos: TextosSecoes
  /** O cartão pronto de cada seção, renderizado no servidor. */
  conteudos: Partial<Record<SecaoHomeId, React.ReactNode>>
  podeEditar: boolean
}

const ESTILOS: { id: EstiloSecao; nome: string }[] = [
  { id: 'padrao', nome: 'Normal' },
  { id: 'cor', nome: 'Cor' },
  { id: 'gradiente', nome: 'Degradê' },
  { id: 'nebula', nome: 'Nébula' },
]

/** Paleta curta: escolher cor num seletor de milhões trava qualquer um. */
const CORES = [
  '#0F52BA', '#0B2447', '#047857', '#B45309', '#B91C1C',
  '#6D28D9', '#0E7490', '#DB2777', '#334155', '#111827',
]

/**
 * A faixa de cartões da home — e o editor dela.
 *
 * O painel antigo era um diálogo com setas de subir e descer: para saber se a
 * ordem tinha ficado boa, era preciso salvar, fechar e olhar a página. Aqui a
 * edição acontece sobre a home de verdade, com os cartões que a igreja vê.
 *
 * A grade tem duas colunas. Arrastar a alça da direita encolhe o cartão para
 * meia largura, e dois cartões pela metade em sequência ficam lado a lado —
 * que é o que se quer dizer com "combinar seções". Arrastar pela alça da
 * esquerda troca a posição.
 */
export function SecoesHome({ ordem: ordemInicial, layout: layoutInicial, textos: textosInicial, conteudos, podeEditar }: Props) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [ordem, setOrdem] = useState<SecaoHomeId[]>(ordemInicial)
  const [layout, setLayout] = useState<LayoutSecoes>(layoutInicial)
  const [textos, setTextos] = useState<TextosSecoes>(textosInicial)
  const [selecionada, setSelecionada] = useState<SecaoHomeId | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()
  const gradeRef = useRef<HTMLDivElement>(null)
  const arrastando = useRef<SecaoHomeId | null>(null)
  const redimensionando = useRef<SecaoHomeId | null>(null)

  const doLayout = (id: SecaoHomeId): LayoutSecao => layout[id] ?? LAYOUT_PADRAO

  function mudarLayout(id: SecaoHomeId, mudanca: Partial<LayoutSecao>) {
    setLayout((atual) => ({ ...atual, [id]: { ...(atual[id] ?? LAYOUT_PADRAO), ...mudanca } }))
  }

  function mudarTexto(id: SecaoHomeId, campo: 'titulo' | 'subtitulo', valor: string) {
    setTextos((atual) => ({ ...atual, [id]: { ...atual[id], [campo]: valor } }))
  }

  /** Qual cartão está sob o dedo/cursor agora. */
  function secaoSob(x: number, y: number): SecaoHomeId | null {
    const alvo = document.elementFromPoint(x, y)?.closest('[data-secao]')
    const id = alvo?.getAttribute('data-secao')
    return id && ordem.includes(id as SecaoHomeId) ? (id as SecaoHomeId) : null
  }

  function iniciarArraste(e: React.PointerEvent, id: SecaoHomeId) {
    e.preventDefault()
    arrastando.current = id
    setSelecionada(id)
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function moverPonteiro(e: React.PointerEvent) {
    const id = arrastando.current
    if (id) {
      const sobre = secaoSob(e.clientX, e.clientY)
      if (sobre && sobre !== id) {
        setOrdem((atual) => {
          const de = atual.indexOf(id)
          const para = atual.indexOf(sobre)
          if (de < 0 || para < 0) return atual
          const nova = [...atual]
          nova.splice(de, 1)
          nova.splice(para, 0, id)
          return nova
        })
      }
      return
    }

    const idR = redimensionando.current
    if (idR && gradeRef.current) {
      // Arrastar a ponta inferior direita muda os dois eixos de uma vez, como
      // um widget de celular — e cada eixo cai num passo da grade, para dois
      // cartões vizinhos nunca ficarem tortos um em relação ao outro.
      const caixa = gradeRef.current.getBoundingClientRect()
      const cartao = document
        .querySelector(`[data-secao="${idR}"]`)
        ?.getBoundingClientRect()

      const proporcao = (e.clientX - caixa.left) / caixa.width
      const alturaArrastada = cartao ? e.clientY - cartao.top : 0

      mudarLayout(idR, {
        largura: proporcao > 0.55 ? 2 : 1,
        altura: alturaArrastada > 340 ? 'alta' : alturaArrastada > 210 ? 'media' : 'auto',
      })
    }
  }

  function soltar() {
    arrastando.current = null
    redimensionando.current = null
  }

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await atualizarSecoesHomeAction({ ordem, textos, layout })
      if (!r.sucesso) { setErro(r.erro ?? 'Erro ao salvar'); return }
      setEditando(false)
      setSelecionada(null)
      router.refresh()
    })
  }

  function cancelar() {
    setOrdem(ordemInicial)
    setLayout(layoutInicial)
    setTextos(textosInicial)
    setSelecionada(null)
    setErro(null)
    setEditando(false)
  }

  const cartoes = ordem.map((id) => {
    const cfg = doLayout(id)
    const conteudo = conteudos[id]
    if (!conteudo && !editando) return null

    return (
      <div
        key={id}
        data-secao={id}
        className={`${cfg.largura === 1 ? 'col-span-1' : 'col-span-2'} ${
          // Espaço para as alças, que ficam acima da borda do cartão: dentro
          // dele elas tapariam justamente o título que a pessoa quer ver.
          editando ? 'relative mt-9' : ''
        }`}
      >
        {editando && (
          <>
            {/* Alças: mover à esquerda, tamanho à direita, nome no meio. */}
            <button
              type="button"
              onPointerDown={(e) => iniciarArraste(e, id)}
              onPointerMove={moverPonteiro}
              onPointerUp={soltar}
              aria-label={`Mover ${SECAO_LABELS[id]}`}
              className="absolute -top-9 left-0 z-20 flex h-8 w-8 touch-none items-center justify-center rounded-full border border-primary bg-background text-primary shadow-sm active:scale-95"
            >
              <Move className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelecionada(selecionada === id ? null : id)}
              className="absolute -top-8 left-1/2 z-20 max-w-[60%] -translate-x-1/2 truncate rounded-full border border-primary bg-background px-3 py-1 text-[11px] font-semibold text-primary shadow-sm"
            >
              {SECAO_LABELS[id]}
            </button>
          </>
        )}

        <MolduraSecao
          cfg={cfg}
          selecionada={editando && selecionada === id}
          editando={editando}
        >
          {conteudo ?? (
            <div className="rounded-2xl border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
              {SECAO_LABELS[id]} — sem conteúdo para mostrar agora
            </div>
          )}
        </MolduraSecao>

        {editando && (
          // Alça de escala na ponta inferior direita, como widget de celular:
          // arrasta para a esquerda e o cartão vira metade da linha; arrasta
          // para baixo e ele cresce, sempre caindo num passo da grade.
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              redimensionando.current = id
              setSelecionada(id)
              ;(e.target as Element).setPointerCapture(e.pointerId)
            }}
            onPointerMove={moverPonteiro}
            onPointerUp={soltar}
            aria-label={`Mudar o tamanho de ${SECAO_LABELS[id]}`}
            className="absolute -bottom-2 -right-2 z-20 flex h-8 w-8 cursor-nwse-resize touch-none items-center justify-center rounded-full border border-primary bg-background text-primary shadow-sm active:scale-95"
          >
            <Scaling className="h-4 w-4" />
          </button>
        )}

        {editando && selecionada === id && (
          <PainelSecao
            id={id}
            cfg={cfg}
            texto={textos[id] ?? {}}
            onLayout={(m) => mudarLayout(id, m)}
            onTexto={(campo, valor) => mudarTexto(id, campo, valor)}
          />
        )}
      </div>
    )
  })

  return (
    <div className="space-y-3">
      {podeEditar && (
        <div className="flex items-center justify-end gap-2">
          {editando ? (
            <>
              {erro && <span className="mr-auto text-xs text-destructive">{erro}</span>}
              <Button size="sm" onClick={salvar} disabled={salvando} className="gap-1.5">
                {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelar} disabled={salvando} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Seções
            </button>
          )}
        </div>
      )}

      {editando && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Arraste pela alça da <strong>esquerda</strong> para trocar de lugar e
          pela da <strong>direita</strong> para deixar o cartão pela metade —
          dois pela metade ficam lado a lado. Toque no nome do cartão para mudar
          cor e texto.
        </p>
      )}

      <div
        ref={gradeRef}
        onPointerMove={editando ? moverPonteiro : undefined}
        onPointerUp={editando ? soltar : undefined}
        className={`grid grid-cols-2 gap-3 ${
          editando
            ? 'rounded-2xl border border-dashed border-primary/40 p-3 [background-image:linear-gradient(to_right,rgba(120,120,120,.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,120,120,.12)_1px,transparent_1px)] [background-size:24px_24px]'
            : ''
        }`}
      >
        {cartoes}
      </div>
    </div>
  )
}

/** O fundo do cartão, quando a liderança escolheu um. */
function MolduraSecao({
  cfg, selecionada, editando, children,
}: {
  cfg: LayoutSecao
  selecionada: boolean
  editando: boolean
  children: React.ReactNode
}) {
  const contorno = selecionada
    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl'
    : ''
  // A altura escolhida é piso, não teto: conteúdo maior continua crescendo em
  // vez de ser cortado. O `flex` centra o cartão quando sobra espaço.
  const alturaMin = ALTURA_MIN[cfg.altura]
  const esticado = alturaMin ? 'flex flex-col justify-center [&>*]:w-full' : ''

  if (cfg.estilo === 'padrao') {
    return (
      <div
        style={alturaMin ? { minHeight: alturaMin } : undefined}
        className={`${contorno} ${esticado} ${editando ? 'pointer-events-none select-none' : ''}`}
      >
        {children}
      </div>
    )
  }

  const cor = cfg.cor ?? '#0F52BA'
  const cor2 = cfg.cor2 ?? ajustarCor(cor, -0.45)
  const claro = cfg.texto === 'auto' ? textoClaroSobre(cor) : cfg.texto === 'claro'

  return (
    <div
      style={{
        ...fundoStyle({
          cor,
          cor_secundaria: cor2,
          fundo_tipo: cfg.estilo === 'cor' ? 'cor' : cfg.estilo,
        }),
        ...(alturaMin ? { minHeight: alturaMin } : {}),
      }}
      // `secao-pintada` está em `app/globals.css`: é o que apaga o fundo
      // próprio dos cartões de dentro (o branco, e o degradê azul da Escola
      // Bíblica), que antes tapava a cor escolhida aqui.
      className={`secao-pintada ${claro ? 'secao-pintada-claro' : 'secao-pintada-escuro'} overflow-hidden rounded-2xl p-2 shadow-sm ${contorno} ${esticado} ${
        editando ? 'pointer-events-none select-none' : ''
      }`}
    >
      {children}
    </div>
  )
}

/** Painel de cor e texto da seção escolhida — inline, sem diálogo por cima. */
function PainelSecao({
  id, cfg, texto, onLayout, onTexto,
}: {
  id: SecaoHomeId
  cfg: LayoutSecao
  texto: { titulo?: string | null; subtitulo?: string | null }
  onLayout: (m: Partial<LayoutSecao>) => void
  onTexto: (campo: 'titulo' | 'subtitulo', valor: string) => void
}) {
  return (
    <div className="mt-2 space-y-3 rounded-2xl border border-primary/40 bg-card p-3">
      <div className="flex items-center gap-1.5">
        <Palette className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-semibold">{SECAO_LABELS[id]}</p>
        <button
          type="button"
          onClick={() => onLayout(LAYOUT_PADRAO)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Voltar ao normal
        </button>
      </div>

      {/* Tamanho — também dá para arrastar a ponta inferior direita, mas o
          botão é o caminho óbvio para quem não reparou na alça. */}
      <div className="flex gap-1.5">
        {[
          { v: 2 as const, nome: 'Linha inteira' },
          { v: 1 as const, nome: 'Metade' },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onLayout({ largura: o.v })}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
              cfg.largura === o.v
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent'
            }`}
          >
            {o.nome}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {[
          { v: 'auto' as const, nome: 'Altura normal' },
          { v: 'media' as const, nome: 'Mais alto' },
          { v: 'alta' as const, nome: 'Bem alto' },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onLayout({ altura: o.v })}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
              cfg.altura === o.v
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent'
            }`}
          >
            {o.nome}
          </button>
        ))}
      </div>

      {/* Estilo do fundo */}
      <div className="flex flex-wrap gap-1.5">
        {ESTILOS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onLayout({ estilo: e.id, cor: cfg.cor ?? CORES[0] })}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              cfg.estilo === e.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent'
            }`}
          >
            {e.nome}
          </button>
        ))}
      </div>

      {cfg.estilo !== 'padrao' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onLayout({ cor: c })}
                aria-label={`Cor ${c}`}
                style={{ backgroundColor: c }}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  cfg.cor === c ? 'border-foreground scale-110' : 'border-transparent'
                }`}
              />
            ))}
            <label className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-[10px]">
              <input
                type="color"
                value={cfg.cor ?? '#0F52BA'}
                onChange={(e) => onLayout({ cor: e.target.value })}
                className="h-0 w-0 opacity-0"
              />
              +
            </label>
          </div>

          {(cfg.estilo === 'gradiente' || cfg.estilo === 'nebula') && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Segunda cor
              <input
                type="color"
                value={cfg.cor2 ?? ajustarCor(cfg.cor ?? '#0F52BA', -0.45)}
                onChange={(e) => onLayout({ cor2: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
          )}

          <div className="flex gap-1.5">
            {[
              { v: 'auto' as const, nome: 'Texto automático' },
              { v: 'claro' as const, nome: 'Claro' },
              { v: 'escuro' as const, nome: 'Escuro' },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => onLayout({ texto: o.v })}
                className={`rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                  cfg.texto === o.v
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {o.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {SECAO_TEM_TEXTO[id] && (
        <div className="space-y-1.5 border-t border-border/60 pt-2.5">
          <Input
            value={texto.titulo ?? ''}
            onChange={(e) => onTexto('titulo', e.target.value)}
            placeholder="Título (opcional)"
            className="h-8 text-sm"
          />
          <Input
            value={texto.subtitulo ?? ''}
            onChange={(e) => onTexto('subtitulo', e.target.value)}
            placeholder="Subtítulo (opcional)"
            className="h-8 text-sm"
          />
          {/* O cartão acima é montado no servidor com o texto que está salvo,
              então ele só muda depois do "Salvar" — sem este aviso, quem
              digita acha que não funcionou. */}
          {(texto.titulo?.trim() || texto.subtitulo?.trim()) && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O cartão passa a mostrar{' '}
              {texto.titulo?.trim() && <strong className="text-foreground">“{texto.titulo.trim()}”</strong>}
              {texto.titulo?.trim() && texto.subtitulo?.trim() && ' e '}
              {texto.subtitulo?.trim() && <strong className="text-foreground">“{texto.subtitulo.trim()}”</strong>}
              {' '}assim que você salvar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
