'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  registrarSupervisaoAction, sugerirParticipantesAction,
  type ParticipanteSugerido,
} from '@/app/actions/supervisao'

const campoClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

export interface CelulaDaRede {
  id: string
  nome: string
  redeId: string
}

interface Props {
  redes: { id: string; nome: string }[]
  celulas: CelulaDaRede[]
  /** Abre já com esta célula escolhida — usado a partir da página da célula. */
  celulaInicialId?: string
  label?: string
}

function iniciais(nome: string): string {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

/**
 * Registrar a reunião de supervisão.
 *
 * Diálogo, e não página: é um punhado de campos lançados logo depois da
 * conversa, quase sempre do celular e sem sair de onde a pessoa já estava.
 *
 * A presença vem marcada por padrão para todos os líderes convocados —
 * desmarcar quem faltou é menos trabalho que marcar quem veio, e reunião em
 * que ninguém aparece é a exceção.
 */
export function RegistrarSupervisao({
  redes,
  celulas,
  celulaInicialId,
  label = 'Registrar supervisão',
}: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [salvando, iniciarSalvamento] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const celulaInicial = celulas.find((c) => c.id === celulaInicialId)

  const [redeId, setRedeId] = useState(celulaInicial?.redeId ?? redes[0]?.id ?? '')
  const [celulaId, setCelulaId] = useState(celulaInicialId ?? '')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [pauta, setPauta] = useState('')
  const [encaminhamentos, setEncaminhamentos] = useState('')

  const [sugeridos, setSugeridos] = useState<ParticipanteSugerido[]>([])
  const [ausentes, setAusentes] = useState<Set<string>>(new Set())
  const [carregandoPessoas, setCarregandoPessoas] = useState(false)

  const celulasDaRede = celulas.filter((c) => c.redeId === redeId)

  // Quem provavelmente estará na reunião muda conforme a rede e a célula: é o
  // servidor que responde, porque a lista sai de quem lidera cada célula.
  useEffect(() => {
    if (!aberto || !redeId) return
    let cancelado = false
    setCarregandoPessoas(true)

    sugerirParticipantesAction(redeId, celulaId || null).then((lista) => {
      if (cancelado) return
      setSugeridos(lista)
      setAusentes(new Set())
      setCarregandoPessoas(false)
    })

    return () => { cancelado = true }
  }, [aberto, redeId, celulaId])

  function alternarPresenca(id: string) {
    setAusentes((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function fechar() {
    setAberto(false)
    setErro(null)
    setPauta('')
    setEncaminhamentos('')
    setAusentes(new Set())
  }

  function salvar() {
    setErro(null)
    iniciarSalvamento(async () => {
      const r = await registrarSupervisaoAction({
        redeId,
        celulaId: celulaId || null,
        data,
        pauta: pauta || null,
        encaminhamentos: encaminhamentos || null,
        participantes: sugeridos.map((p) => ({
          userId: p.id,
          presente: !ausentes.has(p.id),
        })),
      })

      if (!r.ok) { setErro(r.erro); return }
      fechar()
      router.refresh()
    })
  }

  const presentes = sugeridos.length - ausentes.size

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <UserCheck className="h-4 w-4" />
        {label}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar supervisão</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {redes.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="sup-rede">Rede</Label>
              <select
                id="sup-rede"
                value={redeId}
                onChange={(e) => { setRedeId(e.target.value); setCelulaId('') }}
                className={campoClass}
              >
                {redes.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup-celula">Célula</Label>
              <select
                id="sup-celula"
                value={celulaId}
                onChange={(e) => setCelulaId(e.target.value)}
                className={campoClass}
              >
                {/* Reunião da rede inteira é um caso real — o encontro mensal
                    de líderes —, e não a ausência de uma escolha. */}
                <option value="">A rede toda</option>
                {celulasDaRede.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sup-data">Data</Label>
              <input
                id="sup-data"
                type="date"
                value={data}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setData(e.target.value)}
                className={campoClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Quem participou</Label>
              {sugeridos.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {presentes} de {sugeridos.length}
                </span>
              )}
            </div>

            {carregandoPessoas ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando os líderes...
              </p>
            ) : sugeridos.length === 0 ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Nenhum líder vinculado às células desta rede. A reunião fica
                registrada mesmo assim.
              </p>
            ) : (
              <div className="divide-y overflow-hidden rounded-xl border border-border">
                {sugeridos.map((p) => {
                  const presente = !ausentes.has(p.id)
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={presente}
                        onChange={() => alternarPresenca(p.id)}
                        className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                      />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.avatarUrl}
                            alt={p.nome}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          iniciais(p.nome)
                        )}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          presente ? '' : 'text-muted-foreground line-through'
                        }`}
                      >
                        {p.nome}
                      </span>
                      {!presente && (
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                          faltou
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-pauta">Pauta (opcional)</Label>
            <Textarea
              id="sup-pauta"
              rows={2}
              placeholder="O que foi conversado..."
              value={pauta}
              onChange={(e) => setPauta(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-enc">Encaminhamentos (opcional)</Label>
            <Textarea
              id="sup-enc"
              rows={2}
              placeholder="O que ficou combinado para a próxima..."
              value={encaminhamentos}
              onChange={(e) => setEncaminhamentos(e.target.value)}
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              className="flex-1"
              onClick={salvar}
              disabled={salvando || !redeId || !data}
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {salvando ? 'Registrando...' : 'Registrar'}
            </Button>
            <Button type="button" variant="ghost" onClick={fechar} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
