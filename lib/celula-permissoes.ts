import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Quem pode mexer nos dados de uma célula e dos encontros dela.
 *
 * Existe porque toda função exportada de um arquivo `'use server'` é um
 * endereço HTTP: o identificador da action vai no pacote que o navegador
 * baixa, e qualquer pessoa logada pode chamá-la com os argumentos que quiser.
 * Como as actions escrevem pelo cliente admin — que ignora a RLS —, o id de
 * uma célula alheia bastava para editar o encontro dos outros.
 *
 * A régua: ser da célula, ou ter cargo de gestão. É de propósito que qualquer
 * membro entre, e não só o líder — quem foi escalado para a edificação escreve
 * o resumo pela mesma action, e a lista de lanche é preenchida a várias mãos.
 */
const CARGOS_GESTAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento']

export async function exigirPermissaoCelula(celulaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: membro } = await supabase
    .from('celula_membros')
    .select('papel')
    .eq('celula_id', celulaId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!membro && !CARGOS_GESTAO.includes(profile?.role ?? '')) {
    throw new Error('Sem permissão')
  }
  return user
}

/** A mesma checagem quando o que se tem em mãos é o encontro, e não a célula. */
export async function exigirPermissaoEncontro(encontroId: string): Promise<string> {
  const admin = createAdminClient()
  const { data: encontro } = await admin
    .from('encontros')
    .select('celula_id')
    .eq('id', encontroId)
    .maybeSingle()

  if (!encontro) throw new Error('Encontro não encontrado')
  await exigirPermissaoCelula(encontro.celula_id)
  return encontro.celula_id
}
