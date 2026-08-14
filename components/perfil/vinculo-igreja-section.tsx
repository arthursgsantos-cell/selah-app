'use client'

import { useEffect, useState, useTransition } from 'react'
import { BadgeCheck, Clock, Loader2, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SeletorBusca } from '@/components/shared/seletor-busca'
import {
  declararVinculoAction, celulasParaDeclaracaoAction, minhaDeclaracaoAction,
  type DeclaracaoVinculo,
} from '@/app/actions/vinculo-igreja'
import type { CargoSolicitado } from '@/lib/supabase/types'

const VINCULOS: { v: DeclaracaoVinculo['vinculo']; nome: string; explica: string }[] = [
  { v: 'membro', nome: 'Sou membro', explica: 'Já fui recebido como membro da igreja' },
  { v: 'congregado', nome: 'Congrego aqui', explica: 'Frequento, mas ainda não sou membro' },
  { v: 'visitante', nome: 'Estou visitando', explica: 'Cheguei há pouco tempo' },
]

const FUNCOES: { v: CargoSolicitado | ''; nome: string }[] = [
  { v: '', nome: 'Nenhuma por enquanto' },
  { v: 'lider_treinamento', nome: 'Líder em treinamento' },
  { v: 'lider', nome: 'Líder de célula' },
  { v: 'supervisor_treinamento', nome: 'Supervisor em treinamento' },
  { v: 'supervisor', nome: 'Supervisor' },
  { v: 'ensino_professor', nome: 'Professor da Escola Bíblica' },
  { v: 'ensino_coordenador', nome: 'Coordenador de cursos' },
  { v: 'pastor', nome: 'Pastor' },
  { v: 'admin', nome: 'Administrador' },
]

interface Props {
  /** Destaca a seção e abre já preenchendo — o caso do primeiro acesso. */
  primeiroAcesso?: boolean
}

/**
 * "Quem você é na igreja?" — a declaração de vínculo.
 *
 * Quem entra pela primeira vez já sabe que é membro há anos, que lidera a
 * célula da quarta e que dá aula na Escola Bíblica; o app é que não sabia, e a
 * secretaria descobria depois, uma pessoa por vez.
 *
 * O que se declara aqui não vale na hora: vira pedido pendente até pastor ou
 * administrador confirmar. É pré-cadastro, não autoatribuição — a tela deixa
 * isso escrito para ninguém achar que virou pastor sozinho.
 */
export function VinculoIgrejaSection({ primeiroAcesso = false }: Props) {
  const [celulas, setCelulas] = useState<{ id: string; nome: string; rede: string | null }[]>([])
  const [jaDeclarado, setJaDeclarado] = useState<Awaited<ReturnType<typeof minhaDeclaracaoAction>>>(null)
  const [carregando, setCarregando] = useState(true)

  const [vinculo, setVinculo] = useState<DeclaracaoVinculo['vinculo']>('membro')
  const [cargo, setCargo] = useState<CargoSolicitado | ''>('')
  const [celulaId, setCelulaId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [enviando, iniciar] = useTransition()

  useEffect(() => {
    Promise.all([celulasParaDeclaracaoAction(), minhaDeclaracaoAction()])
      .then(([cs, decl]) => {
        setCelulas(cs)
        setJaDeclarado(decl)
        if (decl) {
          if (decl.vinculo === 'congregado' || decl.vinculo === 'visitante') setVinculo(decl.vinculo)
          setCargo(decl.cargo === 'membro' ? '' : decl.cargo)
          setCelulaId(decl.celulaId)
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  function enviar() {
    setErro(null)
    iniciar(async () => {
      const r = await declararVinculoAction({
        vinculo,
        cargo: cargo || null,
        celulaId,
        mensagem: mensagem.trim() || null,
      })
      if (!r.ok) { setErro(r.erro); return }
      setEnviado(true)
    })
  }

  if (carregando) return null

  const pendente = !enviado && jaDeclarado?.status === 'pendente'

  if (enviado || pendente) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Aguardando confirmação da liderança
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
              O que você contou já chegou para o pastor. Assim que ele confirmar,
              seu cargo e sua célula aparecem aqui — você pode usar o app
              normalmente enquanto isso.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border bg-card p-4 space-y-4 ${
        primeiroAcesso ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BadgeCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Quem você é na igreja?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Conte o que já é verdade sobre você. Fica guardado como pré-cadastro
            até o pastor confirmar — ninguém vira líder ou pastor sozinho por
            aqui.
          </p>
        </div>
      </div>

      {/* Vínculo */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Sua situação hoje</p>
        <div className="grid gap-1.5">
          {VINCULOS.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setVinculo(o.v)}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                vinculo === o.v
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  vinculo === o.v ? 'border-primary' : 'border-muted-foreground/40'
                }`}
              >
                {vinculo === o.v && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{o.nome}</span>
                <span className="block text-xs text-muted-foreground">{o.explica}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Célula */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Participa de alguma célula?
        </p>
        <SeletorBusca
          valor={celulaId}
          opcoes={celulas.map((c) => ({ id: c.id, nome: c.nome, detalhe: c.rede ?? undefined }))}
          onSelecionar={(id) => setCelulaId(id || null)}
          rotuloVazio="Ainda não participo"
          placeholder="Buscar célula..."
          className="w-full"
        />
      </div>

      {/* Função */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Você exerce alguma função?
        </p>
        <select
          value={cargo}
          onChange={(e) => setCargo(e.target.value as CargoSolicitado | '')}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
        >
          {FUNCOES.map((f) => (
            <option key={f.v} value={f.v}>{f.nome}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Quer contar mais alguma coisa? (opcional)
        </p>
        <Textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={2}
          placeholder="Ex: sou membro desde 2015 e ajudo na célula do Jardim América."
          className="resize-none text-sm"
        />
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <Button onClick={enviar} disabled={enviando} className="w-full gap-2">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar para a liderança confirmar
      </Button>
    </div>
  )
}
