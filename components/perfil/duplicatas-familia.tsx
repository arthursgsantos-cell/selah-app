'use client'

import { useMemo, useState } from 'react'
import { Baby, Check, GitMerge, TriangleAlert, Users } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AnaliseVinculo, ResolucaoDuplicata } from '@/app/actions/conjuge'

function dataBr(iso: string | null) {
  if (!iso) return 'sem data'
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
  } catch {
    return iso
  }
}

const rotuloSexo = (s: 'M' | 'F' | null) => (s === 'M' ? 'Menino' : s === 'F' ? 'Menina' : 'não informado')

type EstadoPar = {
  mesclar: boolean
  nome: string
  data_nascimento: string | null
  sexo: 'M' | 'F' | null
}

function chave(meuId: number, deleId: number) {
  return `${meuId}:${deleId}`
}

/**
 * Traduz a análise do vínculo em decisões. O que é idêntico só é anunciado; o
 * que diverge vira pergunta com as duas versões lado a lado, porque só quem
 * está vinculando sabe qual grafia e qual data estão certas.
 */
export function DuplicatasFamilia({
  analise,
  nomeConjuge,
  onChange,
}: {
  analise: AnaliseVinculo
  nomeConjuge: string
  onChange: (resolucoes: ResolucaoDuplicata[]) => void
}) {
  const inicial = useMemo(() => {
    const m = new Map<string, EstadoPar>()
    for (const item of analise.confirmar) {
      m.set(chave(item.meu.id, item.dele.id), { mesclar: true, ...item.sugestao })
    }
    return m
  }, [analise])

  const [estados, setEstados] = useState<Map<string, EstadoPar>>(inicial)

  function emitir(proximo: Map<string, EstadoPar>) {
    setEstados(proximo)
    onChange(
      analise.confirmar.map((item) => {
        const e = proximo.get(chave(item.meu.id, item.dele.id))!
        return {
          meuId: item.meu.id,
          deleId: item.dele.id,
          mesclar: e.mesclar,
          nome: e.nome,
          data_nascimento: e.data_nascimento,
          sexo: e.sexo,
        }
      })
    )
  }

  function atualizar(k: string, patch: Partial<EstadoPar>) {
    const proximo = new Map(estados)
    proximo.set(k, { ...proximo.get(k)!, ...patch })
    emitir(proximo)
  }

  const primeiroNome = nomeConjuge.split(' ')[0]
  const nada =
    analise.automaticos.length === 0 &&
    analise.confirmar.length === 0 &&
    analise.compartilhar.length === 0

  return (
    <div className="space-y-3">
      {nada && (
        <p className="text-xs text-muted-foreground">
          Nenhum filho cadastrado dos dois lados ainda. Depois do vínculo, o que qualquer um dos
          dois cadastrar vale para o casal.
        </p>
      )}

      {analise.automaticos.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
            <GitMerge className="h-3.5 w-3.5" />
            {analise.automaticos.length === 1
              ? '1 filho cadastrado nos dois perfis'
              : `${analise.automaticos.length} filhos cadastrados nos dois perfis`}
          </p>
          {analise.automaticos.map((par) => (
            <p key={par.meu.id} className="text-xs text-emerald-900 flex items-center gap-1.5">
              <Check className="h-3 w-3 shrink-0" />
              {par.meu.nome}
              <span className="text-emerald-700">— vira um cadastro só</span>
            </p>
          ))}
        </div>
      )}

      {analise.confirmar.map((item) => {
        const k = chave(item.meu.id, item.dele.id)
        const e = estados.get(k)!
        return (
          <div key={k} className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              Parece a mesma criança, com informação diferente
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-background/70 p-2 space-y-0.5">
                <p className="text-muted-foreground">No seu perfil</p>
                <p className="font-medium text-foreground leading-snug">{item.meu.nome}</p>
                <p className="text-muted-foreground">{dataBr(item.meu.data_nascimento)}</p>
              </div>
              <div className="rounded-lg bg-background/70 p-2 space-y-0.5">
                <p className="text-muted-foreground">No perfil de {primeiroNome}</p>
                <p className="font-medium text-foreground leading-snug">{item.dele.nome}</p>
                <p className="text-muted-foreground">{dataBr(item.dele.data_nascimento)}</p>
              </div>
            </div>

            {e.mesclar && (
              <div className="space-y-2.5">
                {item.divergencias.includes('nome') && (
                  <EscolhaCampo
                    rotulo="Qual nome fica?"
                    opcoes={[item.meu.nome, item.dele.nome]}
                    valor={e.nome}
                    onEscolher={(v) => atualizar(k, { nome: v })}
                  />
                )}
                {item.divergencias.includes('data') && (
                  <EscolhaCampo
                    rotulo="Qual data de nascimento?"
                    opcoes={[item.meu.data_nascimento, item.dele.data_nascimento]}
                    valor={e.data_nascimento}
                    rotularOpcao={dataBr}
                    onEscolher={(v) => atualizar(k, { data_nascimento: v })}
                  />
                )}
                {item.divergencias.includes('sexo') && (
                  <EscolhaCampo
                    rotulo="Menino ou menina?"
                    opcoes={[item.meu.sexo, item.dele.sexo]}
                    valor={e.sexo}
                    rotularOpcao={rotuloSexo}
                    onEscolher={(v) => atualizar(k, { sexo: v })}
                  />
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={!e.mesclar}
                onChange={(ev) => atualizar(k, { mesclar: !ev.target.checked })}
                className="h-3.5 w-3.5 accent-amber-600"
              />
              São crianças diferentes — manter os dois cadastros
            </label>
          </div>
        )
      })}

      {analise.compartilhar.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Passam a valer para os dois
          </p>
          {analise.compartilhar.map((d) => (
            <p key={d.id} className="text-xs text-foreground flex items-center gap-1.5">
              <Baby className="h-3 w-3 text-sky-500 shrink-0" />
              {d.nome}
            </p>
          ))}
        </div>
      )}

      {analise.conjugeDigitado.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          O cônjuge que estava cadastrado como dependente sai da lista — agora é uma conta de
          verdade, e apareceria duas vezes nos aniversários.
        </p>
      )}
    </div>
  )
}

function EscolhaCampo<T extends string | null>({
  rotulo,
  opcoes,
  valor,
  rotularOpcao,
  onEscolher,
}: {
  rotulo: string
  opcoes: [T, T]
  valor: T
  rotularOpcao?: (v: T) => string
  onEscolher: (v: T) => void
}) {
  // Lados iguais não viram escolha: só um dos campos costuma divergir, e
  // repetir a mesma opção duas vezes faria a pergunta parecer quebrada.
  const unicas = opcoes[0] === opcoes[1] ? [opcoes[0]] : opcoes

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-amber-900">{rotulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {unicas.map((op, i) => {
          const ativo = valor === op
          return (
            <button
              key={i}
              type="button"
              onClick={() => onEscolher(op)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                ativo
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-amber-300 bg-background text-foreground hover:bg-amber-100'
              }`}
            >
              {rotularOpcao ? rotularOpcao(op) : (op as string) || 'sem informação'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
