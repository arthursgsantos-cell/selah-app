import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'

/**
 * "Mandar parabéns" — o WhatsApp já aberto na conversa da pessoa, com a
 * mensagem escrita.
 *
 * A lista de aniversariantes só servia para lembrar; quem queria felicitar
 * tinha de sair do app, procurar o contato e pensar no que dizer. Aqui o
 * caminho inteiro cabe num toque.
 *
 * A mensagem é pessoal, não institucional: quem manda é o irmão que viu o
 * aniversário na tela, e assinar "a igreja" transformaria um gesto de amizade
 * em comunicado. Por isso também é curta — ponto de partida para a pessoa
 * completar do jeito dela, e não um cartão pronto que todo mundo manda igual.
 */
export function ParabensBtn({
  nome,
  telefone,
  compacto = false,
}: {
  nome: string
  telefone: string | null | undefined
  compacto?: boolean
}) {
  // Sem telefone não há para onde mandar — e um botão que abre o WhatsApp em
  // branco é pior que botão nenhum.
  const numero = (telefone ?? '').replace(/\D/g, '')
  if (numero.length < 10) return null

  const completo = numero.startsWith('55') ? numero : `55${numero}`
  const primeiroNome = nome.trim().split(' ')[0]
  const texto = encodeURIComponent(
    `Feliz aniversário, ${primeiroNome}! 🎉 Que Deus abençoe muito este seu novo ano de vida!`
  )
  const href = `https://wa.me/${completo}?text=${texto}`

  if (compacto) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Mandar parabéns para ${primeiroNome} no WhatsApp`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white transition-colors hover:bg-green-600"
      >
        <WhatsAppIcon className="h-4 w-4" />
      </a>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-green-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-green-600"
    >
      <WhatsAppIcon className="h-3.5 w-3.5" />
      Parabenizar
    </a>
  )
}
