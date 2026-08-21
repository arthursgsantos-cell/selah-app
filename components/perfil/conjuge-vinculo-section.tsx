'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Heart, Search, X, Check, Link2, Link2Off, UserCheck, MapPin, Cake, Baby, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  buscarMembrosAction,
  vincularConjugeAction,
  desvincularConjugeAction,
  buscarConjugeAtualAction,
  buscarSugestaoConjugeAction,
  buscarDadosConjugeAction,
  analisarVinculoConjugeAction,
  revisarFamiliaAction,
  type MembroItem,
  type ConjugeInfo,
  type DadosConjuge,
  type AnaliseVinculo,
  type ResolucaoDuplicata,
} from '@/app/actions/conjuge'
import { DuplicatasFamilia } from '@/components/perfil/duplicatas-familia'

function formatData(iso: string | null) {
  if (!iso) return null
  try {
    return format(parseISO(iso), "d 'de' MMMM", { locale: ptBR })
  } catch {
    return null
  }
}

function formatDataCompleta(iso: string | null) {
  if (!iso) return null
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
  } catch {
    return null
  }
}

export function ConjugeVinculoSection() {
  const [conjuge, setConjuge] = useState<ConjugeInfo>(null)
  const [dados, setDados] = useState<DadosConjuge | null>(null)
  const [sugestao, setSugestao] = useState<{ profileId: string; nome: string; avatar_url: string | null } | null>(null)
  const [modo, setModo] = useState<'idle' | 'busca' | 'confirmando'>('idle')
  // Quem vai ser vinculado e o que acontece com os filhos dos dois. Só sai do
  // nulo depois que o servidor comparou os cadastros.
  const [analise, setAnalise] = useState<{ alvo: MembroItem; dados: AnaliseVinculo } | null>(null)
  const [resolucoes, setResolucoes] = useState<ResolucaoDuplicata[]>([])
  // Pendências de um casal que já está vinculado: duplicata antiga, de antes
  // do vínculo existir.
  const [pendencias, setPendencias] = useState<AnaliseVinculo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<MembroItem[]>([])
  const [selecionado, setSelecionado] = useState<MembroItem | null>(null)
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    buscarConjugeAtualAction().then(setConjuge)
    buscarSugestaoConjugeAction().then(setSugestao)
  }, [])

  useEffect(() => {
    if (conjuge) {
      buscarDadosConjugeAction().then(setDados)
      revisarFamiliaAction().then(setPendencias).catch(() => setPendencias(null))
    } else {
      setDados(null)
      setPendencias(null)
    }
  }, [conjuge])

  function handleBusca(val: string) {
    setBusca(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.trim().length >= 2) {
        startTransition(async () => {
          const res = await buscarMembrosAction(val)
          setResultados(res)
        })
      } else {
        setResultados([])
      }
    }, 300)
  }

  /**
   * Vincular não é só ligar dois perfis: é decidir o que fazer com os filhos
   * que os dois cadastraram por conta própria. A análise roda antes para que
   * a pessoa veja a mesclagem antes dela acontecer, e não depois.
   */
  function analisar(alvo: MembroItem) {
    setErro(null)
    startTransition(async () => {
      try {
        const dados = await analisarVinculoConjugeAction(alvo.id)
        setResolucoes(
          dados.confirmar.map((item) => ({
            meuId: item.meu.id,
            deleId: item.dele.id,
            mesclar: true,
            ...item.sugestao,
          }))
        )
        setAnalise({ alvo, dados })
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível conferir os cadastros')
      }
    })
  }

  /** Abre a mesma conferência para um casal que já está vinculado. */
  function revisarPendencias() {
    if (!conjuge || !pendencias) return
    setResolucoes(
      pendencias.confirmar.map((item) => ({
        meuId: item.meu.id,
        deleId: item.dele.id,
        mesclar: true,
        ...item.sugestao,
      }))
    )
    setAnalise({ alvo: conjuge, dados: pendencias })
  }

  function aplicarVinculo() {
    if (!analise) return
    const alvo = analise.alvo
    setErro(null)
    startTransition(async () => {
      try {
        await vincularConjugeAction(alvo.id, resolucoes)
        setConjuge({ id: alvo.id, nome: alvo.nome, avatar_url: alvo.avatar_url })
        setSugestao(null)
        setAnalise(null)
        setResolucoes([])
        setModo('idle')
        setBusca('')
        setSelecionado(null)
        setPendencias(await revisarFamiliaAction().catch(() => null))
        setDados(await buscarDadosConjugeAction().catch(() => null))
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível vincular')
      }
    })
  }

  function cancelarAnalise() {
    setAnalise(null)
    setResolucoes([])
    setErro(null)
  }

  function desvincular() {
    startTransition(async () => {
      await desvincularConjugeAction()
      setConjuge(null)
      setDados(null)
      setModo('idle')
    })
  }

  const iniciais = (nome: string) =>
    nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Heart className="h-4 w-4 text-rose-500" />
        <p className="text-sm font-semibold">Cônjuge vinculado</p>
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      {/* Conferência antes de vincular: o que vai virar um cadastro só, o que
          precisa de decisão e o que passa a valer para os dois. */}
      {analise && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
              {analise.alvo.avatar_url ? (
                <img referrerPolicy="no-referrer" src={analise.alvo.avatar_url} className="h-full w-full object-cover" alt={analise.alvo.nome} />
              ) : iniciais(analise.alvo.nome)}
            </div>
            <p className="text-sm">
              {conjuge ? 'Cadastros de filhos com ' : 'Vincular com '}
              <strong>{analise.alvo.nome}</strong>
            </p>
          </div>

          <DuplicatasFamilia
            key={analise.alvo.id}
            analise={analise.dados}
            nomeConjuge={analise.alvo.nome}
            onChange={setResolucoes}
          />

          <div className="flex gap-2">
            <Button size="sm" onClick={aplicarVinculo} disabled={isPending}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {isPending
                ? 'Salvando...'
                : conjuge
                  ? 'Unificar cadastros'
                  : 'Confirmar vínculo'}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelarAnalise} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Sugestão de vinculação */}
      {!conjuge && sugestao && !analise && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
          <p className="text-xs text-rose-700 font-medium">Sugestão de vínculo</p>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold shrink-0">
              {sugestao.avatar_url ? (
                <img referrerPolicy="no-referrer" src={sugestao.avatar_url} className="h-full w-full rounded-full object-cover" alt={sugestao.nome} />
              ) : iniciais(sugestao.nome)}
            </div>
            <p className="text-sm font-medium flex-1">{sugestao.nome} indicou você como cônjuge</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => analisar({ id: sugestao.profileId, nome: sugestao.nome, avatar_url: sugestao.avatar_url })}
              disabled={isPending}
              className="flex-1"
            >
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              Confirmar vínculo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSugestao(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Cônjuge vinculado */}
      {conjuge ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
              {conjuge.avatar_url ? (
                <img referrerPolicy="no-referrer" src={conjuge.avatar_url} className="h-full w-full object-cover" alt={conjuge.nome} />
              ) : iniciais(conjuge.nome)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{conjuge.nome}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Conta vinculada
              </p>
            </div>
            <button
              onClick={desvincular}
              disabled={isPending}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Desvincular"
            >
              <Link2Off className="h-4 w-4" />
            </button>
          </div>

          {/* Duplicata que sobrou de antes do vínculo. Só aparece quando há
              mesmo o que unificar — o resto o sistema resolve sozinho. */}
          {!analise && pendencias && pendencias.automaticos.length + pendencias.confirmar.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-900">
                {pendencias.automaticos.length + pendencias.confirmar.length === 1
                  ? 'Um filho parece estar cadastrado nos dois perfis'
                  : `${pendencias.automaticos.length + pendencias.confirmar.length} filhos parecem estar cadastrados nos dois perfis`}
              </p>
              <p className="text-[11px] text-amber-800">
                Enquanto isso, eles aparecem repetidos nos aniversários da célula.
              </p>
              <Button size="sm" variant="outline" onClick={revisarPendencias} disabled={isPending}>
                <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                Revisar e unificar
              </Button>
            </div>
          )}

          {/* Dados compartilhados do cônjuge */}
          {dados && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações compartilhadas</p>

              {dados.endereco && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{dados.endereco}</p>
                    {dados.endereco_maps && (
                      <a
                        href={dados.endereco_maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline"
                      >
                        Ver no Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              {dados.data_casamento && (
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Aniversário de casamento</p>
                    <p className="text-xs text-foreground">{formatDataCompleta(dados.data_casamento)}</p>
                  </div>
                </div>
              )}

              {dados.data_nascimento_1 && (
                <div className="flex items-center gap-2.5">
                  <Cake className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Aniversário de {conjuge.nome.split(' ')[0]}</p>
                    <p className="text-xs text-foreground">{formatData(dados.data_nascimento_1)}</p>
                  </div>
                </div>
              )}

              {dados.filhos.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <Baby className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-muted-foreground">Filhos</p>
                    {dados.filhos.map((f, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <p className="text-xs text-foreground">{f.nome}</p>
                        {f.data_nascimento && (
                          <p className="text-[10px] text-muted-foreground">{formatData(f.data_nascimento)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!dados.endereco && !dados.data_casamento && !dados.data_nascimento_1 && dados.filhos.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {conjuge.nome.split(' ')[0]} ainda não preencheu o perfil completo.
                </p>
              )}
            </div>
          )}
        </div>
      ) : analise ? null : modo === 'idle' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Vincule a conta do seu cônjuge para aparecerem juntos nas atividades da célula.
          </p>
          <Button size="sm" variant="outline" onClick={() => setModo('busca')}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Vincular cônjuge
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => handleBusca(e.target.value)}
              placeholder="Buscar pelo nome..."
              autoFocus
              className="w-full h-9 rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          {/* Resultados */}
          {resultados.length > 0 && !selecionado && (
            <div className="rounded-lg border border-border divide-y">
              {resultados.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelecionado(m); setModo('confirmando') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                    {m.avatar_url ? (
                      <img referrerPolicy="no-referrer" src={m.avatar_url} className="h-full w-full object-cover" alt={m.nome} />
                    ) : iniciais(m.nome)}
                  </div>
                  <span className="text-sm">{m.nome}</span>
                </button>
              ))}
            </div>
          )}

          {/* Confirmação */}
          {modo === 'confirmando' && selecionado && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                  {selecionado.avatar_url ? (
                    <img referrerPolicy="no-referrer" src={selecionado.avatar_url} className="h-full w-full object-cover" alt={selecionado.nome} />
                  ) : iniciais(selecionado.nome)}
                </div>
                <p className="text-sm">Vincular com <strong>{selecionado.nome}</strong>?</p>
              </div>
              <p className="text-xs text-muted-foreground">
                O perfil de {selecionado.nome.split(' ')[0]} também será atualizado, e os filhos
                cadastrados pelos dois serão conferidos antes de virarem um cadastro só.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => analisar(selecionado)} disabled={isPending}>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {isPending ? 'Conferindo...' : 'Continuar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSelecionado(null); setModo('busca') }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {modo === 'busca' && (
            <Button size="sm" variant="ghost" onClick={() => { setModo('idle'); setBusca(''); setResultados([]) }}>
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
