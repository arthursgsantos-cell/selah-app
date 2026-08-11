'use client'

import { useState, useTransition, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ImagePlus, X, Loader2, Calculator, Video, UserPlus, Search, ListPlus, Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { DIAS_SEMANA } from '@/lib/dia-semana'
import { contarAulasNoPeriodo } from '@/lib/ensino/turma'
import {
  criarTurmaAction, editarTurmaAction, uploadCapaEnsinoAction,
} from '@/app/actions/ensino/turmas'
import { criarCursoAction } from '@/app/actions/ensino/cursos'
import {
  InscricaoTurmaFields, type InscricaoTurmaValue,
} from '@/components/ensino/inscricao-turma-fields'
import {
  buscarPessoasParaProfessor, cadastrarProfessorSemContaAction,
  type CandidatoProfessor,
} from '@/app/actions/ensino/equipe'
import type { ProfessorDaTurma } from '@/lib/ensino/tipos'
import type {
  ModoTurma, ModoVideoChamada, StatusTurma, TipoInscricaoTurma,
} from '@/lib/supabase/types'

const campoClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

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
  modo: ModoTurma
  sequencial: boolean
  whatsappUrl: string | null
  tipoInscricao: TipoInscricaoTurma
  linkInscricaoUrl: string | null
  formularioId: string | null
  videoChamadaModo: ModoVideoChamada
  videoChamadaUrl: string | null
}

const ORIGEM: Record<CandidatoProfessor['origem'], string> = {
  equipe: 'Equipe do Ensino',
  lideranca: 'Liderança da igreja',
  turma: 'Já leciona esta turma',
  sem_conta: 'Ainda sem conta no app',
}

/** Perfil e pré-cadastro podem ter o mesmo uuid; a chave da lista precisa dos dois. */
function chaveDe(pessoa: ProfessorDaTurma | CandidatoProfessor): string {
  return `${pessoa.tipo}:${pessoa.id}`
}

function iniciais(nome: string): string {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function Retrato({ nome, avatarUrl }: { nome: string; avatarUrl: string | null }) {
  return (
    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          referrerPolicy="no-referrer"
          src={avatarUrl}
          alt={nome}
          className="h-full w-full object-cover"
        />
      ) : (
        iniciais(nome)
      )}
    </span>
  )
}

function hhmm(valor: string | null): string {
  return valor ? valor.slice(0, 5) : ''
}

/**
 * Formulário de turma — página inteira, não diálogo.
 *
 * Era um modal, e um clique fora perdia tudo o que estava digitado. Pelo mesmo
 * motivo da chamada, virou página: dá para recarregar, voltar e conferir sem
 * medo, e o navegador ainda avisa se houver alteração não salva.
 */
export function TurmaForm({
  cursos,
  turma,
  candidatos,
  professoresIniciais = [],
}: {
  cursos: { id: string; nome: string }[]
  turma?: TurmaParaEditar
  /**
   * Quem pode lecionar. Só a coordenação troca a equipe da turma, então a
   * página manda a lista só para ela — sem lista, a seção não aparece e o
   * formulário não mexe nos professores.
   */
  candidatos?: CandidatoProfessor[]
  /** Equipe atual da turma, ou quem está criando. O primeiro é o principal. */
  professoresIniciais?: ProfessorDaTurma[]
}) {
  const editando = turma !== undefined
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [sujo, setSujo] = useState(false)
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
  const [modo, setModo] = useState<ModoTurma>(turma?.modo ?? 'presencial')
  const [sequencial, setSequencial] = useState(turma?.sequencial ?? false)
  const [professores, setProfessores] = useState<ProfessorDaTurma[]>(professoresIniciais)
  // A lista cresce com quem a busca traz: a seção mostra a equipe do Ensino e a
  // liderança, e a turma pode ser dada por qualquer pessoa da igreja.
  const [listaProfessores, setListaProfessores] = useState<CandidatoProfessor[]>(candidatos ?? [])
  const [capaFile, setCapaFile] = useState<File | null>(null)
  const [capaPreview, setCapaPreview] = useState<string | null>(turma?.capaUrl ?? null)

  const [videoModo, setVideoModo] = useState<ModoVideoChamada>(
    turma?.videoChamadaModo ?? 'nenhum'
  )
  const [videoUrl, setVideoUrl] = useState(turma?.videoChamadaUrl ?? '')

  const [inscricao, setInscricao] = useState<InscricaoTurmaValue>({
    tipo: turma?.tipoInscricao ?? 'app',
    formularioId: turma?.formularioId ?? '',
    linkUrl: turma?.linkInscricaoUrl ?? '',
    grupoUrl: turma?.whatsappUrl ?? '',
  })

  // Numa turma nova o campo ainda não foi tocado, então acompanha o cálculo.
  // Numa turma existente o número já foi decidido: respeitá-lo desde o início
  // evita sobrescrever um ajuste manual feito por causa de feriado.
  const [aulasManual, setAulasManual] = useState(editando && turma?.totalAulas !== null)

  const aulasCalculadas = useMemo(
    () => contarAulasNoPeriodo(dataInicio, dataFim, dias),
    [dataInicio, dataFim, dias]
  )

  useEffect(() => {
    if (!aulasManual && aulasCalculadas !== null) {
      setTotalAulas(String(aulasCalculadas))
    }
  }, [aulasCalculadas, aulasManual])

  // Aviso do navegador ao fechar a aba com alteração pendente.
  useEffect(() => {
    if (!sujo) return
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  function marcar<T>(setter: (v: T) => void) {
    return (v: T) => { setSujo(true); setter(v) }
  }

  function alternarDia(valor: number) {
    setSujo(true)
    setDias((atual) =>
      atual.includes(valor) ? atual.filter((d) => d !== valor) : [...atual, valor].sort()
    )
  }

  function alternarProfessor(pessoa: ProfessorDaTurma) {
    setSujo(true)
    const chave = chaveDe(pessoa)
    setProfessores((atual) =>
      atual.some((p) => chaveDe(p) === chave)
        ? atual.filter((p) => chaveDe(p) !== chave)
        : [...atual, { tipo: pessoa.tipo, id: pessoa.id }]
    )
  }

  // Principal é posição, não campo: a primeira da lista é a que a turma mostra
  // primeiro, e promover alguém é trazê-lo para a frente.
  function tornarPrincipal(pessoa: ProfessorDaTurma) {
    setSujo(true)
    const chave = chaveDe(pessoa)
    setProfessores((atual) => [
      { tipo: pessoa.tipo, id: pessoa.id },
      ...atual.filter((p) => chaveDe(p) !== chave),
    ])
  }

  /** Quem veio da busca ou do cadastro entra na lista já marcado. */
  function incluirProfessor(pessoa: CandidatoProfessor) {
    setSujo(true)
    const chave = chaveDe(pessoa)
    setListaProfessores((atual) =>
      atual.some((c) => chaveDe(c) === chave) ? atual : [...atual, pessoa]
    )
    setProfessores((atual) =>
      atual.some((p) => chaveDe(p) === chave) ? atual : [...atual, { tipo: pessoa.tipo, id: pessoa.id }]
    )
  }

  function trocarCapa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSujo(true)
    setCapaFile(file)
    setCapaPreview(URL.createObjectURL(file))
  }

  function removerCapa() {
    setSujo(true)
    setCapaFile(null)
    setCapaPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const semCursos = cursos.length === 0
  const divergiu = aulasManual && aulasCalculadas !== null && totalAulas !== String(aulasCalculadas)

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setErro(null)

    if (inscricao.tipo === 'link' && !inscricao.linkUrl.trim()) {
      setErro('Informe o endereço do formulário externo.')
      return
    }
    // Sem o grupo a inscrição por WhatsApp não teria destino: é para lá que o
    // botão leva, e é entrando nele que o aluno confirma.
    if (inscricao.tipo === 'whatsapp' && !inscricao.grupoUrl.trim()) {
      setErro('Informe o link do grupo no WhatsApp — é o destino da inscrição.')
      return
    }
    if (inscricao.tipo === 'formulario' && !inscricao.formularioId) {
      setErro('Escolha o formulário com as perguntas extras.')
      return
    }
    if (videoModo === 'turma' && !videoUrl.trim()) {
      setErro('Informe o link da videochamada do curso.')
      return
    }
    // Turma sem professor ficaria sem ninguém capaz de fazer a chamada.
    if (candidatos && professores.length === 0) {
      setErro('Escolha pelo menos um professor para a turma.')
      return
    }

    startTransition(async () => {
      try {
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
          modo,
          sequencial,
          whatsappUrl: inscricao.grupoUrl.trim() || null,
          tipoInscricao: inscricao.tipo,
          linkInscricaoUrl: inscricao.linkUrl.trim() || null,
          formularioId: inscricao.tipo === 'formulario' ? inscricao.formularioId || null : null,
          // Turma gravada não tem encontro para acontecer ao vivo — a escolha
          // nem aparece nela, e um valor herdado de outro modo não sobrevive.
          videoChamadaModo: modo === 'gravado' ? 'nenhum' : videoModo,
          videoChamadaUrl: videoModo === 'turma' ? videoUrl.trim() || null : null,
          // Sem a seção na tela a equipe não vai no pacote: mandar a lista
          // vazia apagaria os professores de quem só pode editar a turma.
          professores: candidatos ? professores : undefined,
        }

        // Editar e criar devolvem formatos diferentes — só a criação traz o id
        // da turma nova —, então cada uma resolve o destino do redirecionamento.
        let destino: string
        if (turma) {
          const r = await editarTurmaAction(turma.id, dados)
          if (!r.ok) { setErro(r.erro); return }
          destino = turma.id
        } else {
          const r = await criarTurmaAction(dados)
          if (!r.ok) { setErro(r.erro); return }
          destino = r.id
        }

        setSujo(false)
        router.push(`/ensino/turma/${destino}`)
        router.refresh()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Não foi possível salvar a turma.')
      }
    })
  }

  return (
    <form onSubmit={submeter} className="space-y-6">
      <Secao titulo="Curso e turma">
        <div className="space-y-1.5">
          <Label htmlFor="curso">Curso</Label>
          {semCursos ? (
            <>
              <Input
                id="curso"
                placeholder="Ex: Fundamentos da Fé"
                value={novoCurso}
                onChange={(e) => marcar(setNovoCurso)(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nenhum curso cadastrado ainda — este será o primeiro.
              </p>
            </>
          ) : (
            <select
              id="curso"
              value={cursoId}
              onChange={(e) => marcar(setCursoId)(e.target.value)}
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
            placeholder="Ex: Panorama do Antigo Testamento"
            value={nome}
            onChange={(e) => marcar(setNome)(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Descrição (opcional)</Label>
          <Textarea
            id="desc"
            placeholder="O que a turma vai estudar..."
            value={descricao}
            onChange={(e) => marcar(setDescricao)(e.target.value)}
            rows={3}
          />
        </div>

        {/* Presencial x gravado. É o que decide se a turma tem calendário e
            chamada ou se é catálogo, com o aluno marcando o que já assistiu. */}
        <div className="space-y-1.5">
          <Label>Como acontece</Label>
          <div className="flex gap-1.5">
            {([
              { valor: 'presencial', label: 'Encontros', ajuda: 'Com data, chamada e frequência' },
              { valor: 'gravado', label: 'Gravado', ajuda: 'O aluno assiste no ritmo dele' },
            ] as const).map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => marcar(setModo)(o.valor)}
                aria-pressed={modo === o.valor}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  modo === o.valor
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {o.ajuda}
                </span>
              </button>
            ))}
          </div>
        </div>

        {modo === 'gravado' && (
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sequencial}
              onChange={(e) => marcar(setSequencial)(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Liberar as aulas em ordem</span>
              <span className="block text-xs text-muted-foreground leading-snug">
                A aula seguinte só abre depois que o aluno concluir a anterior.
              </span>
            </span>
          </label>
        )}

        {modo === 'gravado' && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted px-3 py-2 leading-relaxed">
            Em turma gravada não há chamada nem data de aula: o aluno marca cada
            aula como assistida e a turma acompanha o progresso. O vídeo de cada
            aula é um material do tipo vídeo com o link do YouTube.
          </p>
        )}
      </Secao>

      {/* Quem dá aula. Só a coordenação recebe `candidatos` — professor edita a
          turma, mas não escolhe quem entra nela. */}
      {candidatos && (
        <Secao titulo="Professores">
          {listaProfessores.length > 0 && (
            <div className="rounded-xl border border-border divide-y overflow-hidden">
              {listaProfessores.map((c) => {
                const posicao = professores.findIndex((p) => chaveDe(p) === chaveDe(c))
                const campoId = `prof-${chaveDe(c)}`
                return (
                  <div key={chaveDe(c)} className="flex items-center gap-3 px-3 py-2.5">
                    <input
                      id={campoId}
                      type="checkbox"
                      checked={posicao >= 0}
                      onChange={() => alternarProfessor(c)}
                      className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                    />
                    <label
                      htmlFor={campoId}
                      className="flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer"
                    >
                      <Retrato nome={c.nome} avatarUrl={c.avatarUrl} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-tight truncate">
                          {c.nome}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {ORIGEM[c.origem]}
                        </span>
                      </span>
                    </label>

                    {posicao === 0 && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        principal
                      </span>
                    )}
                    {posicao > 0 && (
                      <button
                        type="button"
                        onClick={() => tornarPrincipal(c)}
                        className="shrink-0 text-xs text-primary hover:underline"
                      >
                        tornar principal
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <AdicionarProfessorDialog onEscolher={incluirProfessor} />

          <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
            <Smartphone className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Quem está marcado aqui faz chamada, cadastra aulas e publica materiais desta
              turma. O principal é o nome que aparece primeiro. Professor sem conta no app
              aparece como nome na turma; quando ele criar a conta, passa a administrar a
              turma sozinho.
            </span>
          </p>
        </Secao>
      )}

      {/* Turma gravada não tem calendário: não há dia da semana, horário nem
          sala. O que resta de "quando" é a data em que cada aula foi publicada,
          e essa o próprio cadastro da aula guarda. */}
      {modo !== 'gravado' && (
      <Secao titulo="Quando e onde">
        <div className="space-y-1.5">
          <Label>Dias das aulas</Label>
          <div className="flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map((d) => (
              <button
                key={d.valor}
                type="button"
                onClick={() => alternarDia(d.valor)}
                aria-pressed={dias.includes(d.valor)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hi">Começa às</Label>
            <input
              id="hi" type="time" value={horarioInicio}
              onChange={(e) => marcar(setHorarioInicio)(e.target.value)}
              className={campoClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hf">Termina às</Label>
            <input
              id="hf" type="time" value={horarioFim}
              onChange={(e) => marcar(setHorarioFim)(e.target.value)}
              className={campoClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="di">Início</Label>
            <input
              id="di" type="date" value={dataInicio}
              onChange={(e) => marcar(setDataInicio)(e.target.value)}
              className={campoClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="df">Término</Label>
            <input
              id="df" type="date" value={dataFim}
              min={dataInicio || undefined}
              onChange={(e) => marcar(setDataFim)(e.target.value)}
              className={campoClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="local">Local</Label>
          <Input
            id="local"
            placeholder="Ex: Sala 2 — Templo"
            value={local}
            onChange={(e) => marcar(setLocal)(e.target.value)}
          />
        </div>

        {/* Turma que se encontra online. A sala pode ser fixa para o curso
            inteiro ou nascer a cada aula — quem agenda pelo Google Agenda cai
            no segundo caso, e um link só não serviria. */}
        <div className="space-y-1.5">
          <Label>Videochamada</Label>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {([
              { valor: 'nenhum', label: 'Não usa', ajuda: 'Encontro presencial' },
              { valor: 'turma', label: 'Um link só', ajuda: 'A mesma sala em todas as aulas' },
              { valor: 'aula', label: 'Um por aula', ajuda: 'Cada aula com o seu link' },
            ] as const).map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => marcar(setVideoModo)(o.valor)}
                aria-pressed={videoModo === o.valor}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  videoModo === o.valor
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {o.ajuda}
                </span>
              </button>
            ))}
          </div>
        </div>

        {videoModo === 'turma' && (
          <div className="space-y-1.5">
            <Label htmlFor="video-url">Link da sala</Label>
            <Input
              id="video-url"
              type="url"
              placeholder="https://meet.google.com/..."
              value={videoUrl}
              onChange={(e) => marcar(setVideoUrl)(e.target.value)}
            />
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Video className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Meet, Zoom, Teams — qualquer um. O botão &ldquo;Entrar na
                videochamada&rdquo; aparece em todas as aulas para quem está na turma.
              </span>
            </p>
          </div>
        )}

        {videoModo === 'aula' && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Video className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              O link de cada encontro é colado na própria aula, em &ldquo;Aulas e
              chamada&rdquo;. Enquanto faltar, a aula avisa que o link ainda não foi
              publicado.
            </span>
          </p>
        )}
      </Secao>
      )}

      <Secao titulo="Aulas e vagas">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="aulas">Nº de aulas</Label>
            <Input
              id="aulas"
              type="number"
              min={1}
              placeholder={aulasCalculadas !== null ? String(aulasCalculadas) : '12'}
              value={totalAulas}
              onChange={(e) => {
                setSujo(true)
                setAulasManual(true)
                setTotalAulas(e.target.value)
              }}
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
              onChange={(e) => marcar(setVagas)(e.target.value)}
            />
          </div>
        </div>

        {modo === 'gravado' && (
          <p className="text-xs text-muted-foreground">
            É o número que a turma vai usar em &quot;Gerar aulas&quot; para criar
            todas de uma vez, já numeradas — depois é só pôr o vídeo e o texto de
            cada uma.
          </p>
        )}

        {modo !== 'gravado' && aulasCalculadas !== null && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Calculator className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              O período informado dá{' '}
              <strong>{aulasCalculadas} {aulasCalculadas === 1 ? 'aula' : 'aulas'}</strong>.
              {divergiu ? (
                <>
                  {' '}Você definiu {totalAulas || '—'}.{' '}
                  <button
                    type="button"
                    onClick={() => { setAulasManual(false); setTotalAulas(String(aulasCalculadas)) }}
                    className="text-primary hover:underline font-medium"
                  >
                    usar {aulasCalculadas}
                  </button>
                </>
              ) : (
                ' Dá para alterar se houver feriado ou aula extra.'
              )}
            </span>
          </p>
        )}
        {modo !== 'gravado' && aulasCalculadas === null && (
          <p className="text-xs text-muted-foreground">
            Preencha os dias das aulas e o período para o número ser calculado sozinho.
          </p>
        )}
      </Secao>

      <Secao titulo="Inscrições">
        <InscricaoTurmaFields value={inscricao} onChange={(v) => { setSujo(true); setInscricao(v) }} />

        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={inscricoesAbertas}
              onChange={(e) => marcar(setInscricoesAbertas)(e.target.checked)}
              className="rounded border-input h-4 w-4 accent-primary"
            />
            <span className="text-sm">Aceitar novas inscrições</span>
          </label>

          {(inscricao.tipo === 'app' || inscricao.tipo === 'formulario') && (
            <>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aprovacaoAutomatica}
                  onChange={(e) => marcar(setAprovacaoAutomatica)(e.target.checked)}
                  className="rounded border-input h-4 w-4 accent-primary"
                />
                <span className="text-sm">Aprovar inscrições automaticamente</span>
              </label>
              <p className="text-xs text-muted-foreground pl-6.5">
                Desmarcado, cada pedido fica pendente até você aprovar.
              </p>
            </>
          )}
        </div>

      </Secao>

      <Secao titulo="Aparência">
        <div className="space-y-1.5">
          <Label>Capa (opcional)</Label>
          <label
            htmlFor="capa-turma"
            className="relative flex flex-col items-center justify-center w-full aspect-[16/9] max-h-56 border-2 border-dashed border-input rounded-xl cursor-pointer overflow-hidden hover:bg-accent/30 transition-colors"
          >
            {capaPreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capaPreview}
                  alt="Prévia da capa"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); removerCapa() }}
                  aria-label="Remover capa"
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground pointer-events-none">
                <ImagePlus className="h-7 w-7" />
                <span className="text-sm">Clique para importar a capa</span>
                <span className="text-xs opacity-60">JPG, PNG, WebP · até 5 MB</span>
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

        {editando && (
          <div className="space-y-1.5">
            <Label htmlFor="status">Situação da turma</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => marcar(setStatus)(e.target.value as StatusTurma)}
              className={campoClass}
            >
              <option value="aberta">Inscrições abertas</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        )}
      </Secao>

      {erro && (
        <p className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {/* Barra de ação fixa: no celular o formulário é longo, e procurar o botão
          de salvar rolando até o fim é atrito desnecessário. */}
      <div className="sticky bottom-0 -mx-4 md:mx-0 border-t bg-background/95 backdrop-blur px-4 py-3 md:rounded-2xl md:border flex items-center gap-2">
        <Button type="submit" disabled={!nome.trim() || isPending} className="flex-1 sm:flex-none">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar turma'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          render={<Link href={editando ? `/ensino/turma/${turma!.id}` : '/ensino'} />}
        >
          Cancelar
        </Button>
        {sujo && (
          <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
            alterações não salvas
          </span>
        )}
      </div>
    </form>
  )
}

/**
 * Achar ou cadastrar quem vai dar aula.
 *
 * Mesma tela do cadastro de aluno (`adicionar-aluno.tsx`) e pela mesma razão: um
 * campo só, que **busca** quem o app já conhece enquanto **serve de formulário**
 * para quem ele não conhece. Aqui não grava vínculo com a turma — devolve a
 * pessoa para a lista do formulário, que é salva junto com o resto. É o que faz
 * o diálogo servir também à turma que ainda não existe.
 */
function AdicionarProfessorDialog({
  onEscolher,
}: {
  onEscolher: (pessoa: CandidatoProfessor) => void
}) {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [resultados, setResultados] = useState<CandidatoProfessor[]>([])
  const [buscando, setBuscando] = useState(false)
  const [salvando, startSalvar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  // Cada busca leva o número da vez: resposta antiga que chega atrasada é
  // descartada em vez de sobrescrever a lista do termo atual.
  const buscaAtual = useRef(0)
  const termo = nome.trim()

  useEffect(() => {
    if (!open || termo.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }

    const vez = ++buscaAtual.current
    setBuscando(true)

    // Espera a digitação parar: sem isso, "Maria Aparecida" dispararia quinze
    // consultas para chegar ao mesmo resultado.
    const timer = setTimeout(async () => {
      const achados = await buscarPessoasParaProfessor(termo)
      if (vez !== buscaAtual.current) return
      setResultados(achados)
      setBuscando(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [open, termo])

  function fechar() {
    setOpen(false)
    setNome(''); setTelefone(''); setEmail('')
    setResultados([]); setErro(null)
  }

  function escolher(pessoa: CandidatoProfessor) {
    onEscolher(pessoa)
    fechar()
  }

  function cadastrarNovo() {
    setErro(null)
    startSalvar(async () => {
      const r = await cadastrarProfessorSemContaAction({ nome, telefone, email })
      if (!r.ok) { setErro(r.erro); return }
      escolher(r.pessoa)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(aberto) => (aberto ? setOpen(true) : fechar())}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <UserPlus className="h-4 w-4" />
        Adicionar professor
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar professor à turma</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do professor"
              className="pl-8"
              autoFocus
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {termo.length >= 2 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                Já cadastrados na igreja
                {buscando && <Loader2 className="h-3 w-3 animate-spin" />}
              </p>

              {!buscando && resultados.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Ninguém com esse nome. Cadastre abaixo.
                </p>
              ) : (
                <div className="rounded-xl border border-border divide-y overflow-hidden">
                  {resultados.map((p) => (
                    <div key={chaveDe(p)} className="flex items-center gap-2.5 px-2.5 py-2">
                      <Retrato nome={p.nome} avatarUrl={p.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight truncate">{p.nome}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {p.tipo === 'profile' ? 'usa o app' : 'na lista da igreja'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => escolher(p)}
                        disabled={salvando}
                      >
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cadastro na mão */}
          <div className="rounded-xl border border-border p-3 space-y-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Cadastrar na mão
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Telefone (opcional)"
                inputMode="tel"
              />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail (opcional)"
                inputMode="email"
                autoCapitalize="none"
              />
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={cadastrarNovo}
              disabled={salvando || termo.length < 2}
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
              {termo.length >= 2 ? `Cadastrar ${termo}` : 'Cadastrar professor'}
            </Button>

            <p className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5">
              <Smartphone className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>
                Só o nome é obrigatório. A pessoa entra na lista da igreja e o nome já
                aparece na turma — quando ela criar a conta, passa a administrar a turma.
              </span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {titulo}
      </h2>
      {children}
    </section>
  )
}
