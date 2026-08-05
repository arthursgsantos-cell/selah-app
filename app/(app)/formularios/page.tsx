import { redirect } from 'next/navigation'
import { loginCom } from '@/lib/destino-login'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { FormulariosLista, type FormularioItem } from '@/components/formularios/formularios-lista'
import { ROLE_ORDER } from '@/lib/nav-items'
import type { CampoFormulario, Role } from '@/lib/supabase/types'

export default async function FormulariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginCom('/formularios'))

  const { data: profile } = await supabase
    .from('profiles').select('role, igreja_id').eq('id', user.id).single()

  if (!profile || ROLE_ORDER[profile.role as Role] < ROLE_ORDER.lider) {
    redirect('/home')
  }

  const admin = createAdminClient()

  const [{ data: formulariosData }, { data: eventosData }] = await Promise.all([
    admin
      .from('formularios')
      .select('id, nome, descricao, campos, template')
      .eq('igreja_id', profile.igreja_id)
      .order('criado_em', { ascending: false }),
    admin.from('eventos').select('formulario_id').not('formulario_id', 'is', null),
  ])

  // Quantos eventos usam cada formulário — impede exclusão acidental de algo em uso.
  const usoPorFormulario = new Map<string, number>()
  for (const e of (eventosData ?? []) as { formulario_id: string }[]) {
    usoPorFormulario.set(e.formulario_id, (usoPorFormulario.get(e.formulario_id) ?? 0) + 1)
  }

  const formularios: FormularioItem[] = (
    (formulariosData ?? []) as {
      id: string
      nome: string
      descricao: string | null
      campos: CampoFormulario[] | null
      template: boolean | null
    }[]
  ).map((f) => ({
    id: f.id,
    nome: f.nome,
    descricao: f.descricao,
    campos: f.campos ?? [],
    template: f.template ?? false,
    emUso: usoPorFormulario.get(f.id) ?? 0,
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <Button variant="ghost" size="sm" render={<Link href="/eventos" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Eventos
      </Button>

      <div>
        <h1 className="text-xl font-semibold">Formulários</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Crie formulários de inscrição e salve os que usa sempre como templates.
        </p>
      </div>

      <FormulariosLista formularios={formularios} />
    </div>
  )
}
