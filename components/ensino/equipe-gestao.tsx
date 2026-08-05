'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2, Trash2, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  definirPapelAction, removerDaEquipeAction, buscarCandidatos, type MembroEquipe,
} from '@/app/actions/ensino/equipe'
import type { PapelEnsino } from '@/lib/supabase/types'

const campoClass =
  'h-7 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

export function EquipeGestao({ equipe, meuId }: { equipe: MembroEquipe[]; meuId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function trocarPapel(profileId: string, papel: PapelEnsino) {
    setErro(null)
    startTransition(async () => {
      const r = await definirPapelAction(profileId, papel)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  function remover(profileId: string) {
    setErro(null)
    startTransition(async () => {
      const r = await removerDaEquipeAction(profileId)
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <AdicionarDialog />

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {equipe.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum professor cadastrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm mx-auto">
            Pastores e administradores já têm acesso total ao Ensino. Cadastre aqui quem vai dar
            aula sem ser pastor.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border divide-y overflow-hidden">
          {equipe.map((m) => (
            <div key={m.profileId} className="flex items-center gap-3 px-3 py-2.5">
              <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    referrerPolicy="no-referrer"
                    src={m.avatarUrl}
                    alt={m.nome}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  m.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight truncate">{m.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {m.turmas} {m.turmas === 1 ? 'turma' : 'turmas'}
                  {m.email && ` · ${m.email}`}
                </p>
              </div>

              <select
                value={m.papel}
                onChange={(e) => trocarPapel(m.profileId, e.target.value as PapelEnsino)}
                disabled={isPending}
                aria-label={`Papel de ${m.nome}`}
                className={campoClass}
              >
                <option value="professor">Professor</option>
                <option value="coordenador">Coordenador</option>
              </select>

              <button
                type="button"
                onClick={() => remover(m.profileId)}
                disabled={isPending || m.profileId === meuId}
                aria-label={`Remover ${m.nome} da equipe`}
                title={m.profileId === meuId ? 'Você não pode se remover' : 'Remover da equipe'}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          <strong>Professor</strong> administra só as turmas em que está vinculado.{' '}
          <strong>Coordenador</strong> administra todo o Ensino — como pastor e administrador da
          igreja, que já entram com esse acesso.
        </span>
      </p>
    </div>
  )
}

function AdicionarDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<
    { id: string; nome: string; email: string | null; avatarUrl: string | null }[]
  >([])
  const [buscando, startBusca] = useTransition()
  const [salvando, startSalvar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function buscar(valor: string) {
    setTermo(valor)
    if (valor.trim().length < 2) { setResultados([]); return }
    startBusca(async () => {
      setResultados(await buscarCandidatos(valor))
    })
  }

  function adicionar(profileId: string, papel: PapelEnsino) {
    setErro(null)
    startSalvar(async () => {
      const r = await definirPapelAction(profileId, papel)
      if (!r.ok) { setErro(r.erro); return }
      setOpen(false)
      setTermo('')
      setResultados([])
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlus className="h-4 w-4" />
        Adicionar professor
      </DialogTrigger>

      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar à equipe do Ensino</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={termo}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Buscar membro pelo nome..."
              className="pl-8"
              autoFocus
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {buscando && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!buscando && termo.trim().length >= 2 && resultados.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Ninguém encontrado com esse nome.
            </p>
          )}

          {resultados.length > 0 && (
            <div className="rounded-xl border border-border divide-y overflow-hidden">
              {resultados.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        referrerPolicy="no-referrer"
                        src={p.avatarUrl}
                        alt={p.nome}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      p.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight truncate">{p.nome}</p>
                    {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => adicionar(p.id, 'professor')}
                    disabled={salvando}
                  >
                    Professor
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
