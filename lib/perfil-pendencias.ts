/**
 * O que ainda falta no cadastro de alguém.
 *
 * O convite de perfil antes olhava só para `perfil_completado_em`: quem abriu a
 * tela uma vez e saiu sem digitar nada nunca mais era lembrado, e a igreja
 * ficava sem telefone de metade das pessoas. Aqui a pergunta é outra — não "já
 * passou pela tela?", e sim "os dados de que o app precisa estão lá?".
 *
 * A lista é curta de propósito. Cada campo aqui trava alguma coisa concreta:
 * sem telefone ninguém é chamado, sem aniversário ninguém é parabenizado, sem
 * endereço a célula não marca encontro na casa. Casamento, cônjuge e filhos
 * ficam de fora — são vida pessoal, não requisito; e o vínculo com a igreja tem
 * o caminho dele, que passa pela confirmação da liderança.
 */

export type CampoPendente = 'nome' | 'telefone' | 'nascimento' | 'endereco'

export interface Pendencia {
  campo: CampoPendente
  rotulo: string
  /** Por que o app precisa disso — a pessoa merece saber antes de digitar. */
  porque: string
}

/** Só o que a checagem precisa ler; qualquer perfil mais completo serve. */
export interface PerfilParaChecar {
  nome?: string | null
  telefone?: string | null
  data_nascimento_1?: string | null
  endereco?: string | null
}

const vazio = (v: string | null | undefined) => !v || v.trim() === ''

export function pendenciasDoPerfil(p: PerfilParaChecar): Pendencia[] {
  const lista: Pendencia[] = []

  // Quem entra pelo Google às vezes chega com um nome só. Um "Karoliny" solto
  // numa lista de presença não diz qual das Karolinys é.
  if (vazio(p.nome) || (p.nome ?? '').trim().split(/\s+/).length < 2) {
    lista.push({
      campo: 'nome',
      rotulo: 'Nome completo',
      porque: 'para não confundir você com outra pessoa nas listas',
    })
  }

  if (vazio(p.telefone)) {
    lista.push({
      campo: 'telefone',
      rotulo: 'Telefone / WhatsApp',
      porque: 'é por onde a liderança e a sua célula falam com você',
    })
  }

  if (vazio(p.data_nascimento_1)) {
    lista.push({
      campo: 'nascimento',
      rotulo: 'Data de nascimento',
      porque: 'para a igreja te parabenizar no seu aniversário',
    })
  }

  if (vazio(p.endereco)) {
    lista.push({
      campo: 'endereco',
      rotulo: 'Endereço',
      porque: 'ajuda a achar a célula mais perto e a marcar encontros',
    })
  }

  return lista
}
