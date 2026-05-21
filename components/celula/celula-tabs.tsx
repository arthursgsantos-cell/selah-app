'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, Cake, ChevronRight, Heart, MapPin, Users, Navigation, Search, X, ImageIcon, MessageCircle } from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays, differenceInYears, differenceInMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CriarEncontroDialog } from '@/components/celula/criar-encontro-dialog'
import { GaleriaCelulaTab } from '@/components/celula/galeria-celula-tab'

interface Membro {
  user_id: string
  nome: string
  avatar_url: string | null
  conjuge_id: string | null
  papel: 'lider' | 'membro'
  data_nascimento_1: string | null
  data_nascimento_2: string | null
  data_casamento: string | null
  endereco: string | null
  endereco_maps: string | null
}

interface Encontro {
  id: string
  data_hora: string
  local: string | null
  local_maps_url: string | null
  status: string
  card_imagem_url: string | null
}

interface Dependente {
  profile_id: string
  nome: string
  data_nascimento: string | null
  tipo: string
}

interface Props {
  encontros: Encontro[]
  membros: Membro[]
  celulaId: string
  celulaNome: string
  localPadrao: string | null
  dependentes?: Dependente[]
  celulaColor?: string | null
  fotosInit?: { id: string; url: string }[]
  canUpload?: boolean
}

const papelLabel = { lider: 'Líder', membro: 'Membro' }
const papelColor = {
  lider: 'bg-green-100 text-green-700',
  membro: 'bg-gray-100 text-gray-600',
}

const statusConfig = {
  agendado: { label: 'Agendado', className: 'bg-blue-100 text-blue-700' },
  realizado: { label: 'Realizado', className: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
}

function getNextOccurrence(dataStr: string): Date {
  const [, mm, dd] = dataStr.split('-')
  const hoje = new Date()
  const ano = hoje.getFullYear()
  let prox = new Date(ano, parseInt(mm, 10) - 1, parseInt(dd, 10))
  if (prox < hoje) prox = new Date(ano + 1, parseInt(mm, 10) - 1, parseInt(dd, 10))
  return prox
}

function diasAte(dataStr: string): number {
  return differenceInDays(getNextOccurrence(dataStr), new Date())
}

function isDataNoMesAtual(data: string | null): boolean {
  if (!data) return false
  return parseInt(data.slice(5, 7), 10) === new Date().getMonth() + 1
}

function formatarDataCurta(data: string): string {
  const [, mm, dd] = data.split('-')
  const d = new Date(2000, parseInt(mm, 10) - 1, parseInt(dd, 10))
  return format(d, "d 'de' MMMM", { locale: ptBR })
}

const BODAS: Record<number, string> = {
  1: 'Bodas de Papel',
  2: 'Bodas de Algodão',
  3: 'Bodas de Trigo',
  4: 'Bodas de Flores',
  5: 'Bodas de Madeira',
  6: 'Bodas de Açúcar',
  7: 'Bodas de Lã',
  8: 'Bodas de Barro',
  9: 'Bodas de Cerâmica',
  10: 'Bodas de Estanho',
  11: 'Bodas de Aço',
  12: 'Bodas de Seda',
  13: 'Bodas de Linho',
  14: 'Bodas de Marfim',
  15: 'Bodas de Cristal',
  16: 'Bodas de Turmalina',
  17: 'Bodas de Rosa',
  18: 'Bodas de Turquesa',
  19: 'Bodas de Água-marinha',
  20: 'Bodas de Porcelana',
  21: 'Bodas de Zircão',
  22: 'Bodas de Louça',
  23: 'Bodas de Palha',
  24: 'Bodas de Opala',
  25: 'Bodas de Prata',
  26: 'Bodas de Alexandrita',
  27: 'Bodas de Crisopázio',
  28: 'Bodas de Hematita',
  29: 'Bodas de Erva',
  30: 'Bodas de Pérola',
  31: 'Bodas de Nácar',
  32: 'Bodas de Pinho',
  33: 'Bodas de Crizo',
  34: 'Bodas de Oliveira',
  35: 'Bodas de Coral',
  36: 'Bodas de Cedro',
  37: 'Bodas de Aventurina',
  38: 'Bodas de Carvalho',
  39: 'Bodas de Mármore',
  40: 'Bodas de Esmeralda',
  41: 'Bodas de Seda',
  42: 'Bodas de Prata Dourada',
  43: 'Bodas de Azeviche',
  44: 'Bodas de Carbonato',
  45: 'Bodas de Rubi',
  46: 'Bodas de Alabastro',
  47: 'Bodas de Jaspe',
  48: 'Bodas de Granito',
  49: 'Bodas de Heliotrópio',
  50: 'Bodas de Ouro',
  51: 'Bodas de Bronze',
  52: 'Bodas de Argila',
  53: 'Bodas de Antimônio',
  54: 'Bodas de Níquel',
  55: 'Bodas de Ametista',
  56: 'Bodas de Malaquita',
  57: 'Bodas de Lápis Lazuli',
  58: 'Bodas de Vidro',
  59: 'Bodas de Cereja',
  60: 'Bodas de Diamante',
  61: 'Bodas de Cobre',
  62: 'Bodas de Telurita',
  63: 'Bodas de Sândalo',
  64: 'Bodas de Fabulita',
  65: 'Bodas de Platina',
  66: 'Bodas de Ébano',
  67: 'Bodas de Neve',
  68: 'Bodas de Chumbo',
  69: 'Bodas de Mercúrio',
  70: 'Bodas de Vinho',
}

interface CasamentoInfo {
  anosCompletos: number
  meses: number
  bodas: string | null
}

function calcCasamento(dataCasamento: string): CasamentoInfo | null {
  const anoMat = parseInt(dataCasamento.slice(0, 4), 10)
  if (!anoMat || anoMat < 1900) return null
  const hoje = new Date()
  const dataObj = new Date(dataCasamento)
  const anosCompletos = differenceInYears(hoje, dataObj)
  const meses = differenceInMonths(hoje, dataObj) - anosCompletos * 12
  const bodas = BODAS[anosCompletos] ?? null
  return { anosCompletos, meses, bodas }
}

interface AnivRow {
  tipo: 'aniversario' | 'casamento'
  nome: string
  subtitulo?: string
  avatar_url?: string | null
  data: string
  casamentoInfo?: CasamentoInfo
  daysUntil: number
  hoje: boolean
}

interface FamiliaGroup {
  key: string
  tipo: 'single' | 'casal'
  nomeA: string
  nomeB?: string
  rows: AnivRow[]
  proximoAniv: number
}

function makeRow(
  tipo: AnivRow['tipo'],
  nome: string,
  data: string,
  opts?: { subtitulo?: string; avatar_url?: string | null; casamentoInfo?: CasamentoInfo }
): AnivRow {
  const [, mm, dd] = data.split('-')
  const mesAniv = parseInt(mm, 10)
  const diaAniv = parseInt(dd, 10)
  const hoje = new Date()
  const isHoje = mesAniv === hoje.getMonth() + 1 && diaAniv === hoje.getDate()
  return {
    tipo,
    nome,
    data,
    subtitulo: opts?.subtitulo,
    avatar_url: opts?.avatar_url,
    casamentoInfo: opts?.casamentoInfo,
    daysUntil: isHoje ? 0 : diasAte(data),
    hoje: isHoje,
  }
}

function buildFamilias(membros: Membro[], dependentes: Dependente[]): FamiliaGroup[] {
  const seen = new Set<string>()
  const groups: FamiliaGroup[] = []

  for (const m of membros) {
    if (seen.has(m.user_id)) continue
    seen.add(m.user_id)

    const conjugeMembro = m.conjuge_id
      ? (membros.find((x) => x.user_id === m.conjuge_id) ?? null)
      : null
    if (conjugeMembro) seen.add(conjugeMembro.user_id)

    const conjugeDep = !conjugeMembro
      ? (dependentes.find((d) => d.profile_id === m.user_id && d.tipo === 'cônjuge') ?? null)
      : null

    const filhos = dependentes.filter((d) => {
      if (d.tipo !== 'filho') return false
      return d.profile_id === m.user_id || (conjugeMembro && d.profile_id === conjugeMembro.user_id)
    })

    const dataCasamento = m.data_casamento ?? conjugeMembro?.data_casamento ?? null

    const rows: AnivRow[] = []

    if (m.data_nascimento_1) {
      rows.push(makeRow('aniversario', m.nome, m.data_nascimento_1, { avatar_url: m.avatar_url }))
    }

    if (conjugeMembro?.data_nascimento_1) {
      rows.push(makeRow('aniversario', conjugeMembro.nome, conjugeMembro.data_nascimento_1, {
        avatar_url: conjugeMembro.avatar_url,
        subtitulo: 'Cônjuge',
      }))
    }

    if (conjugeDep?.data_nascimento) {
      rows.push(makeRow('aniversario', conjugeDep.nome, conjugeDep.data_nascimento, {
        subtitulo: 'Cônjuge',
      }))
    }

    if (dataCasamento) {
      const casamentoInfo = calcCasamento(dataCasamento)
      rows.push(makeRow('casamento', 'Aniversário de casamento', dataCasamento, {
        casamentoInfo: casamentoInfo ?? undefined,
      }))
    }

    for (const f of filhos) {
      if (!f.data_nascimento) continue
      const parentPrimeiro = membros.find((x) => x.user_id === f.profile_id)?.nome?.split(' ')[0]
      rows.push(makeRow('aniversario', f.nome, f.data_nascimento, {
        subtitulo: `Filho(a)${parentPrimeiro ? ` de ${parentPrimeiro}` : ''}`,
      }))
    }

    if (rows.length === 0) continue

    rows.sort((a, b) => a.daysUntil - b.daysUntil)

    const proximoAniv = Math.min(...rows.map((r) => r.daysUntil))
    const tipo = conjugeMembro || conjugeDep ? 'casal' : 'single'
    const nomeB = (conjugeMembro?.nome ?? conjugeDep?.nome)?.split(' ')[0]

    groups.push({
      key: m.user_id,
      tipo,
      nomeA: m.nome.split(' ')[0],
      nomeB,
      rows,
      proximoAniv,
    })
  }

  return groups.sort((a, b) => a.proximoAniv - b.proximoAniv)
}

function AnivRowItem({ row }: { row: AnivRow }) {
  const isThisMonth = isDataNoMesAtual(row.data)
  const daysLabel =
    row.daysUntil === 0 ? 'Hoje! 🎉' : row.daysUntil === 1 ? 'Amanhã' : `em ${row.daysUntil} dias`
  const iniciais = row.nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${isThisMonth ? 'bg-amber-50/50' : 'bg-background'}`}>
      <div className="h-8 w-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center">
        {row.tipo === 'casamento' ? (
          <div className="h-full w-full bg-rose-100 flex items-center justify-center text-base">💍</div>
        ) : row.avatar_url ? (
          <img src={row.avatar_url} alt={row.nome} className="h-full w-full object-cover" />
        ) : (
          <div className={`h-full w-full flex items-center justify-center text-xs font-bold ${isThisMonth ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
            {row.subtitulo ? <Cake className="h-3.5 w-3.5" /> : iniciais}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isThisMonth ? 'text-amber-900' : ''}`}>
          {row.nome}
        </p>
        {row.subtitulo && (
          <p className="text-xs text-muted-foreground">{row.subtitulo}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-medium ${isThisMonth ? 'text-amber-700' : 'text-muted-foreground'}`}>
          {formatarDataCurta(row.data)}
        </p>
        {row.tipo === 'casamento' && row.casamentoInfo ? (
          <>
            <p className="text-xs text-rose-500 font-medium">
              {row.casamentoInfo.anosCompletos} ano{row.casamentoInfo.anosCompletos !== 1 ? 's' : ''}
              {row.casamentoInfo.meses > 0 ? ` e ${row.casamentoInfo.meses} ${row.casamentoInfo.meses === 1 ? 'mês' : 'meses'}` : ''}
            </p>
            {row.casamentoInfo.bodas && (
              <p className="text-[10px] text-rose-400">{row.casamentoInfo.bodas}</p>
            )}
          </>
        ) : (
          <p className={`text-xs ${row.daysUntil === 0 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
            {daysLabel}
          </p>
        )}
      </div>
    </div>
  )
}

function InlineSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 pl-8 pr-6 rounded-lg border border-input text-xs bg-background outline-none focus:border-ring w-36 transition-all"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function CelulaTabs({
  encontros, membros, celulaId, celulaNome, localPadrao, dependentes = [], celulaColor, fotosInit = [], canUpload = false,
}: Props) {
  const [qMembros, setQMembros] = useState('')
  const [qEncontros, setQEncontros] = useState('')

  const now = new Date()
  const agendados = encontros.filter((e) => e.status === 'agendado' && new Date(e.data_hora) >= now)
  const historicoBase = encontros.filter((e) => e.status !== 'agendado' || new Date(e.data_hora) < now)
  const historico = qEncontros
    ? historicoBase.filter((e) =>
        format(new Date(e.data_hora), "EEEE d MMMM", { locale: ptBR }).toLowerCase().includes(qEncontros.toLowerCase()) ||
        e.local?.toLowerCase().includes(qEncontros.toLowerCase())
      )
    : historicoBase

  const membrosFiltrados = qMembros
    ? membros.filter((m) => m.nome.toLowerCase().includes(qMembros.toLowerCase()))
    : membros

  // Birthdays always computed from all members (not filtered)
  const familias = buildFamilias(membros, dependentes)

  // Gallery: encontros with cover images for GaleriaCelulaTab
  const encontroFotos = encontros
    .filter((e) => e.card_imagem_url)
    .map((e) => ({ id: e.id, url: e.card_imagem_url!, data_hora: e.data_hora }))

  const triggerCls = "rounded-none px-3 pb-2.5 pt-1 text-sm font-medium data-active:text-primary data-active:after:bg-primary"

  return (
    <Tabs defaultValue="encontros" className="flex-col">
      {/* Tab header — scrollable on mobile so 4 tabs fit */}
      <div className="border-b border-border overflow-x-auto no-scrollbar">
        <div className="flex items-end justify-between min-w-max pr-0.5">
          <TabsList variant="line" className="h-auto pb-0 gap-0 border-b-0 flex-shrink-0">
            <TabsTrigger value="encontros" className={triggerCls}>Encontros</TabsTrigger>
            <TabsTrigger value="membros" className={triggerCls}>Membros ({membros.length})</TabsTrigger>
            <TabsTrigger value="aniversarios" className={triggerCls}>Aniversários</TabsTrigger>
            <TabsTrigger value="galeria" className={triggerCls}>Galeria</TabsTrigger>
          </TabsList>
          <div className="pb-2 pl-2 flex-shrink-0">
            <CriarEncontroDialog celulaId={celulaId} localPadrao={localPadrao} membros={membros} />
          </div>
        </div>
      </div>

      {/* ── Encontros ── */}
      <TabsContent value="encontros" className="mt-4 space-y-2">
        {agendados.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Próximos</p>
            {agendados.map((e) => (
              <EncontroCard key={e.id} encontro={e} membros={membros} celulaColor={celulaColor} celulaNome={celulaNome} />
            ))}
          </>
        )}
        {historicoBase.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-4 mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Histórico</p>
              <InlineSearch value={qEncontros} onChange={setQEncontros} placeholder="Buscar encontro..." />
            </div>
            {historico.map((e) => (
              <EncontroCard key={e.id} encontro={e} membros={membros} celulaColor={celulaColor} celulaNome={celulaNome} />
            ))}
            {historico.length === 0 && qEncontros && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum resultado para &quot;{qEncontros}&quot;</p>
            )}
          </>
        )}
        {encontros.length === 0 && (
          <div className="py-10 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum encontro ainda</p>
          </div>
        )}
      </TabsContent>

      {/* ── Membros ── */}
      <TabsContent value="membros" className="mt-4">
        {membros.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum membro ainda</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Membros</p>
              <InlineSearch value={qMembros} onChange={setQMembros} placeholder="Buscar membro..." />
            </div>
            <div className="space-y-1">
              {membrosFiltrados.length === 0 && qMembros && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum resultado para &quot;{qMembros}&quot;</p>
              )}
              {membrosFiltrados.map((m) => {
                const iniciais = m.nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
                const aniversariante = isDataNoMesAtual(m.data_nascimento_1) || isDataNoMesAtual(m.data_nascimento_2)
                return (
                  <div
                    key={m.user_id}
                    className={`flex items-center gap-3 py-2 ${aniversariante ? 'rounded-lg px-2 bg-amber-50/60' : ''}`}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={m.avatar_url ?? undefined} alt={m.nome} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{iniciais}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{m.nome}</p>
                        {aniversariante && <Cake className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      </div>
                      {m.endereco && (
                        <p className="text-xs text-muted-foreground truncate">{m.endereco}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.endereco_maps && (
                        <a
                          href={m.endereco_maps}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Navigation className="h-3 w-3" />
                          Maps
                        </a>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${papelColor[m.papel]}`}>
                        {papelLabel[m.papel]}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </TabsContent>

      {/* ── Aniversários ── */}
      <TabsContent value="aniversarios" className="mt-4">
        {familias.length === 0 ? (
          <div className="py-10 text-center">
            <Cake className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma data cadastrada</p>
            <p className="text-xs text-muted-foreground mt-1">Os membros precisam preencher as datas no perfil</p>
          </div>
        ) : (
          <div className="space-y-2">
            {familias.map((grupo) => (
              <div
                key={grupo.key}
                className={`rounded-xl overflow-hidden border ${grupo.tipo === 'casal' ? 'border-rose-200' : 'border-border'}`}
              >
                {grupo.tipo === 'casal' && (
                  <div className="px-3 py-2 bg-rose-50 flex items-center gap-2 border-b border-rose-200">
                    <Heart className="h-3 w-3 text-rose-400 shrink-0" />
                    <p className="text-xs font-semibold text-rose-700">
                      {grupo.nomeA} &amp; {grupo.nomeB}
                    </p>
                  </div>
                )}
                <div className="divide-y divide-border">
                  {grupo.rows.map((row, i) => (
                    <AnivRowItem key={i} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Galeria ── */}
      <TabsContent value="galeria" className="mt-4">
        <GaleriaCelulaTab
          celulaId={celulaId}
          fotosInit={fotosInit}
          encontroFotos={encontroFotos}
          canUpload={canUpload}
        />
      </TabsContent>
    </Tabs>
  )
}

function EncontroCard({
  encontro, membros, celulaColor, celulaNome,
}: {
  encontro: Encontro
  membros: Membro[]
  celulaColor?: string | null
  celulaNome: string
}) {
  const router = useRouter()
  const [sharingImg, setSharingImg] = useState(false)
  const status = encontro.status as keyof typeof statusConfig
  const statusInfo = statusConfig[status] ?? statusConfig.agendado
  const data = new Date(encontro.data_hora)

  const mapsUrl =
    encontro.local_maps_url ??
    (encontro.local
      ? (membros.find((m) => m.endereco && m.endereco === encontro.local)?.endereco_maps ?? null)
      : null)

  const iconBgStyle = celulaColor
    ? { backgroundColor: celulaColor + '20', color: celulaColor }
    : undefined

  function buildText() {
    const dataStr = format(data, "EEEE, d/MM 'às' HH'h'mm", { locale: ptBR })
    const dataCapitalized = dataStr.charAt(0).toUpperCase() + dataStr.slice(1)
    let text = `${celulaNome}\n\n*${dataCapitalized}*`
    if (encontro.local) text += `\n${encontro.local}`
    text += '\n\nBora viver isso juntos!'
    return text
  }

  function handleShareTexto(e: React.MouseEvent) {
    e.stopPropagation()
    window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank')
  }

  async function handleShareImagem(e: React.MouseEvent) {
    e.stopPropagation()
    if (!encontro.card_imagem_url) return
    setSharingImg(true)
    try {
      const response = await fetch(encontro.card_imagem_url)
      const blob = await response.blob()
      const ext = blob.type.includes('png') ? 'png' : 'jpg'
      const file = new File([blob], `encontro-${celulaNome}.${ext}`, { type: blob.type })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: buildText() })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    } finally {
      setSharingImg(false)
    }
  }

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/encontro/${encontro.id}`)}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {encontro.card_imagem_url ? (
              <img
                src={encontro.card_imagem_url}
                alt=""
                className="h-14 w-14 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div
                className={`p-2 rounded-lg shrink-0 ${!celulaColor ? 'bg-primary/10 text-primary' : ''}`}
                style={iconBgStyle}
              >
                <CalendarDays className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium capitalize">
                {format(data, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(data, "HH'h'mm", { locale: ptBR })}
                {encontro.status === 'agendado' && (
                  <>
                    {' · '}
                    {formatDistanceToNow(data, { locale: ptBR, addSuffix: true })}
                  </>
                )}
                {encontro.local && (
                  <>
                    {' · '}
                    <MapPin className="h-3 w-3 inline" /> {encontro.local}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Navigation className="h-3 w-3" />
                Maps
              </a>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
            <button
              onClick={handleShareTexto}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Compartilhar texto"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
            {encontro.card_imagem_url && (
              <button
                onClick={handleShareImagem}
                disabled={sharingImg}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Compartilhar imagem"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
