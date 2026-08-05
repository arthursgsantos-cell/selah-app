'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getCallerPastorIgreja() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'pastor' && profile.role !== 'admin'))
    throw new Error('Sem permissão')

  return { userId: user.id, igrejaId: profile.igreja_id }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function parseGeminiError(status: number, body: string): string {
  try {
    const json = JSON.parse(body)
    const code = json?.error?.code ?? status
    const apiStatus = json?.error?.status ?? ''
    if (code === 400 && apiStatus === 'INVALID_ARGUMENT') return 'Chave da API Gemini inválida. Verifique a configuração do servidor.'
    if (code === 429 || apiStatus === 'RESOURCE_EXHAUSTED') return 'Limite de uso da IA atingido. Tente novamente mais tarde.'
    if (code === 404) return 'Modelo de IA indisponível. Entre em contato com o suporte.'
    if (code === 503) return 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.'
  } catch { /* ignora parse error */ }
  return `Erro ao comunicar com a IA (status ${status}).`
}

async function summarizePdfWithGemini(arrayBuffer: ArrayBuffer): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Configuração de IA ausente no servidor.')

  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            {
              text: 'Este é o roteiro ou notas de uma mensagem/pregação de culto evangélico. Faça um resumo estruturado e claro da mensagem com os pontos principais, versículos-chave e aplicações práticas. Escreva em português do Brasil, de forma acessível para os membros de uma célula. Máximo de 350 palavras.',
            },
          ],
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(parseGeminiError(response.status, errText))
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('IA não retornou texto. Tente novamente.')
  return text
}

export async function analisarResumoPdfAction(
  formData: FormData
): Promise<{ pdfUrl: string; resumo: string; geminiErro: string | null }> {
  await getCallerPastorIgreja()

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')
  if (file.type !== 'application/pdf') throw new Error('Somente arquivos PDF são aceitos')

  const arrayBuffer = await file.arrayBuffer()
  const path = `${crypto.randomUUID()}.pdf`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('resumos-culto')
    .upload(path, arrayBuffer, { contentType: 'application/pdf' })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = admin.storage.from('resumos-culto').getPublicUrl(path)

  let resumo = ''
  let geminiErro: string | null = null
  try {
    resumo = await summarizePdfWithGemini(arrayBuffer)
  } catch (geminiErr) {
    geminiErro = geminiErr instanceof Error ? geminiErr.message : 'Erro desconhecido'
  }

  return { pdfUrl: publicUrl, resumo, geminiErro }
}

export async function createResumoCultoAction(data: {
  titulo: string
  conteudo: string
  pdf_url?: string | null
  data_culto: string
  validade_ate?: string
}) {
  const { userId, igrejaId } = await getCallerPastorIgreja()
  const validadeAte = data.validade_ate ?? addDays(data.data_culto, 7)

  const admin = createAdminClient()
  const { error } = await admin.from('resumos_culto').insert({
    titulo: data.titulo,
    conteudo: data.conteudo,
    pdf_url: data.pdf_url ?? null,
    data_culto: data.data_culto,
    validade_ate: validadeAte,
    igreja_id: igrejaId,
    created_by: userId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
}

export async function extenderValidadeAction(id: string) {
  await getCallerPastorIgreja()

  const admin = createAdminClient()
  const { data: resumo } = await admin
    .from('resumos_culto')
    .select('validade_ate')
    .eq('id', id)
    .single()

  if (!resumo) throw new Error('Resumo não encontrado')
  const novaValidade = addDays(resumo.validade_ate, 7)

  const { error } = await admin
    .from('resumos_culto')
    .update({ validade_ate: novaValidade })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
}

export async function updateResumoCultoAction(id: string, conteudo: string) {
  await getCallerPastorIgreja()

  const admin = createAdminClient()
  const { error } = await admin
    .from('resumos_culto')
    .update({ conteudo })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
}
