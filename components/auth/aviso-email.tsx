import { Mail, AlertCircle } from 'lucide-react'

/**
 * Remetente real dos e-mails de autenticação.
 *
 * Hoje é o remetente compartilhado do Supabase, que costuma cair no lixo
 * eletrônico por não ter vínculo com um domínio nosso. Dizer de quem o e-mail
 * vem é o que permite a pessoa encontrá-lo. Se um dia configurarmos SMTP
 * próprio, basta trocar aqui.
 */
export const REMETENTE_EMAIL = 'noreply@mail.app.supabase.io'
export const REMETENTE_NOME = 'Supabase Auth'

interface Props {
  /** Assunto do e-mail, para a pessoa procurar na busca da caixa postal. */
  assunto?: string
}

export function AvisoEmail({ assunto }: Props) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2 text-left">
      <div className="flex items-start gap-2">
        <Mail className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="min-w-0 text-xs text-amber-900">
          <p className="font-semibold mb-0.5">Como encontrar o e-mail</p>
          <p className="leading-relaxed">
            Ele chega como{' '}
            <span className="font-medium break-all">
              {REMETENTE_NOME} &lt;{REMETENTE_EMAIL}&gt;
            </span>
            {assunto && (
              <>
                , com o assunto <span className="font-medium">&quot;{assunto}&quot;</span>
              </>
            )}
            .
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900 leading-relaxed">
          Se não estiver na caixa de entrada, <strong>olhe no spam / lixo eletrônico</strong> —
          é comum ele parar lá. Marcar como &quot;não é spam&quot; ajuda os próximos a chegarem direto.
        </p>
      </div>
    </div>
  )
}
