'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  X, Mail, Phone, Users, GraduationCap, Award, Clock, ChevronRight, UserX,
} from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import { corFrequencia, STATUS_INSCRICAO } from '@/lib/ensino/turma'
import type { StatusInscricaoEnsino } from '@/lib/supabase/types'

export interface MatriculaCartao {
  turmaId: string
  turmaNome: string
  cursoNome: string
  status: StatusInscricaoEnsino
  modo: 'presencial' | 'gravado'
  presentes: number
  registros: number
  percentual: number | null
}

export interface AlunoCartao {
  slug: string
  nome: string
  avatarUrl: string | null
  temConta: boolean
  email: string | null
  telefone: string | null
  celulas: { nome: string; papel: string; redeNome: string | null }[]
  matriculas: MatriculaCartao[]
  ativas: number
  concluidas: number
  pendentes: number
  presentes: number
  registros: number
  percentual: number | null
}

/**
 * O número como o WhatsApp espera.
 *
 * Onze dígitos ou menos é número brasileiro digitado sem o país — é como quase
 * todo cadastro chega. Acima disso o DDI já veio junto e repetir o 55 quebraria
 * o link. Mesma regra de `gestao-inscritos.tsx`.
 */
function linkWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`
}

function iniciais(nome: string): string {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

/**
 * A carteirinha do aluno.
 *
 * A ficha completa continua em `/ensino/alunos/[slug]`; o que faltava era o
 * passo anterior — bater o olho em quem é a pessoa sem perder a lista filtrada
 * que se levou um minuto para montar. Por isso é diálogo e não navegação: a
 * coordenação percorre uma dúzia de alunos seguidos, e voltar da ficha
 * significa refazer busca, filtro e rolagem a cada um.
 *
 * O que entra aqui é o que se responde de relance: contato, células, e como
 * está indo em cada turma. O histórico aula a aula é da ficha.
 */
export function AlunoCarteirinha({
  aluno, onFechar,
}: {
  aluno: AlunoCartao | null
  onFechar: () => void
}) {
  // Esc fecha, e o corpo para de rolar por trás do diálogo.
  useEffect(() => {
    if (!aluno) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', aoTeclar)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', aoTeclar)
    }
  }, [aluno, onFechar])

  if (!aluno || typeof document === 'undefined') return null

  const emCurso = aluno.matriculas.filter((m) => m.status === 'aprovada')
  const encerradas = aluno.matriculas.filter((m) => m.status !== 'aprovada')

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Carteirinha de ${aluno.nome}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card shadow-xl sm:rounded-3xl"
      >
        {/* Cabeçalho: a faixa colorida é o que faz parecer carteirinha e não
            mais uma linha de tabela ampliada. */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted text-base font-bold text-muted-foreground ring-2 ring-background">
              {aluno.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  referrerPolicy="no-referrer"
                  src={aluno.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                iniciais(aluno.nome)
              )}
            </div>
            <div className="min-w-0 pr-6">
              <h2 className="truncate text-lg font-bold leading-tight">{aluno.nome}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {aluno.celulas[0]
                  ? [aluno.celulas[0].nome, aluno.celulas[0].redeNome && `Rede ${aluno.celulas[0].redeNome}`]
                      .filter(Boolean)
                      .join(' · ')
                  : aluno.temConta
                    ? 'Sem célula'
                    : 'Cadastrado pelo professor'}
              </p>
              {aluno.pendentes > 0 && (
                <span className="mt-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  {aluno.pendentes} {aluno.pendentes === 1 ? 'pedido pendente' : 'pedidos pendentes'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 pt-4">
          {/* Os três números que resumem a passagem pela escola. */}
          <div className="grid grid-cols-3 gap-2">
            <Numero icone={<GraduationCap className="h-3.5 w-3.5" />} valor={aluno.ativas} rotulo="em curso" />
            <Numero icone={<Award className="h-3.5 w-3.5" />} valor={aluno.concluidas} rotulo="concluídos" />
            <Numero
              icone={<Clock className="h-3.5 w-3.5" />}
              valor={aluno.percentual === null ? '—' : `${aluno.percentual}%`}
              rotulo={aluno.registros > 0 ? `${aluno.presentes}/${aluno.registros} chamadas` : 'sem chamada'}
              classe={corFrequencia(aluno.percentual)}
            />
          </div>

          {/* Contato */}
          {(aluno.telefone || aluno.email) && (
            <div className="space-y-2">
              {aluno.telefone && (
                <div className="flex items-center gap-2">
                  <a
                    href={linkWhatsApp(aluno.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${aluno.telefone.replace(/\D/g, '')}`}
                    aria-label={`Ligar para ${aluno.nome}`}
                    className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2 transition-colors hover:bg-accent"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                </div>
              )}
              {aluno.email && (
                <a
                  href={`mailto:${aluno.email}`}
                  className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{aluno.email}</span>
                </a>
              )}
            </div>
          )}

          {!aluno.temConta && (
            <p className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <UserX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Aluno cadastrado pelo professor. Ainda não criou conta no app, então
              célula e perfil vêm do que foi digitado na inscrição.
            </p>
          )}

          {/* Células, quando há mais de uma — a primeira já está no cabeçalho. */}
          {aluno.celulas.length > 1 && (
            <div>
              <Titulo icone={<Users className="h-3.5 w-3.5" />}>Células</Titulo>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {aluno.celulas.map((c) => (
                  <span
                    key={c.nome}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {c.nome}
                    {c.papel === 'lider' && <span className="ml-1 font-semibold text-primary">líder</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Turmas */}
          {aluno.matriculas.length > 0 && (
            <div>
              <Titulo icone={<GraduationCap className="h-3.5 w-3.5" />}>
                Turmas ({aluno.matriculas.length})
              </Titulo>
              <div className="mt-1.5 space-y-1.5">
                {[...emCurso, ...encerradas].map((m) => (
                  <div
                    key={m.turmaId}
                    className="flex items-center gap-2 rounded-xl border border-border px-2.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium leading-tight">{m.cursoNome}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{m.turmaNome}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_INSCRICAO[m.status].classe}`}
                    >
                      {STATUS_INSCRICAO[m.status].label}
                    </span>
                    {/* Turma gravada não tem chamada — o acompanhamento ali é o
                        progresso nas aulas, que mora na ficha. */}
                    {m.modo === 'presencial' && (
                      <span
                        className={`w-9 shrink-0 text-right text-xs font-semibold ${corFrequencia(m.percentual)}`}
                      >
                        {m.percentual === null ? '—' : `${m.percentual}%`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            href={`/ensino/alunos/${aluno.slug}`}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Gerenciar ficha completa
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Titulo({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {icone}
      {children}
    </p>
  )
}

function Numero({
  icone, valor, rotulo, classe,
}: {
  icone: React.ReactNode
  valor: number | string
  rotulo: string
  classe?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-2 text-center">
      <div className="flex justify-center text-muted-foreground">{icone}</div>
      <p className={`mt-1 text-lg font-bold leading-none ${classe ?? ''}`}>{valor}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{rotulo}</p>
    </div>
  )
}
