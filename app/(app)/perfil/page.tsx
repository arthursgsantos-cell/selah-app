'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EditarPerfilForm } from '@/components/perfil/editar-perfil-form'
import { ConjugeVinculoSection } from '@/components/perfil/conjuge-vinculo-section'
import { SolicitarCargoSection } from '@/components/perfil/solicitar-cargo-section'
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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dependentes, setDependentes] = useState<DependenteItem[]>([])
  const [conjugeFilhos, setConjugeFilhos] = useState<Array<{ nome: string; data_nascimento: string | null }>>([])
  const [erro, setErro] = useState<string | null>(null)
  const [jaPendente, setJaPendente] = useState(false)
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
      const [profileResult, deps, conjugeDados, solicitacao] = await Promise.all([
        supabase
          .from('profiles')
          .select('nome, role, titulo, telefone, email, avatar_url, data_nascimento_1, data_nascimento_2, data_casamento, endereco, endereco_maps')
          .eq('id', session.user.id)
          .single(),
        buscarDependentesAction().catch(() => [] as DependenteItem[]),
        buscarDadosConjugeAction().catch(() => null),
        supabase
          .from('solicitacoes_cargo')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('status', 'pendente')
          .maybeSingle(),
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
      setJaPendente(!!solicitacao.data)
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
      />
      <div className="rounded-xl border border-border bg-card p-4">
        <ConjugeVinculoSection />
      </div>
      <SolicitarCargoSection roleAtual={profile.role} jaPendente={jaPendente} />
    </div>
  )
}
