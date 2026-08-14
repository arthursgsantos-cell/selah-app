'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateMeuPerfilAction, uploadAvatarAction } from '@/app/actions/meu-perfil'
import { salvarDependentesAction, type DependenteItem } from '@/app/actions/dependentes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, Check, Lock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DataInput } from '@/components/ui/data-input'
import { DependentesForm } from '@/components/perfil/dependentes-form'

interface Props {
  nome: string
  role?: string
  titulo?: string | null
  telefone?: string | null
  email: string
  avatarUrl: string | null
  dataNascimento1: string | null
  dataNascimento2: string | null
  dataCasamento: string | null
  endereco: string | null
  enderecoMaps: string | null
  dependentesInit: DependenteItem[]
  conjugeFilhos?: Array<{ nome: string; data_nascimento: string | null }>
  /**
   * Para onde voltar depois de salvar. Vem do `?retorno=` que o convite de
   * primeiro acesso põe na URL — quem foi interrompido no meio de uma
   * inscrição volta para ela, e não para a home.
   */
  retorno?: string | null
}

export function EditarPerfilForm({
  nome: nomeInit,
  role,
  titulo: tituloInit,
  telefone: telefoneInit,
  email,
  avatarUrl: avatarInit,
  dataNascimento1: nasc1Init,
  dataNascimento2: nasc2Init,
  dataCasamento: casInit,
  endereco: endInit,
  enderecoMaps: endMapsInit,
  dependentesInit,
  conjugeFilhos = [],
  retorno = null,
}: Props) {
  const router = useRouter()
  const [nome, setNome] = useState(nomeInit)
  const [titulo, setTitulo] = useState(tituloInit ?? '')
  const [telefone, setTelefone] = useState(telefoneInit ?? '')
  const [dataNascimento1, setDataNascimento1] = useState(nasc1Init ?? '')
  const [dataNascimento2, _setDataNascimento2] = useState(nasc2Init ?? '')
  const [dataCasamento, setDataCasamento] = useState(casInit ?? '')
  const [endereco, setEndereco] = useState(endInit ?? '')
  const [enderecoMaps, setEnderecoMaps] = useState(endMapsInit ?? '')
  const [dependentes, setDependentes] = useState<DependenteItem[]>(dependentesInit)
  const [avatarUrl, setAvatarUrl] = useState(avatarInit)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saved, setSaved] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = nome
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

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setErro(null)
    setSaved(false)
    startTransition(async () => {
      try {
        if (avatarFile) {
          const fd = new FormData()
          fd.append('file', avatarFile)
          const url = await uploadAvatarAction(fd)
          setAvatarUrl(url)
          setAvatarPreview(null)
          setAvatarFile(null)
        }
        await Promise.all([
          updateMeuPerfilAction({
            nome: nome.trim(),
            titulo: titulo || null,
            telefone: telefone || null,
            data_nascimento_1: dataNascimento1 || null,
            data_nascimento_2: dataNascimento2 || null,
            data_casamento: dataCasamento || null,
            endereco: endereco || null,
            endereco_maps: enderecoMaps || null,
          }),
          salvarDependentesAction(dependentes),
        ])
        setSaved(true)
        // Veio do convite de primeiro acesso: devolve a pessoa ao que ela
        // estava tentando acessar, sem passar pela home.
        if (retorno) {
          router.push(retorno)
          return
        }
        setTimeout(() => setSaved(false), 2500)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao salvar')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardContent className="pt-5 pb-4 flex flex-col items-center gap-2">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarPreview ?? avatarUrl ?? undefined} alt={nome} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="text-xs text-muted-foreground">Toque na câmera para trocar a foto</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pf-nome">Nome</Label>
            <Input
              id="pf-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo ou nome do casal"
              required
            />
            <p className="text-xs text-muted-foreground">
              Para casais: &quot;João e Maria Silva&quot;
            </p>
          </div>

          {role === 'pastor' && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-titulo">Título pastoral</Label>
              <Input
                id="pf-titulo"
                list="titulos-sugeridos"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Pastor Titular, Pastor Auxiliar…"
              />
              <datalist id="titulos-sugeridos">
                <option value="Pastor Titular" />
                <option value="Pastor Auxiliar" />
                <option value="Pastor de Jovens" />
                <option value="Pastor de Ensino" />
                <option value="Pastor de Casais" />
                <option value="Pastor Missionário" />
                <option value="Evangelista" />
              </datalist>
              <p className="text-xs text-muted-foreground">
                Aparece no cartão da página inicial
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pf-tel">Telefone / WhatsApp</Label>
            <Input
              id="pf-tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          {email && (
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={email} disabled className="opacity-60 cursor-not-allowed" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pf-end">Endereço</Label>
            <Input
              id="pf-end"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua das Flores, 123 – Bairro"
            />
            <p className="text-xs text-muted-foreground">
              Aparece como sugestão ao agendar encontro na sua casa
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-maps">Link do Google Maps <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              id="pf-maps"
              value={enderecoMaps}
              onChange={(e) => setEnderecoMaps(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              Aparece como botão no card da célula
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 pb-4 space-y-4">
          <div>
            <p className="text-sm font-medium">Datas e família</p>
            <p className="text-xs text-muted-foreground mt-0.5">Usadas nos aniversários e datas especiais da célula</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-nasc1">Meu aniversário</Label>
            <DataInput id="pf-nasc1" value={dataNascimento1} onChange={setDataNascimento1} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-casamento">Data de casamento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <DataInput id="pf-casamento" value={dataCasamento} onChange={setDataCasamento} />
          </div>

          <div className="space-y-2">
            <Label>Cônjuge e filhos</Label>
            {conjugeFilhos.length > 0 && (
              <div className="space-y-1.5">
                {conjugeFilhos.map((f, i) => {
                  let dataBr: string | null = null
                  try {
                    if (f.data_nascimento) dataBr = format(parseISO(f.data_nascimento), "d 'de' MMMM", { locale: ptBR })
                  } catch { /* noop */ }
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 opacity-70">
                      <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 text-muted-foreground">{f.nome}</span>
                      {dataBr && <span className="text-xs text-muted-foreground">{dataBr}</span>}
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground pl-0.5">Do cônjuge vinculado — edite no perfil dele(a)</p>
              </div>
            )}
            <DependentesForm value={dependentes} onChange={setDependentes} />
          </div>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" className="w-full" disabled={!nome.trim() || isPending}>
        {isPending ? 'Salvando...' : saved ? (
          <span className="flex items-center gap-1.5">
            <Check className="h-4 w-4" /> Salvo!
          </span>
        ) : 'Salvar perfil'}
      </Button>
    </form>
  )
}
