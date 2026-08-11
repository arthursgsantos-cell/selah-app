/**
 * Áreas em que dá para servir.
 *
 * Lista fixa em vez de tabela: são as frentes da igreja, mudam de ano em ano e
 * não uma vez por semana — e uma tabela exigiria uma tela de cadastro inteira
 * para um dado que cabe aqui. Quando virar rotina mexer nisso, aí sim vale a
 * tabela.
 *
 * A chave é o que fica salvo em `solicitacoes.dados.areas`; mudar uma chave
 * quebra o histórico, então prefira acrescentar a renomear.
 */
export const MINISTERIOS = [
  { chave: 'louvor',       nome: 'Louvor',              descricao: 'Canto, instrumentos, ensaios' },
  { chave: 'midia',        nome: 'Mídia',               descricao: 'Som, projeção, transmissão, foto e vídeo' },
  { chave: 'recepcao',     nome: 'Recepção',            descricao: 'Acolher quem chega, entregar material' },
  { chave: 'infantil',     nome: 'Ministério infantil', descricao: 'Cuidar e ensinar as crianças' },
  { chave: 'adolescentes', nome: 'Adolescentes',        descricao: 'Acompanhar a galera mais nova' },
  { chave: 'diaconia',     nome: 'Diaconia',            descricao: 'Ceia, ordem do culto, apoio prático' },
  { chave: 'intercessao',  nome: 'Intercessão',         descricao: 'Grupo de oração' },
  { chave: 'ensino',       nome: 'Ensino',              descricao: 'Escola bíblica, cursos e materiais' },
  { chave: 'celulas',      nome: 'Células',             descricao: 'Liderar ou apoiar uma célula' },
  { chave: 'acao_social',  nome: 'Ação social',         descricao: 'Projetos de assistência e missões' },
  { chave: 'zeladoria',    nome: 'Zeladoria',           descricao: 'Cuidado do templo e da estrutura' },
] as const

export type ChaveMinisterio = (typeof MINISTERIOS)[number]['chave']

const NOME_POR_CHAVE = new Map(MINISTERIOS.map((m) => [m.chave as string, m.nome]))

/** Nome de exibição de uma área. Chave desconhecida volta como veio — é
 *  histórico de uma lista antiga, e sumir com o dado seria pior. */
export function nomeMinisterio(chave: string): string {
  return NOME_POR_CHAVE.get(chave) ?? chave
}
