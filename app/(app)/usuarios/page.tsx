import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, ShieldOff } from 'lucide-react'
import { UsuariosLista } from './_components/usuarios-lista'
import { PreCadastroSection } from './_components/pre-cadastro-section'
import type { Role } from '@/lib/supabase/types'

const PAGE_SIZE = 20

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  if (profile.role !== 'pastor' && profile.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldOff className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-base font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Esta área é exclusiva para pastores.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const search = params.q?.trim() ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const searchFilter = search
    ? `nome.ilike.%${search}%,email.ilike.%${search}%`
    : null

  let usuariosQ = supabase
    .from('profiles')
    .select('id, nome, email, avatar_url, role, created_at, telefone, data_nascimento_1, data_nascimento_2, data_casamento, endereco, endereco_maps, conjuge_id')
    .eq('igreja_id', profile.igreja_id)
    .order('nome')
    .range(offset, offset + PAGE_SIZE - 1)
  if (searchFilter) usuariosQ = usuariosQ.or(searchFilter)

  let countQ = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('igreja_id', profile.igreja_id)
  if (searchFilter) countQ = countQ.or(searchFilter)

  const [
    { data: usuarios },
    { count: totalFiltrado },
    { data: statsData },
    { data: todosBasico },
    { data: celulas },
    { data: redes },
    { data: igreja },
    { data: preCadastrosRaw },
  ] = await Promise.all([
    usuariosQ,
    countQ,
    supabase.from('profiles').select('role').eq('igreja_id', profile.igreja_id),
    supabase.from('profiles').select('id, nome').eq('igreja_id', profile.igreja_id).order('nome'),
    supabase.from('celulas').select('id, nome, rede_id, redes(nome)').eq('ativa', true).order('nome'),
    supabase.from('redes').select('id, nome').eq('igreja_id', profile.igreja_id).order('nome'),
    supabase.from('igrejas').select('codigo_convite').eq('id', profile.igreja_id).single(),
    supabase
      .from('membros_pre_cadastro')
      .select('id, nome, telefone, obs, status, profile_id, created_at')
      .eq('igreja_id', profile.igreja_id)
      .order('created_at', { ascending: false }),
  ])

  const userIds = (usuarios ?? []).map((u) => u.id)

  const [{ data: membros }, { data: supervisores }] = await Promise.all([
    userIds.length > 0
      ? supabase.from('celula_membros').select('user_id, celula_id, papel, celulas(id, nome)').in('user_id', userIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    userIds.length > 0
      ? supabase.from('rede_supervisores').select('supervisor_id, rede_id, redes(id, nome)').in('supervisor_id', userIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  const allRoles: Role[] = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider', 'lider_treinamento', 'membro']
  const roleCounts = Object.fromEntries(
    allRoles.map((r) => [r, (statsData ?? []).filter((s: any) => s.role === r).length])
  ) as Record<Role, number>

  const membrosPorUser = new Map<string, { celula_id: string; celula_nome: string; papel: string }[]>()
  for (const m of membros ?? []) {
    const list = membrosPorUser.get(m.user_id) ?? []
    const cel = m.celulas as { id: string; nome: string } | null
    list.push({ celula_id: m.celula_id, celula_nome: cel?.nome ?? '—', papel: m.papel })
    membrosPorUser.set(m.user_id, list)
  }

  const redesPorUser = new Map<string, { rede_id: string; rede_nome: string }[]>()
  for (const s of supervisores ?? []) {
    const list = redesPorUser.get(s.supervisor_id) ?? []
    const rede = s.redes as { id: string; nome: string } | null
    list.push({ rede_id: s.rede_id, rede_nome: rede?.nome ?? '—' })
    redesPorUser.set(s.supervisor_id, list)
  }

  const todosNomes = new Map((todosBasico ?? []).map((u: any) => [u.id, u.nome as string]))

  const preCadastros = (preCadastrosRaw ?? []).map((pc: any) => ({
    ...pc,
    profile_nome: pc.profile_id ? (todosNomes.get(pc.profile_id) ?? null) : null,
  }))

  const usuariosComVinculos = (usuarios ?? []).map((u) => ({
    ...u,
    conjuge_nome: u.conjuge_id ? (todosNomes.get(u.conjuge_id) ?? null) : null,
    memberships: membrosPorUser.get(u.id) ?? [],
    redes_supervisiona: redesPorUser.get(u.id) ?? [],
  }))

  const celulaOpts = (celulas ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    rede_nome: (c.redes as { nome: string } | null)?.nome ?? '',
  }))

  const totalGeral = (statsData ?? []).length
  const totalPaginas = Math.max(1, Math.ceil((totalFiltrado ?? 0) / PAGE_SIZE))

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" render={<Link href="/pastor" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
      <div>
        <h1 className="text-xl font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie membros, cargos e vínculos de células
        </p>
      </div>

      <PreCadastroSection
        preCadastros={preCadastros}
        membros={(todosBasico ?? []) as { id: string; nome: string }[]}
      />

      <UsuariosLista
        usuarios={usuariosComVinculos}
        currentUserId={user.id}
        celulaOpts={celulaOpts}
        redeOpts={redes ?? []}
        codigoIgreja={igreja?.codigo_convite ?? ''}
        roleCounts={roleCounts}
        totalFiltrado={totalFiltrado ?? 0}
        totalGeral={totalGeral}
        page={page}
        totalPaginas={totalPaginas}
        searchInicial={search}
        todosUsuarios={(todosBasico ?? []) as { id: string; nome: string }[]}
      />
    </div>
  )
}
