import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import { AlertTriangle, CheckCircle2, ChevronRight, GitBranch, UserCheck } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CelulaSaude } from '@/lib/saude-rede'

interface Props {
  inatingiveis: CelulaSaude[]
  semSupervisao: CelulaSaude[]
  multiplicandoEmBreve: CelulaSaude[]
  /** Quantas células a rede tem ao todo — dá escala ao número de alertas. */
  totalCelulas: number
}

function whatsappLink(telefone: string, nome: string | null) {
  const num = telefone.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`
  const primeiro = nome?.split(' ')[0] ?? ''
  const msg = encodeURIComponent(
    `Oi${primeiro ? ` ${primeiro}` : ''}! Tudo bem? Passando para saber como está a célula.`
  )
  return `https://wa.me/${full}?text=${msg}`
}

/** "3 semanas sem registro", "nunca registrou". */
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
      <div
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

function Bloco({
  titulo,
  icone,
  children,
}: {
  titulo: React.ReactNode
  icone: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          {icone}
          <p className="text-sm font-semibold">{titulo}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

/**
 * Onde o supervisor olha primeiro.
 *
 * As três listas respondem perguntas diferentes e por isso não viram uma só:
 * quem parou de dar sinal, quem está há tempo demais sem ser visitado, e quem
 * tem multiplicação chegando. Uma célula pode aparecer em mais de uma.
 */
export function SaudeAlertas({
  inatingiveis,
  semSupervisao,
  multiplicandoEmBreve,
  totalCelulas,
}: Props) {
  const tudoEmDia =
    inatingiveis.length === 0 && semSupervisao.length === 0 && multiplicandoEmBreve.length === 0

  if (tudoEmDia) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500/60 mx-auto mb-2" />
          <p className="text-sm font-medium">Rede em dia</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Todas as {totalCelulas} células registraram encontro recente
          </p>
        </CardContent>
      </Card>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-3">
      {inatingiveis.length > 0 && (
        <Bloco
          icone={<AlertTriangle className="h-4 w-4 text-red-500" />}
          titulo={
            <>
              Sem registro de encontro
              <span className="ml-2 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {inatingiveis.length} de {totalCelulas}
              </span>
            </>
          }
        >
          <p className="text-xs text-muted-foreground mb-1">
            Não quer dizer que a célula parou — quer dizer que ninguém sabe.
          </p>
          {inatingiveis.map((c) => (
            <LinhaCelula key={c.id} celula={c} detalhe={silencio(c)} urgente />
          ))}
        </Bloco>
      )}

      {semSupervisao.length > 0 && (
        <Bloco
          icone={<UserCheck className="h-4 w-4 text-amber-500" />}
          titulo={
            <>
              Sem supervisão registrada
              <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {semSupervisao.length}
              </span>
            </>
          }
        >
          {semSupervisao.map((c) => (
            <LinhaCelula
              key={c.id}
              celula={c}
              detalhe={
                c.diasSemSupervisao === null
                  ? 'nenhuma reunião registrada'
                  : `há ${c.diasSemSupervisao} dias`
              }
            />
          ))}
        </Bloco>
      )}

      {multiplicandoEmBreve.length > 0 && (
        <Bloco
          icone={<GitBranch className="h-4 w-4 text-primary" />}
          titulo="Multiplicação chegando"
        >
          {multiplicandoEmBreve.map((c) => {
            const data = c.multiplicacaoPrevista!
            const vencida = data < hoje
            return (
              <LinhaCelula
                key={c.id}
                celula={c}
                detalhe={`${vencida ? 'prevista para' : 'prevista'} ${format(
                  new Date(`${data}T12:00:00`),
                  "d 'de' MMMM",
                  { locale: ptBR },
                )}${vencida ? ' — já passou' : ''}`}
              />
            )
          })}
        </Bloco>
      )}
    </div>
  )
}
