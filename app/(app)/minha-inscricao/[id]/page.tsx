import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CalendarDays, MapPin, Receipt, ExternalLink, Eye, HandHeart, BedDouble, Car, Utensils } from 'lucide-react'
import { BotaoComprovante } from '@/components/shared/visualizador-comprovante'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EventoContagem } from '@/components/eventos/evento-contagem'
import { buscarInscricao } from '@/lib/inscricao-pessoal'
import { PAINEL } from '@/lib/estilos'

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Acompanhamento da inscrição de UMA pessoa num evento.
 *
 * Exige login: cada um vê só a própria inscrição. O link pode ser o mesmo para
 * todo mundo (é o que vai no fim do formulário) — quem identifica é a sessão,
 * não a URL.
 *
 * Os dados vêm da planilha do evento, alimentada pelo Zapia. O app não guarda
 * cópia: pagamento conferido lá aparece aqui na sincronização seguinte.
 */
export default async function MinhaInscricaoPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sem login não há como saber de quem é a inscrição. Volta para cá depois.
  if (!user) redirect(`/login?next=/minha-inscricao/${params.id}`)

  const admin = createAdminClient()

  const consulta = admin
    .from('eventos')
    .select('id, slug, titulo, data_hora, data_hora_fim, local, imagem_url, capa_pagina_url, inscricoes_planilha_url, comprovantes_pasta_url')

  const { data: eventoData } = await (PADRAO_UUID.test(params.id)
    ? consulta.eq('id', params.id)
    : consulta.eq('slug', params.id)
  ).maybeSingle()

  if (!eventoData) notFound()
  const evento = eventoData as {
    id: string; slug: string | null; titulo: string; data_hora: string
    data_hora_fim: string | null; local: string | null
    imagem_url: string | null; capa_pagina_url: string | null
    inscricoes_planilha_url: string | null; comprovantes_pasta_url: string | null
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('nome, email, telefone')
    .eq('id', user.id)
    .single()

  const inscricao = evento.inscricoes_planilha_url
    ? await buscarInscricao(evento.inscricoes_planilha_url, {
        email: perfil?.email ?? user.email ?? null,
        telefone: (perfil as { telefone?: string | null } | null)?.telefone ?? null,
      })
    : null

  const data = new Date(evento.data_hora)
  const jaPassou = data.getTime() < Date.now()
  const capa = evento.capa_pagina_url ?? evento.imagem_url

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-8">
      <Button variant="ghost" size="sm" render={<Link href="/perfil" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Minhas inscrições
      </Button>

      {capa && (
        <div className="overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capa} alt={evento.titulo} className="max-h-56 w-full object-cover" />
        </div>
      )}

      <div className={`${PAINEL} space-y-2`}>
        <h1 className="text-2xl font-bold leading-tight">{evento.titulo}</h1>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 capitalize">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {format(data, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH'h'mm", { locale: ptBR })}
          </p>
          {evento.local && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              {evento.local}
            </p>
          )}
        </div>
        <Link
          href={`/evento/${evento.slug ?? evento.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Ver a página do evento
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {!jaPassou && <EventoContagem dataHora={evento.data_hora} />}

      {!inscricao ? (
        <div className={`${PAINEL} text-center`}>
          <p className="text-sm font-medium">Não encontramos sua inscrição</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Procuramos pelo e-mail e telefone do seu perfil. Se você se inscreveu com outro
            e-mail, atualize seu perfil ou fale com a liderança.
          </p>
          <Button variant="outline" size="sm" render={<Link href="/perfil" />} className="mt-3">
            Conferir meu perfil
          </Button>
        </div>
      ) : (
        <>
          {/* ── Pagamento ── */}
          <section className={`${PAINEL} space-y-3`}>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Pagamento</h2>
              {inscricao.statusPagamento && (
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    /pago|confirmad|quitad/i.test(inscricao.statusPagamento)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {inscricao.statusPagamento}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { rotulo: 'Total', valor: inscricao.valorTotal },
                { rotulo: 'Pago', valor: inscricao.valorPago },
                { rotulo: 'Falta', valor: inscricao.saldo },
              ].map((c) => (
                <div key={c.rotulo} className="rounded-xl bg-muted p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.rotulo}</p>
                  <p className="mt-0.5 text-sm font-bold">{c.valor ?? '—'}</p>
                </div>
              ))}
            </div>

            {(inscricao.parcelasPagas || inscricao.formaPagamento) && (
              <p className="text-xs text-muted-foreground">
                {inscricao.formaPagamento && <>Forma: {inscricao.formaPagamento}. </>}
                {inscricao.parcelasPagas && <>Parcelas pagas: {inscricao.parcelasPagas}. </>}
                {inscricao.parcelasRestantes && <>Restantes: {inscricao.parcelasRestantes}.</>}
              </p>
            )}

            {inscricao.pagamentos.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Comprovantes</p>
                {inscricao.pagamentos.map((p, i) => (
                  <div
                    key={`${p.transacao ?? i}`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {p.valor}
                        {p.parcela && p.parcela !== '—' && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            parcela {p.parcela}
                          </span>
                        )}
                      </p>
                      {p.data && <p className="text-[11px] text-muted-foreground">{p.data}</p>}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        /confirmad|pago/i.test(p.status)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.comprovanteUrl && (
                      <BotaoComprovante
                        url={p.comprovanteUrl}
                        titulo="Comprovante"
                        rotulo="Ver comprovante"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="h-4 w-4" />
                      </BotaoComprovante>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum pagamento registrado ainda. Assim que o comprovante for conferido, ele
                aparece aqui.
              </p>
            )}

            {evento.comprovantes_pasta_url && (
              <a
                href={evento.comprovantes_pasta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Pasta dos comprovantes
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </section>

          {/* ── Como você se inscreveu ── */}
          <section className={`${PAINEL} space-y-2`}>
            <h2 className="text-sm font-semibold">Sua inscrição</h2>
            <dl className="space-y-2 text-sm">
              {[
                { icone: HandHeart, rotulo: 'Vou servir em', valor: inscricao.servico },
                { icone: BedDouble, rotulo: 'Acomodação', valor: inscricao.acomodacao },
                { icone: Car, rotulo: 'Transporte', valor: inscricao.transporte },
                { icone: Utensils, rotulo: 'Restrição alimentar', valor: inscricao.restricaoAlimentar },
              ]
                .filter((l) => l.valor && !/^n(ã|a)o$/i.test(l.valor))
                .map(({ icone: Icone, rotulo, valor }) => (
                  <div key={rotulo} className="flex items-start gap-2">
                    <Icone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {rotulo}
                      </dt>
                      <dd className="font-medium">{valor}</dd>
                    </div>
                  </div>
                ))}
            </dl>
            {inscricao.conjuge && (
              <p className="text-xs text-muted-foreground">Inscrição com {inscricao.conjuge}.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
