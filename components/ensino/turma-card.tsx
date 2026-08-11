import Link from 'next/link'
import { CalendarDays, MapPin, Users, ChevronRight, GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  STATUS_TURMA,
  encontrosTexto,
  periodoTexto,
  vagasRestantes,
} from '@/lib/ensino/turma'
import type { StatusInscricaoEnsino, StatusTurma } from '@/lib/supabase/types'
import { STATUS_INSCRICAO } from '@/lib/ensino/turma'

export interface TurmaResumo {
  id: string
  /** Endereço legível da turma. Nulo só em turma criada antes do slug existir. */
  slug: string | null
  nome: string
  cursoNome: string
  capaUrl: string | null
  local: string | null
  dataInicio: string | null
  dataFim: string | null
  diasSemana: number[]
  horarioInicio: string | null
  horarioFim: string | null
  vagas: number | null
  status: StatusTurma
  aprovados: number
  professores: string[]
}

/**
 * Cartão de turma da listagem. Segue o formato dos cards de evento — capa
 * quadrada à esquerda, título e metadados à direita — para que a área de Ensino
 * não pareça um app diferente colado dentro do site.
 */
export function TurmaCard({
  turma,
  minhaInscricao,
  href,
}: {
  turma: TurmaResumo
  /** Status da inscrição de quem está vendo, quando existe. */
  minhaInscricao?: StatusInscricaoEnsino | null
  href?: string
}) {
  const status = STATUS_TURMA[turma.status]
  const restantes = vagasRestantes(turma.vagas, turma.aprovados)
  const encontros = encontrosTexto(turma.diasSemana, turma.horarioInicio, turma.horarioFim)
  const periodo = periodoTexto(turma.dataInicio, turma.dataFim)

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <Link href={href ?? `/ensino/turma/${turma.slug ?? turma.id}`} className="flex items-start gap-3.5">
          {/* Retrato, e não quadrado: a capa de um curso costuma ser capa de
              livro ou arte vertical, e o recorte quadrado cortava o título da
              própria arte. */}
          {turma.capaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={turma.capaUrl}
              alt={turma.nome}
              className="w-20 sm:w-24 aspect-[3/4] rounded-xl object-cover shrink-0 shadow-sm"
            />
          ) : (
            <div className="w-20 sm:w-24 aspect-[3/4] rounded-xl bg-gradient-to-br from-[#0B2447] to-[#0F52BA] shrink-0 flex items-center justify-center shadow-sm">
              <GraduationCap className="h-8 w-8 text-white/80" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest truncate">
                  {turma.cursoNome}
                </p>
                <p className="font-semibold text-sm leading-snug mt-0.5">{turma.nome}</p>
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${status.classe}`}>
                {status.label}
              </span>
            </div>

            {encontros && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                <CalendarDays className="h-3 w-3 shrink-0" />
                {encontros}
              </p>
            )}
            {periodo && (
              <p className="text-xs text-muted-foreground mt-0.5">{periodo}</p>
            )}
            {turma.local && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {turma.local}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3 shrink-0" />
                {turma.aprovados} {turma.aprovados === 1 ? 'inscrito' : 'inscritos'}
                {restantes !== null && ` · ${restantes} ${restantes === 1 ? 'vaga' : 'vagas'}`}
              </span>
              {minhaInscricao && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_INSCRICAO[minhaInscricao].classe}`}
                >
                  {STATUS_INSCRICAO[minhaInscricao].label}
                </span>
              )}
            </div>

            {turma.professores.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5 truncate">
                {turma.professores.length === 1 ? 'Professor' : 'Professores'}:{' '}
                {turma.professores.join(', ')}
              </p>
            )}
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground self-center hidden sm:block" />
        </Link>
      </CardContent>
    </Card>
  )
}
