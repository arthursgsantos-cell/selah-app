/**
 * Regras de leitura da solicitação de célula, compartilhadas entre o
 * formulário (client) e os painéis que exibem o pedido.
 */

/** "Casado(a)", "casado", "Casada" — todas as formas que o formulário já gravou. */
export function ehCasado(estadoCivil: string | null | undefined): boolean {
  return (estadoCivil ?? '').trim().toLowerCase().startsWith('casad')
}
