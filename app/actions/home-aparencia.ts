'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Aparência da página inicial.
 *
 * A configuração vive em `igrejas` porque a home não pertence a nenhuma
 * célula, rede ou evento — é a página da igreja. Só pastor e admin mexem.
 */

const HEX = /^#[0-9a-f]{6}$/i

async function exigirPermissao(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: perfil } = await supabase
    .from('profiles')
    .select('igreja_id, role')
    .eq('id', user.id)
    .single()

  if (!perfil || !['pastor', 'admin'].includes(perfil.role)) {
    throw new Error('Só a liderança da igreja altera a página inicial.')
  }
  return perfil.igreja_id
}

export async function atualizarFundoHomeAction(aparencia: {
  cor: string
  cor_secundaria: string
  fundo_tipo: string | null
  fundo_opacidade?: number
}) {
  const igrejaId = await exigirPermissao()

  if (!HEX.test(aparencia.cor) || !HEX.test(aparencia.cor_secundaria)) {
    throw new Error('Cor inválida')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('igrejas')
    .update({
      cor: aparencia.cor,
      cor_secundaria: aparencia.cor_secundaria,
      fundo_tipo: aparencia.fundo_tipo,
      ...(aparencia.fundo_opacidade === undefined
        ? {}
        : { fundo_opacidade: aparencia.fundo_opacidade }),
    })
    .eq('id', igrejaId)

  if (error) throw new Error(error.message)
  revalidatePath('/home')
}

export async function uploadFundoHomeAction(formData: FormData): Promise<string> {
  const igrejaId = await exigirPermissao()

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error('Arquivo inválido')

  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const caminho = `fundo/${igrejaId}/${Date.now()}.${extensao}`

  const admin = createAdminClient()
  const { error: erroUpload } = await admin.storage
    .from('igreja-logos')
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg', upsert: false })

  if (erroUpload) throw new Error(erroUpload.message)

  const { data } = admin.storage.from('igreja-logos').getPublicUrl(caminho)

  const { error } = await admin
    .from('igrejas')
    .update({ fundo_imagem_url: data.publicUrl, fundo_tipo: 'imagem' })
    .eq('id', igrejaId)

  if (error) throw new Error(error.message)
  revalidatePath('/home')
  return data.publicUrl
}

export async function atualizarFundoGaleriaHomeAction(dados: {
  ativo: boolean
  opacidade: number
}) {
  const igrejaId = await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin
    .from('igrejas')
    .update({ fundo_galeria: dados.ativo, fundo_galeria_opacidade: dados.opacidade })
    .eq('id', igrejaId)

  if (error) throw new Error(error.message)
  revalidatePath('/home')
}
