'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import { ChevronLeft, ChevronRight, ClipboardList, HeartHandshake, Users } from 'lucide-react'
import {
  FALTAS_SEGUIDAS_ALERTA,
  rotuloAusencia,
  type FrequenciaDaRede,
  type IrmaoFrequencia,
} from '@/lib/frequencia-irmaos'

const POR_PAGINA = 8

interface Props extends FrequenciaDaRede {
  /** Some com a coluna da célula quando a lista já é de uma célula só. */
  ocultarCelula?: boolean
}

/**
 * Quem parou de ir para a célula.
 *
 * A supervisão já tinha o número por célula; o que faltava era o nome. Esta
 * lista existe para virar telefonema: cada linha diz quem, de qual célula, há
 * quantos encontros — e traz o líder a um toque de distância.
 *
 * Enquanto ninguém tiver feito chamada, a lista não inventa alerta. Diria "0%"
 * para a igreja inteira, o que não é sinal de nada além de a prática ainda não
 * ter começado.
 */
export function FrequenciaIrmaos({
  celulasComChamada,
  celulasOlhadas,
  irmaos,
  sumindo,
  frequenciaMedia,
  ocultarCelula,
}: Props) {
  const [aba, setAba] = useState<'sumindo' | 'todos'>('sumindo')
  const [pagina, setPagina] = useState(0)

  const lista = aba === 'sumindo' ? sumindo : irmaos
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const visiveis = useMemo(
    () => lista.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA),
    [lista, pagina],
  )

  function trocarAba(nova: 'sumindo' | 'todos') {
    setAba(nova)
    setPagina(0)
  }

  if (celulasComChamada === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Nenhuma chamada feita ainda</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
            Assim que os líderes marcarem quem esteve no encontro, esta lista mostra quem
            está deixando de ir — por nome, com quantos encontros seguidos de ausência.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Os números do topo */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <p className="text-2xl font-bold text-primary leading-none">{frequenciaMedia ?? 0}%</p>
            <p className="text-[11px] text-muted-foreground mt-1">frequência média</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-2xl font-bold leading-none">{irmaos.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">irmãos acompanhados</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-2xl font-bold leading-none">
              {celulasComChamada}
              <span className="text-sm text-muted-foreground font-medium">/{celulasOlhadas}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">células com chamada</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 border-b border-border">
          <BotaoAba
            ativo={aba === 'sumindo'}
            urgente={sumindo.length > 0}
            onClick={() => trocarAba('sumindo')}
            icone={<HeartHandshake className="h-3.5 w-3.5" />}
            rotulo="Sumindo"
            contador={sumindo.length}
          />
          <BotaoAba
            ativo={aba === 'todos'}
            onClick={() => trocarAba('todos')}
            icone={<Users className="h-3.5 w-3.5" />}
            rotulo="Todos"
            contador={irmaos.length}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          {aba === 'sumindo'
            ? `Quem não aparece há ${FALTAS_SEGUIDAS_ALERTA} encontros ou mais.`
            : 'Todo mundo da lista das células, do que menos vem para o que mais vem.'}
        </p>

        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ninguém com {FALTAS_SEGUIDAS_ALERTA} faltas seguidas. A casa está cheia.
          </p>
        ) : (
          <div>
            {visiveis.map((i) => (
              <LinhaIrmao key={i.chave} irmao={i} ocultarCelula={ocultarCelula} />
            ))}
          </div>
        )}

        {paginas > 1 && (
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              disabled={pagina === 0}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[11px] text-muted-foreground">
              {pagina + 1} de {paginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
              disabled={pagina >= paginas - 1}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BotaoAba({
  ativo,
  urgente,
  onClick,
  icone,
  rotulo,
  contador,
}: {
  ativo: boolean
  urgente?: boolean
  onClick: () => void
  icone: React.ReactNode
  rotulo: string
  contador: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
        ativo
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icone}
      {rotulo}
      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          urgente ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
        }`}
      >
        {contador}
      </span>
    </button>
  )
}

function LinhaIrmao({ irmao, ocultarCelula }: { irmao: IrmaoFrequencia; ocultarCelula?: boolean }) {
  const iniciais = irmao.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')
  const grave = irmao.faltasSeguidas >= FALTAS_SEGUIDAS_ALERTA

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
        {irmao.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            referrerPolicy="no-referrer"
            src={irmao.avatarUrl}
            alt={irmao.nome}
            className="h-full w-full object-cover"
          />
        ) : (
          iniciais
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {irmao.nome}
          {irmao.semConta && (
            <span className="ml-1.5 text-[10px] text-muted-foreground/70">sem conta</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {!ocultarCelula && (
            <Link href={`/celula/${irmao.celulaId}`} className="hover:underline">
              {irmao.celulaNome}
            </Link>
          )}
          {!ocultarCelula && ' · '}
          <span className={grave ? 'text-red-600' : undefined}>{rotuloAusencia(irmao)}</span>
        </p>
      </div>

      <div className="text-right shrink-0">
        <p
          className={`text-sm font-bold leading-none ${
            irmao.frequencia >= 75
              ? 'text-green-600'
              : irmao.frequencia >= 40
                ? 'text-amber-600'
                : 'text-red-600'
          }`}
        >
          {irmao.frequencia}%
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {irmao.presencas}/{irmao.encontros}
        </p>
      </div>

      {/* Quem a supervisão liga é o líder — é ele que vai atrás do irmão. */}
      {irmao.liderTelefone && (
        <a
          href={whatsappLink(irmao.liderTelefone, irmao.liderNome, irmao.nome)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
          aria-label={`Falar com ${irmao.liderNome ?? 'o líder'} sobre ${irmao.nome}`}
        >
          <WhatsAppIcon className="h-4 w-4" />
        </a>
      )}
    </div>
  )
}

function whatsappLink(telefone: string, liderNome: string | null, irmaoNome: string) {
  const num = telefone.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`
  const primeiroLider = liderNome?.split(' ')[0] ?? ''
  const primeiroIrmao = irmaoNome.split(' ')[0]
  const msg = encodeURIComponent(
    `Oi${primeiroLider ? ` ${primeiroLider}` : ''}! Tudo bem? Vi aqui que ${primeiroIrmao} está faltando na célula. Conseguiu falar com ${primeiroIrmao}?`,
  )
  return `https://wa.me/${full}?text=${msg}`
}
