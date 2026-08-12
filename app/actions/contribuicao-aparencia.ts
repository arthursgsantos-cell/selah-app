'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Aparência da página de contribuição — cor, gradiente, nébula ou imagem.
 *
 * Dedicada, e não a mesma da home: a tesouraria pode querer uma identidade
 * própria para a página do dízimo sem mudar a cara da home. Sem galeria de
 * fotos — não há um álbum natural de "fotos da contribuição" como célula ou
 * evento têm.
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
    throw new Error('Só a liderança da igreja altera esta página.')
  }
  return perfil.igreja_id
}

export async function atualizarFundoContribuicaoAction(aparencia: {
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
      contribuicao_cor: aparencia.cor,
      contribuicao_cor_secundaria: aparencia.cor_secundaria,
      contribuicao_fundo_tipo: aparencia.fundo_tipo,
      ...(aparencia.fundo_opacidade === undefined
        ? {}
        : { contribuicao_fundo_opacidade: aparencia.fundo_opacidade }),
    })
    .eq('id', igrejaId)

  if (error) throw new Error(error.message)
  revalidatePath('/contribuir')
}

export async function uploadFundoContribuicaoAction(formData: FormData): Promise<string> {
  const igrejaId = await exigirPermissao()

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error('Arquivo inválido')

  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const caminho = `fundo-contribuicao/${igrejaId}/${Date.now()}.${extensao}`

  const admin = createAdminClient()
  const { error: erroUpload } = await admin.storage
    .from('igreja-logos')
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg', upsert: false })

  if (erroUpload) throw new Error(erroUpload.message)

  const { data } = admin.storage.from('igreja-logos').getPublicUrl(caminho)

  const { error } = await admin
    .from('igrejas')
    .update({ contribuicao_fundo_imagem_url: data.publicUrl, contribuicao_fundo_tipo: 'imagem' })
    .eq('id', igrejaId)

  if (error) throw new Error(error.message)
  revalidatePath('/contribuir')
  return data.publicUrl
}
