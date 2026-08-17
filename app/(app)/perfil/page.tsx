'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { pendenciasDoPerfil } from '@/lib/perfil-pendencias'
import { linkSuporte } from '@/lib/suporte'
import { createClient } from '@/lib/supabase/client'
import { EditarPerfilForm } from '@/components/perfil/editar-perfil-form'
import { ConjugeVinculoSection } from '@/components/perfil/conjuge-vinculo-section'
import { VinculoIgrejaSection } from '@/components/perfil/vinculo-igreja-section'
import { buscarDependentesAction, type DependenteItem } from '@/app/actions/dependentes'
import { buscarDadosConjugeAction } from '@/app/actions/conjuge'
import { minhasInscricoesAction } from '@/app/actions/inscricoes-membro'
import { MinhasInscricoes, type InscricaoResumo } from '@/components/perfil/minhas-inscricoes'

type Profile = {
  nome: string
  role: string
  titulo: string | null
  telefone: string | null
  email: string | null
  avatar_url: string | null
  data_nascimento_1: string | null
  data_nascimento_2: string | null
  data_casamento: string | null
  endereco: string | null
  endereco_maps: string | null
}

export default function PerfilPage() {
  // `useSearchParams` exige fronteira de Suspense na build estática do Next.
  return (
    <Suspense fallback={null}>
      <PerfilConteudo />
    </Suspense>
  )
}

function PerfilConteudo() {
  const searchParams = useSearchParams()
  // Só caminho interno: um `retorno` apontando para fora viraria
  // redirecionamento aberto a partir da query.
  const retornoBruto = searchParams.get('retorno')
  const retorno =
    retornoBruto && retornoBruto.startsWith('/') && !retornoBruto.startsWith('//')
      ? retornoBruto
      : null

  const [profile, setProfile] = useState<Profile | null>(null)
  const [dependentes, setDependentes] = useState<DependenteItem[]>([])
  const [conjugeFilhos, setConjugeFilhos] = useState<Array<{ nome: string; data_nascimento: string | null }>>([])
  const [erro, setErro] = useState<string | null>(null)
  const [inscricoes, setInscricoes] = useState<InscricaoResumo[]>([])

  // As inscrições vêm da planilha de cada evento; carregam à parte para não
  // segurar o resto do perfil.
  useEffect(() => {
    minhasInscricoesAction().then(setInscricoes).catch(() => setInscricoes([]))
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session }, error: sessErr }) => {
      if (sessErr || !session?.user) {
        setErro('Sessão não encontrada. Tente recarregar a página.')
        return
      }
      const [profileResult, deps, conjugeDados] = await Promise.all([
        supabase
          .from('profiles')
          .select('nome, role, titulo, telefone, email, avatar_url, data_nascimento_1, data_nascimento_2, data_casamento, endereco, endereco_maps')
          .eq('id', session.user.id)
          .single(),
        buscarDependentesAction().catch(() => [] as DependenteItem[]),
        buscarDadosConjugeAction().catch(() => null),
      ])
      if (profileResult.error || !profileResult.data) {
        setErro('Erro ao carregar perfil: ' + (profileResult.error?.message ?? 'sem dados'))
        return
      }
      const p = profileResult.data
      // Pre-fill empty fields from linked spouse
      setProfile({
        ...p,
        titulo: (p as any).titulo ?? null,
        telefone: (p as any).telefone ?? null,
        endereco: p.endereco || conjugeDados?.endereco || null,
        endereco_maps: p.endereco_maps || conjugeDados?.endereco_maps || null,
        data_casamento: p.data_casamento || conjugeDados?.data_casamento || null,
      })
      setDependentes(deps)
      setConjugeFilhos(conjugeDados?.filhos ?? [])
    })
  }, [])

  if (erro) {
    return (
      <div className="max-w-lg mx-auto pt-10 text-center text-sm text-destructive">
        {erro}
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto pt-10 text-center text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  const pendencias = pendenciasDoPerfil(profile)

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground -ml-1 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
      <div>
        <h1 className="text-xl font-bold">Meu perfil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie suas informações pessoais</p>
      </div>

      {/* O que ainda falta, com nome e motivo. Reflete o que está salvo: some
          depois que a pessoa salva, não enquanto ela digita. */}
      {pendencias.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            {pendencias.length === 1 ? 'Falta 1 dado no seu cadastro' : `Faltam ${pendencias.length} dados no seu cadastro`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {pendencias.map((p) => (
              <li key={p.campo} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span className="text-xs leading-snug text-amber-800">
                  <span className="font-medium">{p.rotulo}</span> — {p.porque}
                </span>
              </li>
            ))}
          </ul>
          {retorno && (
            <p className="text-xs text-amber-800/80 mt-2">
              Ao salvar, você volta automaticamente para onde estava.
            </p>
          )}
        </div>
      )}

      {/* Provisório: quem travar numa dúvida fala com quem cuida do app. */}
      <a
        href={linkSuporte('Olá! Tenho uma dúvida sobre o meu cadastro no app da igreja.')}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 hover:bg-emerald-50 transition-colors"
      >
        <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-emerald-900">Ficou com dúvida?</span>
          <span className="block text-xs text-emerald-800/80">Chame no WhatsApp que a gente resolve.</span>
        </span>
      </a>

      {/* Quem a pessoa é na igreja. No primeiro acesso vem antes de tudo: é a
          resposta que a liderança mais precisa, e a que ninguém pensaria em
          procurar no fim da página. */}
      <VinculoIgrejaSection primeiroAcesso={Boolean(retorno)} />

      <MinhasInscricoes inscricoes={inscricoes} />

      <EditarPerfilForm
        nome={profile.nome}
        role={profile.role}
        titulo={profile.titulo}
        telefone={profile.telefone}
        email={profile.email ?? ''}
        avatarUrl={profile.avatar_url}
        dataNascimento1={profile.data_nascimento_1}
        dataNascimento2={profile.data_nascimento_2}
        dataCasamento={profile.data_casamento}
        endereco={profile.endereco}
        enderecoMaps={profile.endereco_maps}
        dependentesInit={dependentes}
        conjugeFilhos={conjugeFilhos}
        retorno={retorno}
      />
      <div className="rounded-xl border border-border bg-card p-4">
        <ConjugeVinculoSection />
      </div>
    </div>
  )
}
