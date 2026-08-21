'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronDown, ChevronRight, GitBranch, Loader2, Sparkles, UserCheck,
} from 'lucide-react'
import {
  montarArvores, situacaoMultiplicacao, formatarData, juntarNomes,
  type ArvoreDaRede, type CelulaLinhagem, type NoArvore,
} from '@/lib/multiplicacao'
import { batizarCelulaAction } from '@/app/actions/multiplicacao'
import {
  RegistrarMultiplicacao, type CelulaParaMultiplicar,
} from '@/components/rede/registrar-multiplicacao'

interface Props {
  celulas: CelulaLinhagem[]
  /** Quem supervisiona cada rede, por id da rede. */
  supervisoresPorRede?: Record<string, string[]>
}

/** Primeira letra do nome — o que sobra quando a célula não tem logo. */
function inicial(nome: string): string {
  return nome.trim().charAt(0).toUpperCase() || '•'
}

/** Escurece um hex para o degradê do avatar. */
function escurecer(hex: string, fator: number): string {
  const limpo = hex.replace('#', '')
  if (limpo.length !== 6) return hex
  const n = parseInt(limpo, 16)
  const r = Math.round(((n >> 16) & 255) * fator)
  const g = Math.round(((n >> 8) & 255) * fator)
  const b = Math.round((n & 255) * fator)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * O rosto da célula na árvore: a logo dela quando existe, a inicial sobre a
 * própria cor quando não.
 */
function Marca({ celula, tamanho }: { celula: CelulaLinhagem; tamanho: 'g' | 'p' }) {
  const cor = celula.cor?.trim() || celula.redeCor || '#0F52BA'
  const classe = tamanho === 'g' ? 'h-10 w-10 rounded-2xl' : 'h-8 w-8 rounded-xl'

  if (celula.logoUrl) {
    return (
      <span
        className={`${classe} flex shrink-0 items-center justify-center overflow-hidden bg-white p-1 shadow-sm ring-1 ring-black/5`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={celula.logoUrl} alt="" aria-hidden className="h-full w-full object-contain" />
      </span>
    )
  }

  return (
    <span
      className={`${classe} flex shrink-0 items-center justify-center font-bold text-white shadow-sm ring-1 ring-black/5 ${
        tamanho === 'g' ? 'text-sm' : 'text-xs'
      }`}
      style={{ backgroundImage: `linear-gradient(135deg, ${cor} 0%, ${escurecer(cor, 0.62)} 100%)` }}
    >
      {inicial(celula.nome)}
    </span>
  )
}

/** A tarja da data-alvo, com a cor do que ela está dizendo. */
function SeloPrevisao({ celula }: { celula: CelulaLinhagem }) {
  const s = situacaoMultiplicacao(celula.multiplicacaoPrevista)
  if (s.estado === 'sem-data') return null

  const cores =
    s.estado === 'vencida'
      ? 'bg-red-50 text-red-700 ring-red-200'
      : s.estado === 'proxima'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-primary/5 text-primary ring-primary/15'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cores}`}>
      <GitBranch className="h-3 w-3" />
      {s.rotulo}
    </span>
  )
}

/** Dá nome à célula que nasceu sem um, sem sair da árvore. */
function Batizar({ celula }: { celula: CelulaLinhagem }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await batizarCelulaAction(celula.id, nome)
      if (!r.ok) { setErro(r.erro ?? 'Não deu para salvar.'); return }
      setAberto(false)
      setNome('')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200 transition-colors hover:bg-violet-100"
      >
        <Sparkles className="h-3 w-3" />
        dar nome
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nome da célula</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ela entrou como <strong>{celula.nome}</strong> quando a multiplicação foi
              registrada. Agora é só batizar.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor={`batizar-${celula.id}`}>Nome</Label>
              <Input
                id={`batizar-${celula.id}`}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Cais"
                autoFocus
              />
            </div>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={salvar} disabled={salvando || nome.trim().length < 2}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** A linha da célula: marca, nome, o que dizer dela e os atalhos. */
function LinhaNo({
  no,
  celulasDaRede,
}: {
  no: NoArvore<CelulaLinhagem>
  celulasDaRede: CelulaParaMultiplicar[]
}) {
  const { celula, filhas } = no
  const raiz = no.geracao === 1

  const detalhe = [
    juntarNomes(celula.lideresNomes ?? []) ?? celula.liderNome,
    celula.multiplicadaEm ? `nasceu em ${formatarData(celula.multiplicadaEm)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/40">
      <Marca celula={celula} tamanho={raiz ? 'g' : 'p'} />

      <Link href={`/celula/${celula.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span
            title={celula.nome}
            className={`truncate ${raiz ? 'text-sm font-semibold' : 'text-sm font-medium'} ${
              celula.nomeProvisorio ? 'italic text-muted-foreground' : ''
            } group-hover:underline`}
          >
            {/* A filha recém-nascida já aparece debaixo da mãe na árvore — o
                nome provisório inteiro só repetiria isso ocupando a linha. */}
            {celula.nomeProvisorio ? 'sem nome ainda' : celula.nome}
          </span>
          {filhas.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {filhas.length === 1 ? '1 filha' : `${filhas.length} filhas`}
            </span>
          )}
        </div>
        {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <SeloPrevisao celula={celula} />
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        {celula.nomeProvisorio && <Batizar celula={celula} />}
        <RegistrarMultiplicacao
          celulas={celulasDaRede}
          celulaInicialId={celula.id}
          modo="icone"
        />
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      </div>
    </div>
  )
}

/**
 * Um galho e tudo que desce dele.
 *
 * `guias` diz, para cada nível acima deste, se aquele ramo ainda continua —
 * é o que decide onde a linha vertical segue e onde ela morre no cotovelo.
 */
function Galho({
  no,
  guias,
  ultimo,
  celulasDaRede,
}: {
  no: NoArvore<CelulaLinhagem>
  guias: boolean[]
  ultimo: boolean
  celulasDaRede: CelulaParaMultiplicar[]
}) {
  return (
    <div>
      <div className="flex items-stretch">
        {guias.map((continua, i) => (
          <span key={i} className="relative w-5 shrink-0">
            {continua && <span className="absolute left-2 top-0 h-full w-px bg-border" />}
          </span>
        ))}

        {no.geracao > 1 && (
          <span className="relative w-5 shrink-0">
            {/* O cotovelo: desce do pai e vira para a filha. */}
            <span className="absolute left-2 top-0 h-5 w-3 rounded-bl-lg border-b border-l border-border" />
            {!ultimo && <span className="absolute left-2 top-5 h-full w-px bg-border" />}
          </span>
        )}

        <LinhaNo no={no} celulasDaRede={celulasDaRede} />
      </div>

      {no.filhas.map((filha, i) => (
        <Galho
          key={filha.celula.id}
          no={filha}
          guias={no.geracao > 1 ? [...guias, !ultimo] : guias}
          ultimo={i === no.filhas.length - 1}
          celulasDaRede={celulasDaRede}
        />
      ))}
    </div>
  )
}

/** As células de uma rede que ainda não têm história de multiplicação. */
function Soltas({
  celulas,
  celulasDaRede,
}: {
  celulas: CelulaLinhagem[]
  celulasDaRede: CelulaParaMultiplicar[]
}) {
  const [aberto, setAberto] = useState(false)
  if (celulas.length === 0) return null

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
      >
        {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {celulas.length === 1
          ? '1 célula ainda sem multiplicação registrada'
          : `${celulas.length} células ainda sem multiplicação registrada`}
      </button>

      {aberto && (
        <div className="mt-1 space-y-0.5 pl-2">
          {celulas.map((c) => (
            <div key={c.id} className="flex items-stretch">
              <LinhaNo
                no={{ celula: c, geracao: 1, filhas: [], descendentes: 0 }}
                celulasDaRede={celulasDaRede}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BlocoRede({
  arvore,
  celulasDaRede,
  supervisores,
}: {
  arvore: ArvoreDaRede<CelulaLinhagem>
  celulasDaRede: CelulaParaMultiplicar[]
  supervisores: string[]
}) {
  const total = arvore.soltas.length + arvore.raizes.reduce((s, r) => s + 1 + r.descendentes, 0)

  return (
    <Card className="overflow-hidden">
      {/* Faixa da rede: a cor dela é o que separa uma árvore da outra. */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5"
        style={{
          backgroundImage: `linear-gradient(90deg, ${arvore.redeCor}1f 0%, transparent 90%)`,
        }}
      >
        <span className="h-6 w-1 rounded-full" style={{ backgroundColor: arvore.redeCor }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{arvore.redeNome || 'Sem rede'}</p>
          <p className="text-[11px] text-muted-foreground">
            {total} {total === 1 ? 'célula' : 'células'}
            {arvore.geracoes > 1 && ` · ${arvore.geracoes} gerações`}
            {arvore.raizes.length > 0 &&
              ` · ${arvore.raizes.length} ${arvore.raizes.length === 1 ? 'linhagem' : 'linhagens'}`}
          </p>
          {supervisores.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <UserCheck className="h-3 w-3 shrink-0" />
              <span className="truncate">
                Supervisão: {juntarNomes(supervisores)}
              </span>
            </p>
          )}
        </div>
      </div>

      <CardContent className="px-3 py-2">
        {arvore.raizes.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Nenhuma multiplicação registrada nesta rede ainda.
          </p>
        ) : (
          <div className="space-y-1">
            {arvore.raizes.map((raiz) => (
              <Galho
                key={raiz.celula.id}
                no={raiz}
                guias={[]}
                ultimo
                celulasDaRede={celulasDaRede}
              />
            ))}
          </div>
        )}

        <Soltas celulas={arvore.soltas} celulasDaRede={celulasDaRede} />
      </CardContent>
    </Card>
  )
}

/**
 * A árvore de multiplicação da rede.
 *
 * Genealogia, e não uma lista de pares: se a Porto gerou a Leme e a Leme gerou
 * a Cais, as três aparecem numa linha só, encadeadas — é assim que a liderança
 * conta essa história. Cada rede tem a própria árvore, porque multiplicação é
 * assunto de rede.
 */
export function ArvoreMultiplicacao({ celulas, supervisoresPorRede = {} }: Props) {
  const arvores = useMemo(() => montarArvores(celulas), [celulas])

  const paraDialogo = useMemo(
    () =>
      celulas.map((c) => ({
        id: c.id, nome: c.nome, redeId: c.redeId, redeNome: c.redeNome,
        celulaMaeId: c.celulaMaeId,
      })),
    [celulas],
  )

  if (celulas.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <GitBranch className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma célula para desenhar ainda.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {arvores.map((a) => (
        <BlocoRede
          key={a.redeId}
          arvore={a}
          celulasDaRede={paraDialogo}
          supervisores={supervisoresPorRede[a.redeId] ?? []}
        />
      ))}
    </div>
  )
}
