import Link from 'next/link'
import { ArrowLeft, HandCoins, Landmark, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PixIgreja } from '@/components/contribuir/pix-igreja'
import { PAINEL, SECAO } from '@/lib/estilos'
import type { TipoChavePix } from '@/lib/pix'

export const metadata = {
  title: 'Dízimos e ofertas',
  description: 'Contribua com a igreja por PIX.',
}

/**
 * Dízimos e ofertas.
 *
 * Aberta a visitante de propósito: é a página que vai no link da bio e no
 * telão, e exigir login para contribuir não faz sentido nenhum.
 *
 * O QR é montado aqui a partir da chave guardada em `igrejas` — não é imagem
 * subida por alguém. Quando a tesouraria troca a chave, o QR troca junto, sem
 * sobrar PNG antigo circulando por aí.
 */
export default async function ContribuirPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('igreja_id').eq('id', user.id).single()
    : { data: null }

  const admin = createAdminClient()

  const igrejaId = (profile as { igreja_id: string } | null)?.igreja_id ?? null
  const { data: igrejaData } = igrejaId
    ? await admin
        .from('igrejas')
        .select('nome, logo_url, pix_chave, pix_tipo, pix_nome, pix_cidade, contribuicao_texto, contribuicao_ativa, dados_bancarios')
        .eq('id', igrejaId)
        .maybeSingle()
    : await admin
        .from('igrejas')
        .select('nome, logo_url, pix_chave, pix_tipo, pix_nome, pix_cidade, contribuicao_texto, contribuicao_ativa, dados_bancarios')
        .limit(1)
        .maybeSingle()

  const igreja = igrejaData as {
    nome: string; logo_url: string | null
    pix_chave: string | null; pix_tipo: string | null; pix_nome: string | null; pix_cidade: string | null
    contribuicao_texto: string | null; contribuicao_ativa: boolean | null; dados_bancarios: string | null
  } | null

  const pixPronto = Boolean(igreja?.contribuicao_ativa && igreja?.pix_chave && igreja?.pix_tipo)

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">
      <Button variant="ghost" size="sm" render={<Link href="/home" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Cabeçalho */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0B2447] to-[#0F52BA] px-6 py-7 text-white text-center shadow-lg">
        {igreja?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={igreja.logo_url}
            alt=""
            aria-hidden
            className="h-14 w-14 rounded-xl bg-white p-1.5 object-contain mx-auto mb-4 shadow-lg"
          />
        )}
        <HandCoins className="h-5 w-5 mx-auto mb-2 text-blue-200/80" />
        <h1 className="text-xl font-bold">Dízimos e ofertas</h1>
        <p className="text-xs text-blue-100/70 mt-1">{igreja?.nome ?? 'Nossa igreja'}</p>
      </div>

      {igreja?.contribuicao_texto && (
        <div className={PAINEL}>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {igreja.contribuicao_texto}
          </p>
        </div>
      )}

      {pixPronto ? (
        <div className={SECAO}>
          <PixIgreja
            chave={igreja!.pix_chave!}
            tipo={igreja!.pix_tipo as TipoChavePix}
            nome={igreja!.pix_nome?.trim() || igreja!.nome}
            cidade={igreja!.pix_cidade}
          />
        </div>
      ) : (
        <div className={`${PAINEL} text-center py-10`}>
          <HandCoins className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-sm">Contribuição ainda não configurada</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            A liderança precisa cadastrar a chave PIX da igreja no painel de administração
            para que o QR code apareça aqui.
          </p>
        </div>
      )}

      {igreja?.dados_bancarios && (
        <div className={SECAO}>
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Transferência bancária</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line font-mono">
            {igreja.dados_bancarios}
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 px-1 text-[11px] text-muted-foreground leading-relaxed">
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
        <p>
          O pagamento acontece dentro do app do seu banco — nem este site nem a igreja
          têm acesso aos seus dados bancários.
        </p>
      </div>
    </div>
  )
}
