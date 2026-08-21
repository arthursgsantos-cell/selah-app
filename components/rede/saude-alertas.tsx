'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, GitBranch, UserCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CelulaSaude } from '@/lib/saude-rede'

interface Props {
  celulas: CelulaSaude[]
  inatingiveis: CelulaSaude[]
  semSupervisao: CelulaSaude[]
  multiplicandoEmBreve: CelulaSaude[]
  /** Quantas células a rede tem ao todo — dá escala ao número de alertas. */
  totalCelulas: number
}

/**
 * Linhas por página.
 *
 * Numa igreja que começou a registrar agora, "sem registro" pega quase todas
 * as células — e quarenta e cinco linhas seguidas não dizem por onde começar.
 * A lista mostra um punhado por vez, na ordem do mais silencioso para o menos.
 */
const POR_PAGINA = 8

type ChaveAba = 'registro' | 'supervisao' | 'multiplicacao'

function whatsappLink(telefone: string, nome: string | null) {
  const num = telefone.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`
  const primeiro = nome?.split(' ')[0] ?? ''
  const msg = encodeURIComponent(
    `Oi${primeiro ? ` ${primeiro}` : ''}! Tudo bem? Passando para saber como está a célula.`
  )
  return `https://wa.me/${full}?text=${msg}`
}

/** "3 semanas sem registro", "nunca registrou encontro". */
function silencio(c: CelulaSaude): string {
  if (c.semanasSemRegistro === null) return 'nunca registrou encontro'
  if (c.semanasSemRegistro === 0) return 'registrou esta semana'
  return `${c.semanasSemRegistro} ${c.semanasSemRegistro === 1 ? 'semana' : 'semanas'} sem registro`
}

function LinhaCelula({
  celula,
  detalhe,
  urgente,
}: {
  celula: CelulaSaude
  detalhe: string
  urgente?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: urgente ? '#ef4444' : celula.redeCor }}
      />
      <Link href={`/celula/${celula.id}`} className="flex-1 min-w-0 group">
        <p className="text-sm font-medium truncate group-hover:underline">{celula.nome}</p>
        <p className="text-xs text-muted-foreground truncate">
          {celula.liderNome ? `${celula.liderNome} · ` : ''}
          {detalhe}
        </p>
      </Link>
      {celula.liderTelefone && (
        <a
          href={whatsappLink(celula.liderTelefone, celula.liderNome)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
          aria-label={`Falar com ${celula.liderNome ?? 'o líder'} no WhatsApp`}
        >
          <WhatsAppIcon className="h-4 w-4" />
        </a>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  )
}

/**
 * Onde o supervisor olha primeiro.
 *
 * As três listas respondem perguntas diferentes e por isso são abas, e não uma
 * lista só: quem parou de dar sinal, quem está há tempo demais sem ser
 * visitado, e quem tem multiplicação chegando. Uma célula pode aparecer em
 * mais de uma.
 */
export function SaudeAlertas({
  celulas,
  inatingiveis,
  semSupervisao,
  multiplicandoEmBreve,
  totalCelulas,
}: Props) {
  const hoje = new Date().toISOString().slice(0, 10)

  const abas = useMemo(
    () => [
      {
        chave: 'multiplicacao' as const,
        rotulo: 'Multiplicação',
        icone: <GitBranch className="h-4 w-4 text-red-500" />,
        celulas: multiplicandoEmBreve,
        urgente: false,
        ajuda: 'Células com multiplicação prevista nos próximos 90 dias ou já vencida.',
        vazio: 'Nenhuma multiplicação prevista para os próximos 90 dias.',
        detalhe: (c: CelulaSaude) => c.multiplicacaoPrevista ? `prevista para ${format(new Date(`${c.multiplicacaoPrevista}T12:00:00`), "d 'de' MMMM", { locale: ptBR })}` : 'sem data definida',
      },
      {
        chave: 'supervisao' as const,
        rotulo: 'Supervisão atrasada',
        icone: <UserCheck className="h-4 w-4 text-amber-500" />,
        celulas: semSupervisao,
        urgente: false,
        ajuda: 'Sem reunião de supervisão registrada há 60 dias ou mais.',
        vazio: 'Nenhuma célula esperando supervisão.',
        detalhe: (c: CelulaSaude) =>
          c.diasSemSupervisao === null
            ? 'nenhuma reunião registrada'
            : `há ${c.diasSemSupervisao} dias`,
      },
      {
        chave: 'registro' as const,
        rotulo: 'Registro atrasado',
        icone: <AlertTriangle className="h-4 w-4 text-red-500" />,
        celulas: inatingiveis,
        urgente: true,
        ajuda: `Sem encontro registrado há ${3} semanas ou mais — ou nunca registraram.`,
        vazio: `As ${totalCelulas} células têm registro recente.`,
        detalhe: silencio,
      },
    ],
    [inatingiveis, semSupervisao, multiplicandoEmBreve, totalCelulas, hoje]
  )

  // Abre na primeira aba que tem o que mostrar: cair numa aba vazia esconderia
  // justamente o que precisa de atenção.
  const primeiraComItem = abas.find((a) => a.celulas.length > 0)?.chave ?? 'registro'
  const [ativa, setAtiva] = useState<ChaveAba>(primeiraComItem)
  const [pagina, setPagina] = useState(0)

  const aba = abas.find((a) => a.chave === ativa) ?? abas[0]
  const totalPaginas = Math.max(1, Math.ceil(aba.celulas.length / POR_PAGINA))
  // A página pode ficar fora do intervalo quando os dados mudam sob os pés
  // (revalidação depois de registrar uma supervisão, por exemplo).
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = aba.celulas.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)

  function trocarAba(chave: ChaveAba) {
    setAtiva(chave)
    setPagina(0)
  }

  if (abas.every((a) => a.celulas.length === 0)) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500/60 mx-auto mb-2" />
          <p className="text-sm font-medium">Rede em dia</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nada pedindo atenção entre as {totalCelulas} células
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="px-0 py-0">
        {/* Abas. Rolam na horizontal no celular em vez de quebrar linha. */}
        <div
          role="tablist"
          className="flex gap-1 overflow-x-auto border-b border-border px-2 pt-2"
        >
          {abas.map((a) => (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={a.chave === ativa}
              onClick={() => trocarAba(a.chave)}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm transition-colors ${
                a.chave === ativa
                  ? 'border-b-2 border-primary font-semibold text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {a.rotulo}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  a.celulas.length === 0
                    ? 'bg-muted text-muted-foreground'
                    : a.urgente
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {a.celulas.length}
              </span>
            </button>
          ))}
        </div>

        <div className="px-4 py-3">
          {aba.celulas.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="h-7 w-7 text-green-500/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{aba.vazio}</p>
            </div>
          ) : (
            <>
              <p className="mb-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-0.5 shrink-0">{aba.icone}</span>
                <span>
                  {aba.ajuda}
                  {aba.chave === 'registro' && (
                    <> <strong>{aba.celulas.length} de {totalCelulas}</strong> células.</>
                  )}
                </span>
              </p>

              {aba.chave === 'multiplicacao' && (
                <div className="mb-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                  <p className="mb-2 text-xs font-semibold">Árvore de multiplicação</p>
                  <div className="space-y-1">
                    {celulas.filter((c) => c.celulaMaeId || c.multiplicacaoPrevista).map((c) => {
                      const mae = celulas.find((m) => m.id === c.celulaMaeId)
                      return <div key={`arvore-${c.id}`} className="flex items-center gap-1 text-xs"><span className="text-muted-foreground">{mae ? `${mae.nome} →` : 'Origem →'}</span><Link href={`/celula/${c.id}`} className="font-medium text-primary hover:underline">{c.nome}</Link></div>
                    })}
                  </div>
                </div>
              )}

              {visiveis.map((c) => (
                <LinhaCelula
                  key={c.id}
                  celula={c}
                  detalhe={aba.detalhe(c)}
                  urgente={aba.urgente}
                />
              ))}

              {totalPaginas > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <p className="text-xs text-muted-foreground">
                    {paginaAtual * POR_PAGINA + 1}–
                    {Math.min((paginaAtual + 1) * POR_PAGINA, aba.celulas.length)} de{' '}
                    {aba.celulas.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPagina(paginaAtual - 1)}
                      disabled={paginaAtual === 0}
                      aria-label="Página anterior"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {paginaAtual + 1}/{totalPaginas}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPagina(paginaAtual + 1)}
                      disabled={paginaAtual >= totalPaginas - 1}
                      aria-label="Próxima página"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

