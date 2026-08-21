'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { updateUserProfileAdminAction } from '@/app/actions/profile'
import { uploadAvatarAdminAction } from '@/app/actions/meu-perfil'
import {
  buscarDependentesAdminAction,
  salvarDependentesAdminAction,
  filhosDoConjugeDisponiveisAdminAction,
  type DependenteItem,
} from '@/app/actions/dependentes'
import {
  vincularConjugeAdminAction,
  desvincularConjugeAdminAction,
  analisarVinculoConjugeAdminAction,
  type AnaliseVinculo,
  type ResolucaoDuplicata,
} from '@/app/actions/conjuge'
import { DuplicatasFamilia } from '@/components/perfil/duplicatas-familia'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataInput } from '@/components/ui/data-input'
import { DependentesForm } from '@/components/perfil/dependentes-form'
import {
  Check, Pencil, ChevronDown, Heart, HeartOff, Camera, Users,
} from 'lucide-react'
import type { Role } from '@/lib/supabase/types'

type UsuarioMin = {
  id: string
  nome: string
  email: string | null
  avatar_url: string | null
  telefone: string | null
  titulo?: string | null
  data_nascimento_1: string | null
  data_nascimento_2: string | null
  data_casamento: string | null
  endereco: string | null
  endereco_maps: string | null
  conjuge_id: string | null
  conjuge_nome: string | null
  role: Role
}

interface Props {
  usuario: UsuarioMin
  todosUsuarios: { id: string; nome: string }[]
}

export function EditarPerfilAdmin({ usuario, todosUsuarios }: Props) {
  const [aberto, setAberto] = useState(false)

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(usuario.avatar_url)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Dados pessoais
  const [nome, setNome] = useState(usuario.nome)
  const [telefone, setTelefone] = useState(usuario.telefone ?? '')
  const [titulo, setTitulo] = useState(usuario.titulo ?? '')
  const [dataNasc1, setDataNasc1] = useState(usuario.data_nascimento_1 ?? '')
  const [dataNasc2, setDataNasc2] = useState(usuario.data_nascimento_2 ?? '')
  const [dataCas, setDataCas] = useState(usuario.data_casamento ?? '')
  const [endereco, setEndereco] = useState(usuario.endereco ?? '')
  const [endMaps, setEndMaps] = useState(usuario.endereco_maps ?? '')

  // Dependentes (carregados ao abrir)
  const [dependentes, setDependentes] = useState<DependenteItem[] | null>(null)
  const [filhosDoConjuge, setFilhosDoConjuge] = useState<DependenteItem[]>([])
  const [loadingDeps, setLoadingDeps] = useState(false)

  // Cônjuge
  const [conjugeId, setConjugeId] = useState(usuario.conjuge_id)
  const [conjugeNome, setConjugeNome] = useState(usuario.conjuge_nome)
  const [buscaConjuge, setBuscaConjuge] = useState('')
  const [conjugePending, startConjugeTransition] = useTransition()
  const [erroConjuge, setErroConjuge] = useState<string | null>(null)
  // Conferência dos filhos antes de ligar os dois perfis.
  const [analise, setAnalise] = useState<{ id: string; nome: string; dados: AnaliseVinculo } | null>(null)
  const [resolucoes, setResolucoes] = useState<ResolucaoDuplicata[]>([])

  // Save
  const [saved, setSaved] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Carregar dependentes ao abrir pela primeira vez
  useEffect(() => {
    if (aberto && dependentes === null && !loadingDeps) {
      setLoadingDeps(true)
      buscarDependentesAdminAction(usuario.id)
        .then(setDependentes)
        .catch(() => setDependentes([]))
        .finally(() => setLoadingDeps(false))
      filhosDoConjugeDisponiveisAdminAction(usuario.id)
        .then(setFilhosDoConjuge)
        .catch(() => setFilhosDoConjuge([]))
    }
  }, [aberto, dependentes, loadingDeps, usuario.id])

  const iniciais = nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setErro(null)
    setSaved(false)
    startTransition(async () => {
      try {
        if (avatarFile) {
          const fd = new FormData()
          fd.append('file', avatarFile)
          const url = await uploadAvatarAdminAction(usuario.id, fd)
          setAvatarUrl(url)
          setAvatarPreview(null)
          setAvatarFile(null)
        }
        await Promise.all([
          updateUserProfileAdminAction(usuario.id, {
            nome,
            titulo: titulo || null,
            telefone: telefone || null,
            data_nascimento_1: dataNasc1 || null,
            data_nascimento_2: dataNasc2 || null,
            data_casamento: dataCas || null,
            endereco: endereco || null,
            endereco_maps: endMaps || null,
          }),
          dependentes !== null
            ? salvarDependentesAdminAction(usuario.id, dependentes)
            : Promise.resolve(),
        ])
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao salvar')
      }
    })
  }

  const sugestoes = buscaConjuge.trim().length >= 2
    ? todosUsuarios.filter(
        (u) => u.id !== usuario.id && u.nome.toLowerCase().includes(buscaConjuge.toLowerCase())
      ).slice(0, 6)
    : []

  /** Confere os cadastros de filhos dos dois lados antes de ligar os perfis. */
  function conferir(id: string, nomeConjuge: string) {
    setErroConjuge(null)
    startConjugeTransition(async () => {
      try {
        const dados = await analisarVinculoConjugeAdminAction(usuario.id, id)
        setResolucoes(
          dados.confirmar.map((item) => ({
            meuId: item.meu.id,
            deleId: item.dele.id,
            mesclar: true,
            ...item.sugestao,
          }))
        )
        setAnalise({ id, nome: nomeConjuge, dados })
      } catch (err) {
        setErroConjuge(err instanceof Error ? err.message : 'Erro ao conferir cadastros')
      }
    })
  }

  function vincular() {
    if (!analise) return
    const alvo = analise
    setErroConjuge(null)
    startConjugeTransition(async () => {
      try {
        await vincularConjugeAdminAction(usuario.id, alvo.id, resolucoes)
        setConjugeId(alvo.id)
        setConjugeNome(alvo.nome)
        setBuscaConjuge('')
        setAnalise(null)
        setResolucoes([])
        // A lista na tela ficou velha: a mesclagem mexeu nas linhas.
        setDependentes(await buscarDependentesAdminAction(usuario.id).catch(() => []))
        setFilhosDoConjuge(await filhosDoConjugeDisponiveisAdminAction(usuario.id).catch(() => []))
      } catch (err) {
        setErroConjuge(err instanceof Error ? err.message : 'Erro ao vincular')
      }
    })
  }

  function desvincular() {
    setErroConjuge(null)
    startConjugeTransition(async () => {
      try {
        await desvincularConjugeAdminAction(usuario.id)
        setConjugeId(null)
        setConjugeNome(null)
        setAnalise(null)
        setResolucoes([])
      } catch (err) {
        setErroConjuge(err instanceof Error ? err.message : 'Erro ao desvincular')
      }
    })
  }

  return (
    <div className="border-t border-border/60">
      {/* Cabeçalho colapsável */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        <Pencil className="h-3 w-3" />
        Editar perfil
        <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="px-3 pb-4 pt-1 space-y-4 bg-muted/10">

          {/* AVATAR */}
          <div className="flex items-center gap-3 pt-1">
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                {(avatarPreview ?? avatarUrl) ? (
                  <img
                    src={avatarPreview ?? avatarUrl!}
                    alt={nome}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-primary">{iniciais}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
              >
                <Camera className="h-2.5 w-2.5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{nome}</p>
              <p className="text-xs text-muted-foreground truncate">{usuario.email ?? '—'}</p>
            </div>
          </div>

          {/* FORM DADOS PESSOAIS */}
          <form onSubmit={salvar} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8 text-sm" required />
              </div>

              {/* Só para pastor: é o texto que aparece acima do nome no
                  cartão da liderança, na tela inicial. */}
              {usuario.role === 'pastor' && (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Título pastoral</Label>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    list="titulos-pastorais"
                    className="h-8 text-sm"
                    placeholder="Ex: Pastor Titular"
                  />
                  <datalist id="titulos-pastorais">
                    <option value="Pastor Titular" />
                    <option value="Pastor Auxiliar" />
                    <option value="Pastor de Jovens" />
                    <option value="Pastor de Ensino" />
                    <option value="Pastor de Casais" />
                    <option value="Pastor Missionário" />
                    <option value="Evangelista" />
                  </datalist>
                  <p className="text-[11px] text-muted-foreground">
                    Aparece acima do nome no cartão da liderança, na tela inicial.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Aniversário</Label>
                <DataInput value={dataNasc1} onChange={setDataNasc1} className="h-8 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Aniv. 2º cônjuge</Label>
                <DataInput value={dataNasc2} onChange={setDataNasc2} className="h-8 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data de casamento</Label>
                <DataInput value={dataCas} onChange={setDataCas} className="h-8 text-sm" />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Rua, número – Bairro"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Link Google Maps</Label>
                <Input
                  value={endMaps}
                  onChange={(e) => setEndMaps(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="https://maps.app.goo.gl/..."
                  type="url"
                />
              </div>
            </div>

            {/* DEPENDENTES */}
            <div className="border-t border-border/40 pt-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Users className="h-3 w-3 text-muted-foreground" />
                Filhos e cônjuge não vinculado
              </p>
              {loadingDeps ? (
                <p className="text-xs text-muted-foreground py-1">Carregando...</p>
              ) : dependentes !== null ? (
                <DependentesForm
                  value={dependentes}
                  onChange={setDependentes}
                  filhosDoConjuge={filhosDoConjuge}
                />
              ) : null}
            </div>

            {erro && <p className="text-xs text-destructive">{erro}</p>}

            <button
              type="submit"
              disabled={!nome.trim() || isPending}
              className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {isPending ? 'Salvando...' : saved
                ? <><Check className="h-3.5 w-3.5" /> Salvo!</>
                : 'Salvar alterações'}
            </button>
          </form>

          {/* CÔNJUGE */}
          <div className="border-t border-border/40 pt-3 space-y-2">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Heart className="h-3 w-3 text-rose-400" />
              Conta do cônjuge vinculada
            </p>

            {conjugeId && conjugeNome ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-lg border border-border/60 bg-rose-50/50 px-2.5 py-1.5">
                  <Heart className="h-3 w-3 text-rose-400 shrink-0" />
                  <span className="text-sm font-medium flex-1">{conjugeNome}</span>
                </div>
                <button
                  type="button"
                  disabled={conjugePending}
                  onClick={desvincular}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40 px-2 py-1.5 rounded-lg border border-border/60 hover:border-destructive/40 transition-colors shrink-0"
                >
                  <HeartOff className="h-3 w-3" />
                  {conjugePending ? '...' : 'Desvincular'}
                </button>
              </div>
            ) : analise ? (
              <div className="rounded-lg border border-border/60 bg-background p-3 space-y-3">
                <p className="text-xs">
                  Vincular <strong>{nome.split(' ')[0]}</strong> com <strong>{analise.nome}</strong>
                </p>

                <DuplicatasFamilia
                  key={analise.id}
                  analise={analise.dados}
                  nomeConjuge={analise.nome}
                  onChange={setResolucoes}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={conjugePending}
                    onClick={vincular}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 transition-colors"
                  >
                    <Heart className="h-3 w-3" />
                    {conjugePending ? 'Vinculando...' : 'Confirmar vínculo'}
                  </button>
                  <button
                    type="button"
                    disabled={conjugePending}
                    onClick={() => { setAnalise(null); setResolucoes([]) }}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input
                  value={buscaConjuge}
                  onChange={(e) => setBuscaConjuge(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Buscar por nome..."
                  disabled={conjugePending}
                />
                {sugestoes.length > 0 && (
                  <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/40">
                    {sugestoes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={conjugePending}
                        onClick={() => conferir(s.id, s.nome)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-rose-50 transition-colors flex items-center gap-2 disabled:opacity-40"
                      >
                        <Heart className="h-3 w-3 text-rose-400 shrink-0" />
                        {s.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {erroConjuge && <p className="text-xs text-destructive">{erroConjuge}</p>}
          </div>

        </div>
      )}
    </div>
  )
}
