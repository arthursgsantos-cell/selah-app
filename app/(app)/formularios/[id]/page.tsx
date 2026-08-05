import { redirect, notFound } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FormularioEditor } from '@/components/formularios/formulario-editor'
import { ROLE_ORDER } from '@/lib/nav-items'
import { FORMULARIO_TEMPLATES } from '@/lib/formulario-templates'
import type { CampoFormulario, Role } from '@/lib/supabase/types'

/**
 * Editor de formulário em página inteira.
 *
 * `id` pode ser:
 *  - "novo"          → formulário em branco
 *  - "novo?tpl=N"    → parte de um template pronto
 *  - um uuid          → edita o formulário existente
 */
export default async function FormularioEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tpl?: string }>
}) {
  const { id } = await params
  const { tpl } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom(`/formularios/${id}`))

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || ROLE_ORDER[profile.role as Role] < ROLE_ORDER.lider) {
    redirect('/home')
  }

  if (id === 'novo') {
    const base = tpl !== undefined ? FORMULARIO_TEMPLATES[Number(tpl)] : undefined
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <FormularioEditor
          formularioId={null}
          inicial={{
            nome: base ? base.nome : '',
            descricao: base?.descricao ?? '',
            campos: base ? structuredClone(base.campos) : [],
            template: false,
          }}
        />
      </div>
    )
  }

  const admin = createAdminClient()
  const { data: formulario } = await admin
    .from('formularios')
    .select('id, nome, descricao, campos, template')
    .eq('id', id)
    .single()

  if (!formulario) notFound()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <FormularioEditor
        formularioId={formulario.id}
        inicial={{
          nome: formulario.nome,
          descricao: formulario.descricao ?? '',
          campos: (formulario.campos ?? []) as CampoFormulario[],
          template: formulario.template ?? false,
        }}
      />
    </div>
  )
}
