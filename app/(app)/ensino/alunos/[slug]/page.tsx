import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft, Phone, Mail, MapPin, Cake, Heart, Users, Award, GraduationCap,
  ClipboardCheck, Check, X, Minus, CalendarDays, Clock,
} from 'lucide-react'
import { loginCom } from '@/lib/destino-login'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import { fichaDoAluno, type MatriculaDetalhada } from '@/lib/ensino/alunos'
import { PAINEL } from '@/lib/estilos'
import {
  STATUS_INSCRICAO, corFrequencia, dataBr, encontrosTexto, periodoTexto,
} from '@/lib/ensino/turma'
import type { Role } from '@/lib/supabase/types'

const CARGO: Record<Role, string> = {
  admin: 'Admin',
  pastor: 'Pastor',
  supervisor: 'Supervisor',
  supervisor_treinamento: 'Supervisor em treinamento',
  lider: 'Líder',
  lider_treinamento: 'Líder em treinamento',
  membro: 'Membro',
  convidado: 'Convidado',
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) return { title: 'Ficha do aluno · Ensino IBZS' }

  const ficha = await fichaDoAluno(acesso.igrejaId, params.slug)
  return { title: ficha ? `${ficha.resumo.nome} · Ensino IBZS` : 'Aluno não encontrado' }
}

/**
 * A ficha de um aluno: dados, célula, todos os cursos por onde passou e a
 * frequência em cada um.
 *
 * É página, e não diálogo dentro da tabela: a coordenação manda o endereço para
 * o professor, volta nele depois, imprime. Um modal não sobrevive a nada disso.
 */
export default async function FichaAlunoPage({ params }: { params: { slug: string } }) {
  const acesso = await acessoEnsino()
  if (!acesso) redirect(loginCom(`/ensino/alunos/${params.slug}`))
  if (!acesso.coordenador) redirect('/ensino')

  const ficha = await fichaDoAluno(acesso.igrejaId, params.slug)
  if (!ficha) notFound()

  const { resumo, perfil, dependentes, matriculas } = ficha
  const whatsapp = resumo.telefone?.replace(/\D/g, '')
  const concluidas = matriculas.filter((m) => m.status === 'concluida')

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-6">
      <Link
        href="/ensino/alunos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Alunos
      </Link>

      {/* Identificação */}
      <div className={`${PAINEL} flex items-start gap-4`}>
        <div className="h-16 w-16 shrink-0 rounded-full bg-muted text-muted-foreground overflow-hidden flex items-center justify-center text-lg font-bold">
          {resumo.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              referrerPolicy="no-referrer"
              src={resumo.avatarUrl}
              alt={resumo.nome}
              className="h-full w-full object-cover"
            />
          ) : (
            resumo.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight">{resumo.nome}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {perfil.titulo ? `${perfil.titulo} · ` : ''}
            {CARGO[resumo.role]}
          </p>

          {resumo.celulas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {resumo.celulas.map((c) => (
                <span
                  key={c.nome}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-border bg-muted"
                >
                  <Users className="h-3 w-3" />
                  {c.nome}
                  <span className="opacity-60">· {c.papel === 'lider' ? 'Líder' : 'Membro'}</span>
                  {c.redeNome && <span className="opacity-60">· {c.redeNome}</span>}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {whatsapp && (
              <a
                href={`https://wa.me/55${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                {resumo.telefone}
              </a>
            )}
            {resumo.email && (
              <a
                href={`mailto:${resumo.email}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors max-w-full"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{resumo.email}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Indicador
          icone={<GraduationCap className="h-4 w-4" />}
          valor={resumo.matriculas.length}
          rotulo="inscrições"
        />
        <Indicador
          icone={<Award className="h-4 w-4" />}
          valor={resumo.concluidas}
          rotulo="concluídos"
        />
        <Indicador
          icone={<ClipboardCheck className="h-4 w-4" />}
          valor={resumo.percentual === null ? '—' : `${resumo.percentual}%`}
          rotulo="presença geral"
          classe={corFrequencia(resumo.percentual)}
        />
        <Indicador
          icone={<Clock className="h-4 w-4" />}
          valor={resumo.pendentes}
          rotulo="pedidos pendentes"
          classe={resumo.pendentes > 0 ? 'text-amber-600' : undefined}
        />
      </div>

      {/* Dados pessoais */}
      <section className={`${PAINEL} space-y-3`}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Dados
        </p>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
          <Dado icone={<Cake className="h-3.5 w-3.5" />} rotulo="Nascimento">
            {perfil.nascimento ? dataBr(perfil.nascimento) : null}
          </Dado>
          <Dado icone={<Heart className="h-3.5 w-3.5" />} rotulo="Cônjuge">
            {perfil.conjugeNome
              ? `${perfil.conjugeNome}${perfil.nascimentoConjuge ? ` · ${dataBr(perfil.nascimentoConjuge)}` : ''}`
              : null}
          </Dado>
          <Dado icone={<CalendarDays className="h-3.5 w-3.5" />} rotulo="Casamento">
            {perfil.casamento ? dataBr(perfil.casamento) : null}
          </Dado>
          <Dado icone={<Clock className="h-3.5 w-3.5" />} rotulo="No app desde">
            {perfil.membroDesde ? dataBr(perfil.membroDesde.slice(0, 10)) : null}
          </Dado>
          <div className="sm:col-span-2">
            <Dado icone={<MapPin className="h-3.5 w-3.5" />} rotulo="Endereço">
              {perfil.endereco ? (
                perfil.enderecoMaps ? (
                  <a
                    href={perfil.enderecoMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {perfil.endereco}
                    {perfil.enderecoComplemento ? `, ${perfil.enderecoComplemento}` : ''}
                  </a>
                ) : (
                  `${perfil.endereco}${perfil.enderecoComplemento ? `, ${perfil.enderecoComplemento}` : ''}`
                )
              ) : null}
            </Dado>
          </div>
        </dl>

        {dependentes.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
              Família
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dependentes.map((d) => (
                <span
                  key={`${d.tipo}-${d.nome}`}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted"
                >
                  {d.nome}
                  <span className="text-muted-foreground">
                    {' '}· {d.tipo}
                    {d.dataNascimento ? ` · ${dataBr(d.dataNascimento)}` : ''}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Certificados — hoje, as conclusões registradas */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Certificados
        </p>
        {concluidas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-8 text-center">
            <Award className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum curso concluído ainda.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y overflow-hidden">
            {concluidas.map((m) => (
              <div key={m.inscricaoId} className="flex items-center gap-3 px-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Award className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">{m.cursoNome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.turmaNome}
                    {m.decididoEm && ` · concluído em ${dataBr(m.decididoEm.slice(0, 10))}`}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${corFrequencia(m.percentual)}`}>
                  {m.percentual === null ? '—' : `${m.percentual}%`}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/70 mt-2">
          A conclusão fica registrada aqui; a emissão do certificado ainda é feita fora do app.
        </p>
      </section>

      {/* Histórico de cursos */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Cursos ({matriculas.length})
        </p>
        {matriculas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma inscrição.</p>
          </div>
        ) : (
          matriculas.map((m) => <CartaoMatricula key={m.inscricaoId} matricula={m} />)
        )}
      </section>
    </div>
  )
}

function CartaoMatricula({ matricula: m }: { matricula: MatriculaDetalhada }) {
  const extras = Object.entries(m.dados).filter(([, v]) => v)
  const encontros = encontrosTexto(m.diasSemana, m.horarioInicio, m.horarioFim)
  const periodo = periodoTexto(m.dataInicio, m.dataFim)

  return (
    <div className={`${PAINEL} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/ensino/turma/${m.turmaId}`} className="min-w-0 group">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
            {m.cursoNome}
          </p>
          <p className="font-semibold leading-tight mt-0.5 group-hover:text-primary transition-colors">
            {m.turmaNome}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[periodo, encontros, m.local].filter(Boolean).join(' · ')}
          </p>
        </Link>
        <span
          className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_INSCRICAO[m.status].classe}`}
        >
          {STATUS_INSCRICAO[m.status].label}
        </span>
      </div>

      {/* Frequência, com a mesma grade de quadradinhos da área do aluno */}
      <div className="rounded-xl bg-muted p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Frequência
          </span>
          <span className={`text-lg font-bold leading-none ${corFrequencia(m.percentual)}`}>
            {m.percentual === null ? '—' : `${m.percentual}%`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {m.registros === 0
            ? 'Nenhuma chamada registrada ainda.'
            : `${m.presentes} ${m.presentes === 1 ? 'presença' : 'presenças'} em ${m.registros} ${m.registros === 1 ? 'aula' : 'aulas'}.`}
        </p>

        {m.aulas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {m.aulas.map((a) => (
              <span
                key={a.numero}
                title={`Aula ${a.numero} · ${dataBr(a.data)}${a.titulo ? ` · ${a.titulo}` : ''}`}
                className={`h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                  a.presente === true
                    ? 'bg-green-100 text-green-700'
                    : a.presente === false
                      ? 'bg-red-100 text-red-600'
                      : 'bg-background text-muted-foreground/40 border border-border'
                }`}
              >
                {a.presente === true ? (
                  <Check className="h-3 w-3" />
                ) : a.presente === false ? (
                  <X className="h-3 w-3" />
                ) : (
                  <Minus className="h-2.5 w-2.5" />
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {extras.length > 0 && (
        <dl className="space-y-0.5 border-t pt-2.5">
          {extras.map(([chave, valor]) => (
            <div key={chave} className="flex gap-2 text-xs">
              <dt className="text-muted-foreground shrink-0">{chave}:</dt>
              <dd className="min-w-0">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {m.observacao && <p className="text-xs text-muted-foreground italic">{m.observacao}</p>}

      <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 flex-wrap">
        <Clock className="h-3 w-3 shrink-0" />
        <span>Inscrição em {dataBr(m.criadoEm.slice(0, 10))}</span>
        {m.decididoEm && (
          <span>
            · {STATUS_INSCRICAO[m.status].label.toLowerCase()}
            {m.decididoPor ? ` por ${m.decididoPor}` : ''} em {dataBr(m.decididoEm.slice(0, 10))}
          </span>
        )}
      </p>
    </div>
  )
}

function Indicador({
  icone, valor, rotulo, classe,
}: {
  icone: React.ReactNode
  valor: number | string
  rotulo: string
  classe?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-muted-foreground">{icone}</div>
      <p className={`text-xl font-bold leading-none mt-1.5 ${classe ?? ''}`}>{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{rotulo}</p>
    </div>
  )
}

/** Linha de dado que só aparece quando há valor — ficha com "—" em tudo cansa. */
function Dado({
  icone, rotulo, children,
}: {
  icone: React.ReactNode
  rotulo: string
  children: React.ReactNode
}) {
  if (!children) return null
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icone}</span>
      <div className="min-w-0">
        <dt className="text-[11px] text-muted-foreground leading-tight">{rotulo}</dt>
        <dd className="text-sm leading-snug">{children}</dd>
      </div>
    </div>
  )
}
