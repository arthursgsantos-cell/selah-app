'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { GraduationCap, ImagePlus, X, Pencil } from 'lucide-react'
import { DIAS_SEMANA } from '@/lib/dia-semana'
import { criarTurmaAction, editarTurmaAction, uploadCapaEnsinoAction } from '@/app/actions/ensino/turmas'
import { criarCursoAction } from '@/app/actions/ensino/cursos'
import type { StatusTurma } from '@/lib/supabase/types'

const campoClass =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

export interface TurmaParaEditar {
  id: string
  cursoId: string
  nome: string
  descricao: string | null
  capaUrl: string | null
  local: string | null
  dataInicio: string | null
  dataFim: string | null
  diasSemana: number[]
  horarioInicio: string | null
  horarioFim: string | null
  totalAulas: number | null
  vagas: number | null
  inscricoesAbertas: boolean
  aprovacaoAutomatica: boolean
  status: StatusTurma
  whatsappUrl: string | null
}

interface Props {
  cursos: { id: string; nome: string }[]
  turma?: TurmaParaEditar
}

/** "19:30:00" vindo do Postgres → "19:30" para o input type=time. */
function hhmm(valor: string | null): string {
  return valor ? valor.slice(0, 5) : ''
}

export function CriarTurmaDialog({ cursos, turma }: Props) {
  const editando = turma !== undefined
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [cursoId, setCursoId] = useState(turma?.cursoId ?? cursos[0]?.id ?? '')
  const [novoCurso, setNovoCurso] = useState('')
  const [nome, setNome] = useState(turma?.nome ?? '')
  const [descricao, setDescricao] = useState(turma?.descricao ?? '')
  const [local, setLocal] = useState(turma?.local ?? '')
  const [dataInicio, setDataInicio] = useState(turma?.dataInicio ?? '')
  const [dataFim, setDataFim] = useState(turma?.dataFim ?? '')
  const [dias, setDias] = useState<number[]>(turma?.diasSemana ?? [])
  const [horarioInicio, setHorarioInicio] = useState(hhmm(turma?.horarioInicio ?? null))
  const [horarioFim, setHorarioFim] = useState(hhmm(turma?.horarioFim ?? null))
  const [totalAulas, setTotalAulas] = useState(turma?.totalAulas?.toString() ?? '')
  const [vagas, setVagas] = useState(turma?.vagas?.toString() ?? '')
  const [inscricoesAbertas, setInscricoesAbertas] = useState(turma?.inscricoesAbertas ?? true)
  const [aprovacaoAutomatica, setAprovacaoAutomatica] = useState(turma?.aprovacaoAutomatica ?? true)
  const [status, setStatus] = useState<StatusTurma>(turma?.status ?? 'aberta')
  const [whatsappUrl, setWhatsappUrl] = useState(turma?.whatsappUrl ?? '')
  const [capaFile, setCapaFile] = useState<File | null>(null)
  const [capaPreview, setCapaPreview] = useState<string | null>(turma?.capaUrl ?? null)

  const semCursos = cursos.length === 0

  function alternarDia(valor: number) {
    setDias((atual) =>
      atual.includes(valor) ? atual.filter((d) => d !== valor) : [...atual, valor].sort()
    )
  }

  function trocarCapa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCapaFile(file)
    setCapaPreview(URL.createObjectURL(file))
  }

  function removerCapa() {
    setCapaFile(null)
    setCapaPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setErro(null)

    startTransition(async () => {
      try {
        // Sem nenhum curso cadastrado, o professor digita o nome aqui mesmo:
        // obrigar a criar o curso numa tela anterior travaria a primeira turma.
        let curso = cursoId
        if (!curso && novoCurso.trim()) {
          const criado = await criarCursoAction({ nome: novoCurso.trim() })
          if (!criado.ok) { setErro(criado.erro); return }
          curso = criado.id
        }
        if (!curso) { setErro('Escolha ou crie um curso.'); return }

        let capaUrl = turma?.capaUrl ?? null
        if (capaFile) {
          const fd = new FormData()
          fd.append('file', capaFile)
          capaUrl = await uploadCapaEnsinoAction(fd)
        } else if (capaPreview === null) {
          capaUrl = null
        }

        const dados = {
          cursoId: curso,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          capaUrl,
          local: local.trim() || null,
          dataInicio: dataInicio || null,
          dataFim: dataFim || null,
          diasSemana: dias,
          horarioInicio: horarioInicio || null,
          horarioFim: horarioFim || null,
          totalAulas: totalAulas ? Number(totalAulas) : null,
          vagas: vagas ? Number(vagas) : null,
          inscricoesAbertas,
          aprovacaoAutomatica,
          status,
          whatsappUrl: whatsappUrl.trim() || null,
        }

        const resultado = editando
          ? await editarTurmaAction(turma!.id, dados)
          : await criarTurmaAction(dados)

        if (!resultado.ok) { setErro(resultado.erro); return }

        setOpen(false)
        router.refresh()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Não foi possível salvar a turma.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={editando ? 'ghost' : 'outline'} />}>
        {editando ? (
          <>
            <Pencil className="h-4 w-4" />
            Editar
          </>
        ) : (
          <>
            <GraduationCap className="h-4 w-4" />
            Nova turma
          </>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar turma' : 'Nova turma'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submeter} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="curso">Curso</Label>
            {semCursos ? (
              <>
                <Input
                  id="curso"
                  placeholder="Ex: Fundamentos da Fé"
                  value={novoCurso}
                  onChange={(e) => setNovoCurso(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nenhum curso cadastrado ainda — este será o primeiro.
                </p>
              </>
            ) : (
              <select
                id="curso"
                value={cursoId}
                onChange={(e) => setCursoId(e.target.value)}
                className={campoClass}
              >
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da turma</Label>
            <Input
              id="nome"
              placeholder="Ex: Turma da manhã — 1º semestre"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Dias das aulas</Label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.valor}
                  type="button"
                  onClick={() => alternarDia(d.valor)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                    dias.includes(d.valor)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {d.curto}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="hi">Começa às</Label>
              <input
                id="hi"
                type="time"
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(e.target.value)}
                className={campoClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf">Termina às</Label>
              <input
                id="hf"
                type="time"
                value={horarioFim}
                onChange={(e) => setHorarioFim(e.target.value)}
                className={campoClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="di">Início</Label>
              <input
                id="di"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={campoClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="df">Término</Label>
              <input
                id="df"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                min={dataInicio || undefined}
                className={campoClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="aulas">Nº de aulas</Label>
              <Input
                id="aulas"
                type="number"
                min={1}
                placeholder="12"
                value={totalAulas}
                onChange={(e) => setTotalAulas(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vagas">Vagas</Label>
              <Input
                id="vagas"
                type="number"
                min={1}
                placeholder="sem limite"
                value={vagas}
                onChange={(e) => setVagas(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="local">Local</Label>
            <Input
              id="local"
              placeholder="Ex: Sala 2 — Templo"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Capa (opcional)</Label>
            <label
              htmlFor="capa-turma"
              className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-lg cursor-pointer overflow-hidden hover:bg-accent/30 transition-colors"
            >
              {capaPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capaPreview} alt="Prévia da capa" className="absolute inset-0 w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); removerCapa() }}
                    className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground pointer-events-none">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Clique para importar capa</span>
                  <span className="text-[10px] opacity-60">JPG, PNG, WebP · max 5 MB</span>
                </div>
              )}
              <input
                ref={fileRef}
                id="capa-turma"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={trocarCapa}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Textarea
              id="desc"
              placeholder="O que a turma vai estudar..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="zap">Grupo no WhatsApp (opcional)</Label>
            <Input
              id="zap"
              placeholder="https://chat.whatsapp.com/..."
              value={whatsappUrl}
              onChange={(e) => setWhatsappUrl(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inscricoesAbertas}
                onChange={(e) => setInscricoesAbertas(e.target.checked)}
                className="rounded border-input h-4 w-4 accent-primary"
              />
              <span className="text-sm">Aceitar novas inscrições</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={aprovacaoAutomatica}
                onChange={(e) => setAprovacaoAutomatica(e.target.checked)}
                className="rounded border-input h-4 w-4 accent-primary"
              />
              <span className="text-sm">Aprovar inscrições automaticamente</span>
            </label>
            <p className="text-xs text-muted-foreground pl-6.5">
              Desmarcado, cada pedido fica pendente até você aprovar.
            </p>
          </div>

          {editando && (
            <div className="space-y-1.5">
              <Label htmlFor="status">Situação da turma</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusTurma)}
                className={campoClass}
              >
                <option value="aberta">Inscrições abertas</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={!nome.trim() || isPending}>
              {isPending ? 'Salvando...' : editando ? 'Salvar' : 'Criar turma'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
