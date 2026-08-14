import { redirect } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, ShieldOff } from 'lucide-react'
import { UsuariosLista } from './_components/usuarios-lista'
import { PreCadastroSection } from './_components/pre-cadastro-section'
import type { Role } from '@/lib/supabase/types'

const PAGE_SIZE = 25

/**
 * Gestão de membros.
 *
 * A lista inteira da igreja é carregada de uma vez e filtrada aqui, em vez de
 * paginada no banco. É o que permite "selecionar todos os filtrados" — sem
 * conhecer o conjunto completo, o botão selecionaria só a página visível e a
 * secretaria acharia que mudou trinta pessoas quando mudou vinte e cinco.
 * O custo é aceitável: uma igreja tem membros na casa dos milhares, não dos
 * milhões, e as colunas carregadas são curtas.
 */
export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; cargo?: string; celula?: string; u?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/usuarios'))

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

  const [
    { data: perfis },
    { data: celulas },
    { data: redes },
    { data: igreja },
    { data: preCadastrosRaw },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nome, email, avatar_url, role, created_at, telefone, data_nascimento_1, data_nascimento_2, data_casamento, endereco, endereco_maps, conjuge_id')
      .eq('igreja_id', profile.igreja_id)
      .order('nome'),
    supabase.from('celulas').select('id, nome, rede_id, redes(nome)').eq('ativa', true).order('nome'),
    supabase.from('redes').select('id, nome').eq('igreja_id', profile.igreja_id).order('nome'),
    supabase.from('igrejas').select('codigo_convite').eq('id', profile.igreja_id).single(),
    supabase
      .from('membros_pre_cadastro')
      .select('id, nome, email, cargo, telefone, obs, celula_id, vinculo_casal, status, profile_id, created_at')
      .eq('igreja_id', profile.igreja_id)
      .order('created_at', { ascending: false }),
  ])

  const todos = perfis ?? []
  const userIds = todos.map((u) => u.id)

  const [{ data: membros }, { data: supervisores }] = await Promise.all([
    userIds.length > 0
      ? supabase.from('celula_membros').select('user_id, celula_id, papel, celulas(id, nome)').in('user_id', userIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    userIds.length > 0
      ? supabase.from('rede_supervisores').select('supervisor_id, rede_id, redes(id, nome)').in('supervisor_id', userIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

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

  const todosNomes = new Map(todos.map((u) => [u.id, u.nome as string]))

  const preCadastros = (preCadastrosRaw ?? []).map((pc: any) => ({
    ...pc,
    profile_nome: pc.profile_id ? (todosNomes.get(pc.profile_id) ?? null) : null,
  }))

  const comVinculos = todos.map((u) => ({
    ...u,
    conjuge_nome: u.conjuge_id ? (todosNomes.get(u.conjuge_id) ?? null) : null,
    memberships: membrosPorUser.get(u.id) ?? [],
    redes_supervisiona: redesPorUser.get(u.id) ?? [],
  }))

  const allRoles: Role[] = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider', 'lider_treinamento', 'membro', 'convidado']
  const roleCounts = Object.fromEntries(
    allRoles.map((r) => [r, comVinculos.filter((u) => u.role === r).length])
  ) as Record<Role, number>

  // ── Filtros ────────────────────────────────────────────────────────────
  const busca = params.q?.trim().toLowerCase() ?? ''
  const cargo = allRoles.includes(params.cargo as Role) ? (params.cargo as Role) : null
  const celulaFiltro = params.celula ?? null
  // `?u=` vem do sino de notificações: leva direto à ficha de quem entrou.
  const pessoa = params.u ?? null

  let filtrados = comVinculos
  if (pessoa) {
    filtrados = filtrados.filter((u) => u.id === pessoa)
  } else {
    if (busca) {
      filtrados = filtrados.filter(
        (u) =>
          u.nome.toLowerCase().includes(busca) ||
          (u.email ?? '').toLowerCase().includes(busca) ||
          (u.telefone ?? '').includes(busca)
      )
    }
    if (cargo) filtrados = filtrados.filter((u) => u.role === cargo)
    if (celulaFiltro === 'sem') {
      filtrados = filtrados.filter((u) => u.memberships.length === 0)
    } else if (celulaFiltro) {
      filtrados = filtrados.filter((u) => u.memberships.some((m) => m.celula_id === celulaFiltro))
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const page = Math.min(totalPaginas, Math.max(1, parseInt(params.page ?? '1', 10) || 1))
  const pagina = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const celulaOpts = (celulas ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    rede_nome: (c.redes as { nome: string } | null)?.nome ?? '',
  }))

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" render={<Link href="/pastor" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
      <div>
        <h1 className="text-xl font-bold">Membros</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cargos, células e vínculos — dá para mudar vários de uma vez
        </p>
      </div>

      <UsuariosLista
        usuarios={pagina}
        idsFiltrados={filtrados.map((u) => u.id)}
        currentUserId={user.id}
        celulaOpts={celulaOpts}
        redeOpts={redes ?? []}
        codigoIgreja={igreja?.codigo_convite ?? ''}
        roleCounts={roleCounts}
        totalGeral={comVinculos.length}
        semCelula={comVinculos.filter((u) => u.memberships.length === 0).length}
        page={page}
        totalPaginas={totalPaginas}
        searchInicial={params.q ?? ''}
        cargoAtual={cargo}
        celulaAtual={celulaFiltro}
        pessoaAtual={pessoa}
        todosUsuarios={comVinculos.map((u) => ({ id: u.id, nome: u.nome }))}
      />

      <PreCadastroSection
        preCadastros={preCadastros}
        membros={comVinculos.map((u) => ({ id: u.id, nome: u.nome }))}
        celulas={celulaOpts}
      />
    </div>
  )
}
