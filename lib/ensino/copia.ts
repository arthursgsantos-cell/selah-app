/**
 * O que uma turma nova pode herdar da anterior.
 *
 * Abrir uma nova edição de um curso é quase sempre repetir a de antes: mesma
 * capa, mesma descrição, as mesmas doze aulas com os mesmos títulos e os mesmos
 * materiais. O que **nunca** vem junto são as datas — turma nova tem calendário
 * novo — nem os alunos, as presenças e as inscrições, que pertencem a quem
 * cursou.
 *
 * A lista vive aqui, e não na server action, porque um arquivo `'use server'`
 * só pode exportar funções assíncronas: uma constante exportada de lá quebra o
 * build.
 */

export interface OpcoesCopia {
  descricao: boolean
  capa: boolean
  fundo: boolean
  configuracoes: boolean
  inscricao: boolean
  professores: boolean
  aulas: boolean
  materiais: boolean
}

export const ITENS_COPIA: {
  chave: keyof OpcoesCopia
  label: string
  ajuda: string
}[] = [
  { chave: 'descricao',     label: 'Descrição da turma',   ajuda: 'O texto que abre a página' },
  { chave: 'capa',          label: 'Capas',                ajuda: 'A do card, em pé, e a 16:9 do destaque' },
  { chave: 'fundo',         label: 'Fundo da página',      ajuda: 'Cor, estilo e imagem de fundo' },
  { chave: 'configuracoes', label: 'Horários e formato',   ajuda: 'Dias, horário, local, vagas, videochamada' },
  { chave: 'inscricao',     label: 'Forma de inscrição',   ajuda: 'Pelo app, formulário, link ou WhatsApp' },
  { chave: 'professores',   label: 'Professores',          ajuda: 'A mesma equipe da turma anterior' },
  { chave: 'aulas',         label: 'Aulas',                ajuda: 'Quantidade, títulos e o conteúdo escrito — sem as datas' },
  { chave: 'materiais',     label: 'Materiais',            ajuda: 'Arquivos e links, ligados às mesmas aulas' },
]

export const COPIA_PADRAO: OpcoesCopia = {
  descricao: true,
  capa: true,
  fundo: true,
  configuracoes: true,
  inscricao: true,
  professores: true,
  aulas: true,
  materiais: true,
}

/**
 * Os itens que só podem ser copiados depois da turma criada.
 *
 * As capas ficam de fora: elas passam pelo formulário, onde continuam
 * trocáveis antes de salvar.
 */
export function copiaTemConteudo(opcoes: OpcoesCopia): boolean {
  return opcoes.fundo || opcoes.aulas || opcoes.materiais
}
