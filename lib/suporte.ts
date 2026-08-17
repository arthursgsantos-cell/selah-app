/**
 * Canal de dúvidas do app.
 *
 * Provisório e de propósito: enquanto o cadastro é novo para todo mundo, quem
 * travar numa pergunta fala direto com quem cuida do app, em vez de desistir na
 * metade. Quando isso deixar de ser necessário, é uma constante só para apagar.
 */

/** Número no formato do WhatsApp: país + DDD + número, só dígitos. */
export const WHATSAPP_SUPORTE = '5584988601406'

export function linkSuporte(mensagem: string): string {
  return `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(mensagem)}`
}
