'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { atualizarInfoIgrejaAction } from '@/app/actions/pastor'
import { Pencil, Check, X, Clock, MapPin, Calendar, HandCoins, Radio } from 'lucide-react'
import { EditorTexto } from '@/components/shared/editor-texto'
import { LABEL_TIPO_PIX } from '@/lib/pix'
import type { TipoChavePix } from '@/lib/supabase/types'

interface IgrejaInfo {
  nome: string
  descricao: string | null
  horario_culto: string | null
  endereco: string | null
  fundada_em: string | null
  instagram_url: string | null
  facebook_url: string | null
  youtube_url: string | null
  spotify_url: string | null
  pastor_nome: string | null
  pastor_titulo: string | null
  pix_chave: string | null
  pix_tipo: TipoChavePix | null
  pix_nome: string | null
  pix_cidade: string | null
  contribuicao_texto: string | null
  dados_bancarios: string | null
  contribuicao_ativa: boolean
  ao_vivo_url: string | null
  ao_vivo_ativo: boolean
}

const selectClass =
  'w-full h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring'

const TIPOS_PIX: TipoChavePix[] = ['cnpj', 'cpf', 'email', 'telefone', 'aleatoria']

interface Props {
  igrejaId: string
  info: IgrejaInfo
}

/** Estado inicial do formulário. Vive fora para "salvar" e "cancelar" não
 *  divergirem quando um campo novo entra na lista. */
function formDe(info: IgrejaInfo) {
  return {
    nome: info.nome ?? '',
    descricao: info.descricao ?? '',
    horario_culto: info.horario_culto ?? '',
    endereco: info.endereco ?? '',
    fundada_em: info.fundada_em ?? '',
    instagram_url: info.instagram_url ?? '',
    facebook_url: info.facebook_url ?? '',
    youtube_url: info.youtube_url ?? '',
    spotify_url: info.spotify_url ?? '',
    pastor_nome: info.pastor_nome ?? '',
    pastor_titulo: info.pastor_titulo ?? '',
    pix_chave: info.pix_chave ?? '',
    pix_tipo: info.pix_tipo ?? '',
    pix_nome: info.pix_nome ?? '',
    pix_cidade: info.pix_cidade ?? '',
    contribuicao_texto: info.contribuicao_texto ?? '',
    dados_bancarios: info.dados_bancarios ?? '',
    contribuicao_ativa: info.contribuicao_ativa ?? false,
    ao_vivo_url: info.ao_vivo_url ?? '',
    ao_vivo_ativo: info.ao_vivo_ativo ?? false,
  }
}

export function IgrejaInfoForm({ igrejaId, info }: Props) {
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState(() => formDe(info))

  function set(field: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    // Texto vazio vira `null` de propósito: `undefined` some do update e o
    // valor antigo ficaria no banco, então limpar o campo não limparia nada.
    const result = await atualizarInfoIgrejaAction(igrejaId, {
      nome: form.nome || undefined,
      descricao: form.descricao || undefined,
      horario_culto: form.horario_culto || undefined,
      endereco: form.endereco || undefined,
      fundada_em: form.fundada_em || undefined,
      instagram_url: form.instagram_url || undefined,
      facebook_url: form.facebook_url || undefined,
      youtube_url: form.youtube_url || undefined,
      spotify_url: form.spotify_url || undefined,
      pastor_nome: form.pastor_nome || undefined,
      pastor_titulo: form.pastor_titulo || undefined,
      pix_chave: form.pix_chave.trim() || null,
      pix_tipo: (form.pix_tipo || null) as TipoChavePix | null,
      pix_nome: form.pix_nome.trim() || null,
      pix_cidade: form.pix_cidade.trim() || null,
      contribuicao_texto: form.contribuicao_texto.trim() || null,
      dados_bancarios: form.dados_bancarios.trim() || null,
      contribuicao_ativa: form.contribuicao_ativa,
      ao_vivo_url: form.ao_vivo_url.trim() || null,
      ao_vivo_ativo: form.ao_vivo_ativo,
    })
    setSalvando(false)
    if (result.sucesso) {
      setEditando(false)
    } else {
      setErro(result.erro ?? 'Erro ao salvar')
    }
  }

  function cancelar() {
    setForm(formDe(info))
    setErro(null)
    setEditando(false)
  }

  const igSvg = <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
  const fbSvg = <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  const ytSvg = <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
  const spSvg = <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.56 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>

  if (!editando) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Informações da Igreja
          </p>
          <Button variant="ghost" size="sm" onClick={() => setEditando(true)} className="gap-1.5 h-7 px-2.5 text-xs text-muted-foreground">
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="font-semibold text-sm">{info.nome}</p>
          {info.descricao && (
            <p className="text-xs text-muted-foreground italic">{info.descricao}</p>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          {info.horario_culto && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{info.horario_culto}</span>
            </div>
          )}
          {info.endereco && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{info.endereco}</span>
            </div>
          )}
          {info.fundada_em && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Fundada em {info.fundada_em}</span>
            </div>
          )}
        </div>

        {(info.instagram_url || info.facebook_url || info.youtube_url || info.spotify_url) && (
          <div className="mt-3 flex gap-2">
            {info.instagram_url && (
              <a href={info.instagram_url} target="_blank" rel="noopener noreferrer"
                className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                {igSvg}
              </a>
            )}
            {info.facebook_url && (
              <a href={info.facebook_url} target="_blank" rel="noopener noreferrer"
                className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                {fbSvg}
              </a>
            )}
            {info.youtube_url && (
              <a href={info.youtube_url} target="_blank" rel="noopener noreferrer"
                className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                {ytSvg}
              </a>
            )}
            {info.spotify_url && (
              <a href={info.spotify_url} target="_blank" rel="noopener noreferrer"
                className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                {spSvg}
              </a>
            )}
          </div>
        )}

        {/* Estado do que é público: quem abre este painel precisa saber, sem
            entrar no modo de edição, se o dízimo está no ar e se a
            transmissão ficou marcada como ao vivo depois do culto. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            info.contribuicao_ativa
              ? 'bg-green-100 text-green-700'
              : 'bg-muted text-muted-foreground'
          }`}>
            <HandCoins className="h-3 w-3" />
            {info.contribuicao_ativa ? 'Contribuição publicada' : 'Contribuição desativada'}
          </span>
          {info.ao_vivo_ativo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              <Radio className="h-3 w-3" />
              Transmissão marcada como ao vivo
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Informações da Igreja
        </p>
      </div>

      <div className="space-y-4">
        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Geral</p>
          <div className="space-y-3">
            <Field label="Nome da igreja" value={form.nome} onChange={(v) => set('nome', v)} />
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição / tagline</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => set('descricao', e.target.value)}
                placeholder="Uma frase que descreve a missão da igreja"
                className="text-sm resize-none"
                rows={2}
              />
            </div>
            <Field label="Fundada em (ano)" value={form.fundada_em} onChange={(v) => set('fundada_em', v)} placeholder="Ex: 1987" />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Cultos e localização</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Horários dos cultos</Label>
              <Textarea
                value={form.horario_culto}
                onChange={(e) => set('horario_culto', e.target.value)}
                placeholder="Ex: Domingos às 9h, 11h e 18h"
                className="text-sm resize-none"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Endereço</Label>
              <Textarea
                value={form.endereco}
                onChange={(e) => set('endereco', e.target.value)}
                placeholder="Rua, número, bairro, cidade"
                className="text-sm resize-none"
                rows={2}
              />
            </div>
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Redes sociais</p>
          <div className="space-y-3">
            <Field label="Instagram (URL)" value={form.instagram_url} onChange={(v) => set('instagram_url', v)} placeholder="https://instagram.com/suaigreja" />
            <Field label="Facebook (URL)" value={form.facebook_url} onChange={(v) => set('facebook_url', v)} placeholder="https://facebook.com/suaigreja" />
            <Field label="YouTube (URL)" value={form.youtube_url} onChange={(v) => set('youtube_url', v)} placeholder="https://youtube.com/@suaigreja" />
            <Field label="Spotify — mensagens (URL)" value={form.spotify_url} onChange={(v) => set('spotify_url', v)} placeholder="https://open.spotify.com/show/..." />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <Radio className="h-3 w-3" /> Culto ao vivo
          </p>
          <p className="text-[10px] text-muted-foreground mb-2">
            Cadastre o link uma vez aqui. Ligar e desligar &quot;está no ar&quot; toda
            semana é mais rápido pelo botão na tela inicial.
          </p>
          <div className="space-y-3">
            <Field
              label="Link da transmissão"
              value={form.ao_vivo_url}
              onChange={(v) => set('ao_vivo_url', v)}
              placeholder="https://youtube.com/live/..."
            />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <HandCoins className="h-3 w-3" /> Dízimos e ofertas
          </p>
          <p className="text-[10px] text-muted-foreground mb-2">
            O QR code é gerado a partir da chave — não precisa subir imagem. Confira a chave
            antes de publicar.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo da chave</Label>
              <select
                className={selectClass}
                value={form.pix_tipo}
                onChange={(e) => set('pix_tipo', e.target.value)}
              >
                <option value="">Selecione...</option>
                {TIPOS_PIX.map((t) => <option key={t} value={t}>{LABEL_TIPO_PIX[t]}</option>)}
              </select>
            </div>
            <Field label="Chave PIX" value={form.pix_chave} onChange={(v) => set('pix_chave', v)} placeholder="Ex: 06.070.066/0001-34" />
            <Field label="Nome do recebedor" value={form.pix_nome} onChange={(v) => set('pix_nome', v)} placeholder="Como aparece no app do banco" />
            <Field label="Cidade do recebedor" value={form.pix_cidade} onChange={(v) => set('pix_cidade', v)} placeholder="Ex: Parnamirim" />
            <div className="space-y-1.5">
              <Label className="text-xs">Texto da página</Label>
              <EditorTexto
                value={form.contribuicao_texto}
                onChange={(v) => set('contribuicao_texto', v)}
                placeholder="Uma palavra sobre a contribuição, versículo, etc."
                minRows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dados bancários (opcional)</Label>
              <Textarea
                value={form.dados_bancarios}
                onChange={(e) => set('dados_bancarios', e.target.value)}
                placeholder={'Banco 000 — Nome do Banco\nAgência 0000 · Conta 00000-0\nCNPJ 00.000.000/0001-00'}
                className="text-sm resize-none font-mono"
                rows={3}
              />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.contribuicao_ativa}
                onChange={(e) => set('contribuicao_ativa', e.target.checked)}
                className="accent-primary h-3.5 w-3.5"
              />
              Publicar a página de contribuição
            </label>
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Pastor (legado)</p>
          <p className="text-[10px] text-muted-foreground mb-2">Usado como fallback quando não há perfil de pastor cadastrado.</p>
          <div className="space-y-3">
            <Field label="Nome do pastor" value={form.pastor_nome} onChange={(v) => set('pastor_nome', v)} placeholder="Ex: Pr. João Silva" />
            <Field label="Título" value={form.pastor_titulo} onChange={(v) => set('pastor_titulo', v)} placeholder="Ex: Pastor, Rev., Pr." />
          </div>
        </section>

        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>

      {/* Barra de ação fixa — mesmo padrão do formulário de turma: acompanha a
          rolagem num formulário longo, então o botão de salvar nunca fica a
          uma rolagem de distância. */}
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 border-t bg-background/95 backdrop-blur px-4 py-3 rounded-b-2xl flex items-center gap-2">
        <Button size="sm" onClick={salvar} disabled={salvando} className="gap-1.5">
          <Check className="h-3.5 w-3.5" /> {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando} className="gap-1.5">
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm h-8" />
    </div>
  )
}

