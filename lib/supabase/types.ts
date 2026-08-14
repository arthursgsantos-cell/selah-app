export type Role = 'admin' | 'pastor' | 'supervisor' | 'supervisor_treinamento' | 'lider' | 'lider_treinamento' | 'membro' | 'convidado'
export type StatusPreCadastro = 'pendente' | 'confirmado' | 'rejeitado'
export type TipoNotificacao =
  | 'novo_login'
  | 'match_sugerido'
  | 'match_confirmado'
  /** Pedido de inscrição numa turma, enviado aos professores dela. */
  | 'inscricao_ensino'
export type StatusPresenca = 'confirmado' | 'ausente' | 'pendente'
export type Frequencia = 'semanal' | 'quinzenal'
export type StatusEncontro = 'agendado' | 'realizado' | 'cancelado'
export type FuncaoEscala = 'anfitriao' | 'louvor' | 'quebra_gelo' | 'edificacao' | 'compartilhar' | 'lanche' | 'card'
export type PapelCelula = 'lider' | 'membro'
export type TipoEvento = 'culto' | 'igreja' | 'rede' | 'celula' | 'outro'
export type RecorrenciaTipo = 'semanal' | 'quinzenal' | 'mensal'
export type TipoInscricao = 'aberto' | 'whatsapp' | 'formulario' | 'pix' | 'link'
export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
export type TipoImportacao =
  | 'roteiro'
  | 'foto_celula'
  | 'evento'
  /** Card de informações do encontro da célula. */
  | 'encontro_celula'
  /** Um item da lista de lanche daquele encontro. */
  | 'lanche'
export type StatusImportacao = 'importado' | 'ignorado' | 'pendente' | 'erro'
export type TipoSecaoEvento = 'inscricao' | 'botoes' | 'cards' | 'video' | 'fotos'
/** Pedidos que chegam pela home pública, na tabela `solicitacoes`. */
export type TipoSolicitacao = 'voluntario' | 'membresia'
export type StatusSolicitacao = 'pendente' | 'em_andamento' | 'atendido' | 'arquivado'

// --- Consolidação ---------------------------------------------------------
/**
 * Etapa da pessoa acolhida. A ordem importa: o funil da página
 * `/consolidacao` é desenhado nesta sequência, e `afastado` fica de fora dela
 * de propósito — é saída, não etapa seguinte.
 */
export type EtapaConsolidacao =
  | 'acolhido'
  | 'atribuido'
  | 'em_acompanhamento'
  | 'integrado'
  | 'afastado'
export type OrigemConsolidacao = 'culto' | 'celula' | 'evento' | 'indicacao' | 'outro'
export type DecisaoConsolidacao = 'aceitou_jesus' | 'reconciliacao' | 'visitante'
export type CanalContato = 'whatsapp' | 'ligacao' | 'presencial' | 'outro'
export type ResultadoContato = 'falou' | 'sem_resposta' | 'remarcado'

// --- Ensino ---------------------------------------------------------------
/**
 * Papel dentro do Ensino. Deliberadamente fora de `Role`: `ROLE_ORDER` compara
 * cargos por hierarquia, e dar aula não é um degrau dessa escada — um membro
 * comum pode ser professor.
 */
export type PapelEnsino = 'professor' | 'coordenador'
export type StatusTurma = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'
/**
 * Como a turma acontece. `gravado` é o curso de catálogo: sem data de aula,
 * sem chamada, a pessoa assiste no ritmo dela e marca o que já viu
 * (`ensino_progresso`). Default `presencial`, que é o comportamento de sempre.
 */
export type ModoTurma = 'presencial' | 'gravado'
export type StatusInscricaoEnsino = 'pendente' | 'aprovada' | 'recusada' | 'cancelada' | 'concluida'
/**
 * Quem criou a inscrição. `manual` é a que o professor digitou pelo painel —
 * pode nem ter `user_id`, porque a pessoa ainda não usa o app.
 */
export type OrigemInscricaoEnsino = 'app' | 'manual'
export type StatusAula = 'agendada' | 'realizada' | 'cancelada'
export type TipoMaterial = 'arquivo' | 'link' | 'video'
/**
 * Como a pessoa se inscreve numa turma. Só `link` manda para fora sem deixar
 * rastro: nele o app não registra inscrição nem monta lista de chamada.
 * `whatsapp` grava a inscrição como o caminho do app e depois leva ao grupo da
 * turma — entrar no grupo é a confirmação, não o cadastro.
 */
export type TipoInscricaoTurma = 'app' | 'formulario' | 'link' | 'whatsapp'
/**
 * De onde sai o link de "entrar na videochamada". `turma` é a sala fixa do
 * curso inteiro; `aula`, um link por encontro — o que sai de quem agenda cada
 * aula no Google Agenda. É escolha do professor, e não dedução dos links
 * preenchidos: aula sem link seria ambígua entre "usa o da turma" e "ainda não
 * tem".
 */
export type ModoVideoChamada = 'nenhum' | 'turma' | 'aula'
export type CampoFormulario = {
  id: string
  tipo: 'texto' | 'email' | 'telefone' | 'numero' | 'opcoes' | 'checkbox' | 'textarea' | 'grupo'
  label: string
  obrigatorio: boolean
  opcoes?: string[]
  /**
   * Só aparece quando o campo referenciado tiver um dos valores listados.
   * Ex.: "Nome dos filhos" só surge se "Tem filhos?" for "Sim".
   */
  condicao?: {
    campoId: string
    valores: string[]
  }
  /**
   * Campo do tipo 'grupo': repete os subcampos N vezes, onde N é o valor de um
   * campo numérico. Ex.: "Quantos filhos?" = 3 → três blocos de nome e idade.
   */
  repetirPorCampoId?: string
  /** Subcampos do grupo repetido. */
  subcampos?: CampoFormulario[]
  /** Teto de repetições, para o formulário não explodir por engano de digitação. */
  maxRepeticoes?: number
}

/**
 * Os três tipos de atividade.
 *
 * `tarefa` é a livre ("faça as questões do livro X") — o aluno marca feito e
 * comenta. `leitura` gera um cronograma de capítulos que ele vai riscando.
 * `quiz` é a prova, com perguntas e correção.
 */
export type TipoAtividade = 'tarefa' | 'leitura' | 'quiz'

/**
 * `entregue` é o aluno terminando; `corrigida` é o professor devolvendo.
 * O quiz só de marcar pula direto para `corrigida`, porque o app já sabe a nota.
 */
export type StatusEntrega = 'pendente' | 'entregue' | 'corrigida'

/** Blocos que o professor arrasta para montar a página da atividade. */
export type TipoSecaoAtividade = 'texto' | 'imagem' | 'video' | 'perguntas'

/** `unica`/`multipla` o app corrige sozinho; `texto`/`longo` esperam leitura. */
export type TipoPergunta = 'unica' | 'multipla' | 'texto' | 'longo'

export interface OpcaoPergunta {
  id: string
  texto: string
  /** Nunca chega à tela do aluno antes da correção. */
  correta: boolean
}

/** Um pedaço de Bíblia: "Tiago 1 a 5", "Mateus inteiro". */
export interface TrechoLeitura {
  livroId: number
  capituloInicio: number
  capituloFim: number
}

/**
 * A receita do plano de leitura — o que gerou o cronograma, não o cronograma.
 *
 * `repeticoes`: ler o mesmo trecho N vezes até o prazo (as 30 voltas em Tiago).
 * `percurso`: atravessar os trechos uma vez só (Mateus a Apocalipse até o dia X).
 */
export interface ConfigLeitura {
  modo: 'repeticoes' | 'percurso'
  trechos: TrechoLeitura[]
  repeticoes: number
}

export type Testamento = 'AT' | 'NT'

export type Database = {
  public: {
    Tables: {
      igrejas: {
        Row: {
          id: string
          nome: string
          slug: string
          logo_url: string | null
          codigo_convite: string
          descricao: string | null
          horario_culto: string | null
          endereco: string | null
          fundada_em: string | null
          instagram_url: string | null
          facebook_url: string | null
          youtube_url: string | null
          pastor_nome: string | null
          pastor_titulo: string | null
          spotify_url: string | null
          // Contribuição — o QR de dízimo é montado a partir da chave.
          pix_chave: string | null
          pix_tipo: TipoChavePix | null
          pix_nome: string | null
          pix_cidade: string | null
          contribuicao_texto: string | null
          dados_bancarios: string | null
          contribuicao_ativa: boolean
          contribuicao_cor: string | null
          contribuicao_cor_secundaria: string | null
          contribuicao_fundo_tipo: string | null
          contribuicao_fundo_imagem_url: string | null
          contribuicao_fundo_opacidade: number
          // Transmissão do culto. `ao_vivo_ativo` é chave de mão da liderança.
          ao_vivo_url: string | null
          ao_vivo_ativo: boolean
          // Ordem e textos dos cartões institucionais da home — lib/home-secoes.ts.
          home_secoes_ordem: string[] | null
          home_secoes_textos: Record<string, { titulo?: string | null; subtitulo?: string | null }> | null
          // Aparência da página inicial. `fundo_tipo` nulo = fundo padrão do app.
          cor: string | null
          cor_secundaria: string | null
          fundo_tipo: string | null
          fundo_imagem_url: string | null
          fundo_opacidade: number
          fundo_galeria: boolean
          fundo_galeria_opacidade: number
          fundo_auto_cor: boolean
          fundo_auto_cor_origem: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          slug: string
          logo_url?: string | null
          codigo_convite: string
          descricao?: string | null
          horario_culto?: string | null
          endereco?: string | null
          fundada_em?: string | null
          instagram_url?: string | null
          facebook_url?: string | null
          youtube_url?: string | null
          pastor_nome?: string | null
          pastor_titulo?: string | null
          spotify_url?: string | null
          pix_chave?: string | null
          pix_tipo?: TipoChavePix | null
          pix_nome?: string | null
          pix_cidade?: string | null
          contribuicao_texto?: string | null
          dados_bancarios?: string | null
          contribuicao_ativa?: boolean
          contribuicao_cor?: string | null
          contribuicao_cor_secundaria?: string | null
          contribuicao_fundo_tipo?: string | null
          contribuicao_fundo_imagem_url?: string | null
          contribuicao_fundo_opacidade?: number
          ao_vivo_url?: string | null
          ao_vivo_ativo?: boolean
          home_secoes_ordem?: string[] | null
          home_secoes_textos?: Record<string, { titulo?: string | null; subtitulo?: string | null }> | null
          cor?: string | null
          cor_secundaria?: string | null
          fundo_tipo?: string | null
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          slug?: string
          logo_url?: string | null
          codigo_convite?: string
          descricao?: string | null
          horario_culto?: string | null
          endereco?: string | null
          fundada_em?: string | null
          instagram_url?: string | null
          facebook_url?: string | null
          youtube_url?: string | null
          pastor_nome?: string | null
          pastor_titulo?: string | null
          spotify_url?: string | null
          pix_chave?: string | null
          pix_tipo?: TipoChavePix | null
          pix_nome?: string | null
          pix_cidade?: string | null
          contribuicao_texto?: string | null
          dados_bancarios?: string | null
          contribuicao_ativa?: boolean
          contribuicao_cor?: string | null
          contribuicao_cor_secundaria?: string | null
          contribuicao_fundo_tipo?: string | null
          contribuicao_fundo_imagem_url?: string | null
          contribuicao_fundo_opacidade?: number
          ao_vivo_url?: string | null
          ao_vivo_ativo?: boolean
          home_secoes_ordem?: string[] | null
          home_secoes_textos?: Record<string, { titulo?: string | null; subtitulo?: string | null }> | null
          cor?: string | null
          cor_secundaria?: string | null
          fundo_tipo?: string | null
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          igreja_id: string
          nome: string
          email: string | null
          telefone: string | null
          titulo: string | null
          avatar_url: string | null
          role: Role
          conjuge_id: string | null
          data_nascimento_1: string | null
          data_nascimento_2: string | null
          data_casamento: string | null
          endereco: string | null
          endereco_maps: string | null
          endereco_complemento: string | null
          endereco_latitude: number | null
          endereco_longitude: number | null
          perfil_completado_em: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          igreja_id: string
          nome: string
          email?: string | null
          telefone?: string | null
          titulo?: string | null
          avatar_url?: string | null
          role?: Role
          conjuge_id?: string | null
          data_nascimento_1?: string | null
          data_nascimento_2?: string | null
          data_casamento?: string | null
          endereco?: string | null
          endereco_maps?: string | null
          endereco_complemento?: string | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          perfil_completado_em?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          email?: string | null
          telefone?: string | null
          titulo?: string | null
          avatar_url?: string | null
          role?: Role
          conjuge_id?: string | null
          data_nascimento_1?: string | null
          data_nascimento_2?: string | null
          data_casamento?: string | null
          endereco?: string | null
          endereco_maps?: string | null
          endereco_complemento?: string | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          perfil_completado_em?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_igreja_id_fkey'
            columns: ['igreja_id']
            isOneToOne: false
            referencedRelation: 'igrejas'
            referencedColumns: ['id']
          }
        ]
      }
      dependentes: {
        Row: {
          id: number
          profile_id: string
          nome: string
          data_nascimento: string | null
          tipo: 'cônjuge' | 'filho'
          sexo: 'M' | 'F' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          profile_id: string
          nome: string
          data_nascimento?: string | null
          tipo: 'cônjuge' | 'filho'
          sexo?: 'M' | 'F' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          profile_id?: string
          nome?: string
          data_nascimento?: string | null
          tipo?: 'cônjuge' | 'filho'
          sexo?: 'M' | 'F' | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dependentes_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      redes: {
        Row: {
          id: string
          igreja_id: string
          nome: string
          descricao: string | null
          cor: string
          cor_secundaria: string | null
          fundo_tipo: string
          fundo_imagem_url: string | null
          fundo_opacidade: number
          fundo_galeria: boolean
          fundo_galeria_opacidade: number
          fundo_auto_cor: boolean
          fundo_auto_cor_origem: string | null
          logo_url: string | null
          capa_url: string | null
          supervisor_nome: string | null
          created_at: string
        }
        Insert: {
          id?: string
          igreja_id: string
          nome: string
          descricao?: string | null
          cor?: string
          cor_secundaria?: string | null
          fundo_tipo?: string
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          logo_url?: string | null
          capa_url?: string | null
          supervisor_nome?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          descricao?: string | null
          cor?: string
          cor_secundaria?: string | null
          fundo_tipo?: string
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          logo_url?: string | null
          capa_url?: string | null
          supervisor_nome?: string | null
          created_at?: string
        }
        Relationships: []
      }
      rede_supervisores: {
        Row: {
          rede_id: string
          supervisor_id: string
        }
        Insert: {
          rede_id: string
          supervisor_id: string
        }
        Update: {
          rede_id?: string
          supervisor_id?: string
        }
        Relationships: []
      }
      celulas: {
        Row: {
          id: string
          rede_id: string
          nome: string
          descricao: string | null
          capa_url: string | null
          logo_url: string | null
          cor: string | null
          cor_secundaria: string | null
          fundo_tipo: string
          fundo_imagem_url: string | null
          fundo_opacidade: number
          fundo_galeria: boolean
          fundo_galeria_opacidade: number
          fundo_auto_cor: boolean
          fundo_auto_cor_origem: string | null
          capa_automatica: boolean
          frequencia: Frequencia
          dia_semana: number | null
          horario: string | null
          local_padrao: string | null
          lider_nome: string | null
          ativa: boolean
          celula_mae_id: string | null
          multiplicacao_prevista: string | null
          created_at: string
        }
        Insert: {
          id?: string
          rede_id: string
          nome: string
          descricao?: string | null
          capa_url?: string | null
          logo_url?: string | null
          cor?: string | null
          cor_secundaria?: string | null
          fundo_tipo?: string
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          capa_automatica?: boolean
          frequencia?: Frequencia
          dia_semana?: number | null
          horario?: string | null
          local_padrao?: string | null
          lider_nome?: string | null
          ativa?: boolean
          celula_mae_id?: string | null
          multiplicacao_prevista?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          rede_id?: string
          nome?: string
          descricao?: string | null
          capa_url?: string | null
          logo_url?: string | null
          cor?: string | null
          cor_secundaria?: string | null
          fundo_tipo?: string
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          capa_automatica?: boolean
          frequencia?: Frequencia
          dia_semana?: number | null
          horario?: string | null
          local_padrao?: string | null
          lider_nome?: string | null
          ativa?: boolean
          celula_mae_id?: string | null
          multiplicacao_prevista?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "celulas_rede_id_fkey"
            columns: ["rede_id"]
            isOneToOne: false
            referencedRelation: "redes"
            referencedColumns: ["id"]
          }
        ]
      }
      celula_membros: {
        Row: {
          celula_id: string
          user_id: string
          papel: PapelCelula
          joined_at: string
        }
        Insert: {
          celula_id: string
          user_id: string
          papel?: PapelCelula
          joined_at?: string
        }
        Update: {
          celula_id?: string
          user_id?: string
          papel?: PapelCelula
          joined_at?: string
        }
        Relationships: []
      }
      encontros: {
        Row: {
          id: string
          celula_id: string
          data_hora: string
          local: string | null
          local_maps_url: string | null
          avisos: string | null
          edificacao_resumo: string | null
          card_imagem_url: string | null
          resumo_culto_id: string | null
          igreja_id: string | null
          status: StatusEncontro
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          celula_id: string
          data_hora: string
          local?: string | null
          local_maps_url?: string | null
          avisos?: string | null
          edificacao_resumo?: string | null
          card_imagem_url?: string | null
          resumo_culto_id?: string | null
          igreja_id?: string | null
          status?: StatusEncontro
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          celula_id?: string
          data_hora?: string
          local?: string | null
          local_maps_url?: string | null
          avisos?: string | null
          edificacao_resumo?: string | null
          card_imagem_url?: string | null
          resumo_culto_id?: string | null
          igreja_id?: string | null
          status?: StatusEncontro
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      escalas: {
        // encontro_id é nulo enquanto a escala está "de sobre aviso" numa
        // data_prevista; ao criar o encontro daquele dia, ela é vinculada.
        Row: {
          id: string
          encontro_id: string | null
          celula_id: string
          data_prevista: string | null
          funcao: FuncaoEscala
          responsavel_id: string | null
          observacao: string | null
          com_conjuge: boolean
        }
        Insert: {
          id?: string
          encontro_id?: string | null
          celula_id: string
          data_prevista?: string | null
          funcao: FuncaoEscala
          responsavel_id?: string | null
          observacao?: string | null
          com_conjuge?: boolean
        }
        Update: {
          id?: string
          encontro_id?: string | null
          celula_id?: string
          data_prevista?: string | null
          funcao?: FuncaoEscala
          responsavel_id?: string | null
          observacao?: string | null
          com_conjuge?: boolean
        }
        Relationships: []
      }
      lanches: {
        Row: {
          id: string
          encontro_id: string
          emoji: string | null
          item: string
          responsavel: string | null
          responsavel_id: string | null
          com_conjuge: boolean
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          encontro_id: string
          emoji?: string | null
          item: string
          responsavel?: string | null
          responsavel_id?: string | null
          com_conjuge?: boolean
          ordem?: number
          created_at?: string
        }
        Update: {
          id?: string
          encontro_id?: string
          emoji?: string | null
          item?: string
          responsavel?: string | null
          responsavel_id?: string | null
          com_conjuge?: boolean
          ordem?: number
          created_at?: string
        }
        Relationships: []
      }
      presencas: {
        Row: {
          id: string
          encontro_id: string
          user_id: string
          status: StatusPresenca
          com_conjuge: boolean
          com_filhos: boolean
          num_visitantes: number
          observacao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          encontro_id: string
          user_id: string
          status?: StatusPresenca
          com_conjuge?: boolean
          com_filhos?: boolean
          num_visitantes?: number
          observacao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          encontro_id?: string
          user_id?: string
          status?: StatusPresenca
          com_conjuge?: boolean
          com_filhos?: boolean
          num_visitantes?: number
          observacao?: string | null
          created_at?: string
        }
        Relationships: []
      }
      resumos_culto: {
        Row: {
          id: string
          igreja_id: string
          titulo: string
          conteudo: string
          pdf_url: string | null
          data_culto: string
          validade_ate: string
          arquivo_nome: string | null
          publicado_por: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          igreja_id: string
          titulo: string
          conteudo: string
          pdf_url?: string | null
          data_culto: string
          validade_ate: string
          arquivo_nome?: string | null
          publicado_por?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          titulo?: string
          conteudo?: string
          pdf_url?: string | null
          data_culto?: string
          validade_ate?: string
          arquivo_nome?: string | null
          publicado_por?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      formularios: {
        Row: {
          id: string
          igreja_id: string
          nome: string
          descricao: string | null
          campos: CampoFormulario[]
          template: boolean
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          igreja_id: string
          nome: string
          descricao?: string | null
          campos?: CampoFormulario[]
          template?: boolean
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          descricao?: string | null
          campos?: CampoFormulario[]
          template?: boolean
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      inscricoes_evento: {
        Row: {
          id: string
          evento_id: string
          formulario_id: string | null
          user_id: string | null
          nome: string
          telefone: string | null
          dados: Record<string, string>
          valor_total: number | null
          status: 'pendente' | 'confirmado' | 'cancelado'
          observacao: string | null
          origem: 'app' | 'manual' | 'planilha'
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          formulario_id?: string | null
          user_id?: string | null
          nome: string
          telefone?: string | null
          dados?: Record<string, string>
          valor_total?: number | null
          status?: 'pendente' | 'confirmado' | 'cancelado'
          observacao?: string | null
          origem?: 'app' | 'manual' | 'planilha'
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          formulario_id?: string | null
          user_id?: string | null
          nome?: string
          telefone?: string | null
          dados?: Record<string, string>
          valor_total?: number | null
          status?: 'pendente' | 'confirmado' | 'cancelado'
          observacao?: string | null
          origem?: 'app' | 'manual' | 'planilha'
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          id: string
          igreja_id: string
          rede_id: string | null
          celula_id: string | null
          slug: string | null
          titulo: string
          descricao: string | null
          data_hora: string
          data_hora_fim: string | null
          local: string | null
          imagem_url: string | null
          tipo: TipoEvento
          video_url: string | null
          capa_pagina_url: string | null
          inscricoes_planilha_url: string | null
          comprovantes_pasta_url: string | null
          cards_descricao: string | null
          cor: string | null
          cor_secundaria: string | null
          fundo_tipo: string | null
          fundo_imagem_url: string | null
          fundo_opacidade: number
          fundo_galeria: boolean
          fundo_galeria_opacidade: number
          fundo_auto_cor: boolean
          fundo_auto_cor_origem: string | null
          destaque: boolean
          recorrencia_id: string | null
          recorrencia_tipo: string | null
          tipo_inscricao: TipoInscricao
          link_inscricao_url: string | null
          whatsapp_inscricao: string | null
          pix_chave: string | null
          pix_tipo: TipoChavePix | null
          pix_nome: string | null
          pix_valor: number | null
          formulario_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          igreja_id: string
          rede_id?: string | null
          celula_id?: string | null
          slug?: string | null
          titulo: string
          descricao?: string | null
          data_hora: string
          data_hora_fim?: string | null
          local?: string | null
          imagem_url?: string | null
          tipo?: TipoEvento
          video_url?: string | null
          capa_pagina_url?: string | null
          inscricoes_planilha_url?: string | null
          comprovantes_pasta_url?: string | null
          cards_descricao?: string | null
          cor?: string | null
          cor_secundaria?: string | null
          fundo_tipo?: string | null
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          destaque?: boolean
          recorrencia_id?: string | null
          recorrencia_tipo?: string | null
          tipo_inscricao?: TipoInscricao
          link_inscricao_url?: string | null
          whatsapp_inscricao?: string | null
          pix_chave?: string | null
          pix_tipo?: TipoChavePix | null
          pix_nome?: string | null
          pix_valor?: number | null
          formulario_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          rede_id?: string | null
          celula_id?: string | null
          slug?: string | null
          titulo?: string
          descricao?: string | null
          data_hora?: string
          data_hora_fim?: string | null
          local?: string | null
          imagem_url?: string | null
          tipo?: TipoEvento
          video_url?: string | null
          capa_pagina_url?: string | null
          inscricoes_planilha_url?: string | null
          comprovantes_pasta_url?: string | null
          cards_descricao?: string | null
          cor?: string | null
          cor_secundaria?: string | null
          fundo_tipo?: string | null
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          destaque?: boolean
          recorrencia_id?: string | null
          recorrencia_tipo?: string | null
          tipo_inscricao?: TipoInscricao
          link_inscricao_url?: string | null
          whatsapp_inscricao?: string | null
          pix_chave?: string | null
          pix_tipo?: TipoChavePix | null
          pix_nome?: string | null
          pix_valor?: number | null
          formulario_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      membros_pre_cadastro: {
        Row: {
          id: string
          igreja_id: string
          nome: string
          email: string | null
          cargo: Role | null
          telefone: string | null
          celula_id: string | null
          /** Código que pareia casais vindos da planilha de organização. */
          vinculo_casal: string | null
          obs: string | null
          profile_id: string | null
          status: StatusPreCadastro
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          igreja_id: string
          nome: string
          email?: string | null
          cargo?: Role | null
          telefone?: string | null
          celula_id?: string | null
          vinculo_casal?: string | null
          obs?: string | null
          profile_id?: string | null
          status?: StatusPreCadastro
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          email?: string | null
          cargo?: Role | null
          telefone?: string | null
          celula_id?: string | null
          vinculo_casal?: string | null
          obs?: string | null
          profile_id?: string | null
          status?: StatusPreCadastro
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      evento_presencas: {
        Row: {
          evento_id: string
          user_id: string
          resposta: 'vou' | 'nao_vou'
        }
        Insert: {
          evento_id: string
          user_id: string
          resposta: 'vou' | 'nao_vou'
        }
        Update: {
          evento_id?: string
          user_id?: string
          resposta?: 'vou' | 'nao_vou'
        }
        Relationships: []
      }
      solicitacoes: {
        Row: {
          id: string
          igreja_id: string
          user_id: string | null
          tipo: TipoSolicitacao
          nome: string
          telefone: string
          email: string
          dados: Record<string, unknown>
          mensagem: string | null
          status: StatusSolicitacao
          responsavel_id: string | null
          observacao: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          igreja_id: string
          user_id?: string | null
          tipo: TipoSolicitacao
          nome: string
          telefone: string
          email: string
          dados?: Record<string, unknown>
          mensagem?: string | null
          status?: StatusSolicitacao
          responsavel_id?: string | null
          observacao?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          user_id?: string | null
          tipo?: TipoSolicitacao
          nome?: string
          telefone?: string
          email?: string
          dados?: Record<string, unknown>
          mensagem?: string | null
          status?: StatusSolicitacao
          responsavel_id?: string | null
          observacao?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      solicitacoes_cargo: {
        Row: {
          id: string
          igreja_id: string
          user_id: string
          cargo_solicitado: 'lider_treinamento' | 'lider' | 'supervisor_treinamento' | 'supervisor'
          mensagem: string | null
          status: 'pendente' | 'aprovado' | 'rejeitado'
          resolvido_por: string | null
          resolvido_em: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          igreja_id: string
          user_id: string
          cargo_solicitado: 'lider_treinamento' | 'lider' | 'supervisor_treinamento' | 'supervisor'
          mensagem?: string | null
          status?: 'pendente' | 'aprovado' | 'rejeitado'
          resolvido_por?: string | null
          resolvido_em?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          user_id?: string
          cargo_solicitado?: 'lider_treinamento' | 'lider' | 'supervisor_treinamento' | 'supervisor'
          mensagem?: string | null
          status?: 'pendente' | 'aprovado' | 'rejeitado'
          resolvido_por?: string | null
          resolvido_em?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      solicitacoes_celula: {
        Row: {
          id: string
          igreja_id: string
          user_id: string | null
          nome: string
          telefone: string
          email: string
          idade: number | null
          estado_civil: string | null
          tem_filhos: boolean | null
          filhos_detalhes: string | null
          conjuge_nome: string | null
          conjuge_telefone: string | null
          conjuge_idade: number | null
          bairro: string | null
          tipo_membro: string | null
          melhor_dia: string | null
          status: string
          lider_encaminhado_id: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          igreja_id: string
          user_id?: string | null
          nome: string
          telefone: string
          email: string
          idade?: number | null
          estado_civil?: string | null
          tem_filhos?: boolean | null
          filhos_detalhes?: string | null
          conjuge_nome?: string | null
          conjuge_telefone?: string | null
          conjuge_idade?: number | null
          bairro?: string | null
          tipo_membro?: string | null
          melhor_dia?: string | null
          status?: string
          lider_encaminhado_id?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          user_id?: string | null
          nome?: string
          telefone?: string
          email?: string
          idade?: number | null
          estado_civil?: string | null
          tem_filhos?: boolean | null
          filhos_detalhes?: string | null
          conjuge_nome?: string | null
          conjuge_telefone?: string | null
          conjuge_idade?: number | null
          bairro?: string | null
          tipo_membro?: string | null
          melhor_dia?: string | null
          status?: string
          lider_encaminhado_id?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      fotos_comunidade: {
        // encontro_id preenchido quando a foto é o registro de um encontro
        // específico; a foto continua ligada à célula e aparece na galeria dela.
        Row: {
          id: string
          igreja_id: string
          celula_id: string | null
          encontro_id: string | null
          url: string
          criado_em: string
          criado_por: string | null
        }
        Insert: {
          id?: string
          igreja_id: string
          celula_id?: string | null
          encontro_id?: string | null
          url: string
          criado_em?: string
          criado_por?: string | null
        }
        Update: {
          id?: string
          igreja_id?: string
          celula_id?: string | null
          encontro_id?: string | null
          url?: string
          criado_em?: string
          criado_por?: string | null
        }
        Relationships: []
      }
      celula_apelidos: {
        // Grafias que a planilha do WhatsApp usa para uma célula ("Alpha" para
        // a célula "Alfa"). Só a importação lê; o site sempre mostra
        // `celulas.nome`. Grafia nova é uma linha aqui, sem mexer no código.
        Row: {
          id: string
          celula_id: string
          apelido: string
          criado_em: string
        }
        Insert: {
          id?: string
          celula_id: string
          apelido: string
          criado_em?: string
        }
        Update: {
          id?: string
          celula_id?: string
          apelido?: string
          criado_em?: string
        }
        Relationships: []
      }
      importacoes: {
        // Log de controle das importações automáticas. `chave` é o
        // identificador estável do item na origem — para foto, o hash do
        // conteúdo. A unicidade (igreja_id, tipo, chave) é o que torna a
        // importação repetível sem duplicar.
        Row: {
          id: string
          igreja_id: string
          tipo: TipoImportacao
          chave: string
          arquivo_nome: string | null
          celula_id: string | null
          destino: string | null
          grupo_origem: string | null
          registro_id: string | null
          status: StatusImportacao
          motivo: string | null
          importado_em: string
        }
        Insert: {
          id?: string
          igreja_id: string
          tipo: TipoImportacao
          chave: string
          arquivo_nome?: string | null
          celula_id?: string | null
          destino?: string | null
          grupo_origem?: string | null
          registro_id?: string | null
          status?: StatusImportacao
          motivo?: string | null
          importado_em?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          tipo?: TipoImportacao
          chave?: string
          arquivo_nome?: string | null
          celula_id?: string | null
          destino?: string | null
          grupo_origem?: string | null
          registro_id?: string | null
          status?: StatusImportacao
          motivo?: string | null
          importado_em?: string
        }
        Relationships: []
      }
      evento_valores: {
        Row: {
          id: string
          evento_id: string
          nome: string
          valor: number
          campo_id: string | null
          opcao: string | null
          ordem: number
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          nome: string
          valor: number
          campo_id?: string | null
          opcao?: string | null
          ordem?: number
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          nome?: string
          valor?: number
          campo_id?: string | null
          opcao?: string | null
          ordem?: number
          criado_em?: string
        }
        Relationships: []
      }
      evento_parcelas: {
        Row: {
          id: string
          evento_id: string
          numero: number
          vencimento: string
          percentual: number | null
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          numero: number
          vencimento: string
          percentual?: number | null
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          numero?: number
          vencimento?: string
          percentual?: number | null
          criado_em?: string
        }
        Relationships: []
      }
      inscricao_pagamentos: {
        Row: {
          id: string
          inscricao_id: string
          valor: number
          pago_em: string
          metodo: string | null
          observacao: string | null
          comprovante_path: string | null
          comprovante_nome: string | null
          registrado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          inscricao_id: string
          valor: number
          pago_em?: string
          metodo?: string | null
          observacao?: string | null
          comprovante_path?: string | null
          comprovante_nome?: string | null
          registrado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          inscricao_id?: string
          valor?: number
          pago_em?: string
          metodo?: string | null
          observacao?: string | null
          comprovante_path?: string | null
          comprovante_nome?: string | null
          registrado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      // Quem, além da liderança, pode gerenciar as inscrições de um evento.
      evento_organizadores: {
        Row: {
          id: string
          evento_id: string
          user_id: string
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          user_id: string
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          user_id?: string
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      evento_secoes: {
        // Cada seção da página do evento é uma linha, para que possam ser
        // reordenadas e duplicadas. `video_url` mora aqui, e não em `eventos`,
        // para que duas seções de vídeo tenham vídeos diferentes.
        Row: {
          id: string
          evento_id: string
          tipo: TipoSecaoEvento
          titulo: string | null
          descricao: string | null
          video_url: string | null
          ordem: number
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          tipo: TipoSecaoEvento
          titulo?: string | null
          descricao?: string | null
          video_url?: string | null
          ordem?: number
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          tipo?: TipoSecaoEvento
          titulo?: string | null
          descricao?: string | null
          video_url?: string | null
          ordem?: number
          criado_em?: string
        }
        Relationships: []
      }
      evento_botoes: {
        // Links extras na página do evento (regulamento, mapa, grupo do
        // WhatsApp). O botão de inscrição do app continua à parte.
        Row: {
          id: string
          evento_id: string
          secao_id: string | null
          rotulo: string
          url: string
          ordem: number
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          secao_id: string | null
          rotulo: string
          url: string
          ordem?: number
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          secao_id?: string | null
          rotulo?: string
          url?: string
          ordem?: number
          criado_em?: string
        }
        Relationships: []
      }
      evento_cards: {
        // Blocos ilustrados da página: tipos de acomodação, lotes, pacotes.
        // `valor` nulo quando o card é só informativo.
        Row: {
          id: string
          evento_id: string
          secao_id: string | null
          titulo: string
          descricao: string | null
          imagem_url: string | null
          valor: number | null
          ordem: number
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          secao_id: string | null
          titulo: string
          descricao?: string | null
          imagem_url?: string | null
          valor?: number | null
          ordem?: number
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          secao_id?: string | null
          titulo?: string
          descricao?: string | null
          imagem_url?: string | null
          valor?: number | null
          ordem?: number
          criado_em?: string
        }
        Relationships: []
      }
      evento_fotos: {
        Row: {
          id: string
          evento_id: string
          secao_id: string | null
          url: string
          legenda: string | null
          ordem: number
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          secao_id: string | null
          url: string
          legenda?: string | null
          ordem?: number
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          secao_id?: string | null
          url?: string
          legenda?: string | null
          ordem?: number
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      evento_likes: {
        Row: {
          id: string
          evento_id: string
          user_id: string
          criado_em: string
        }
        Insert: {
          id?: string
          evento_id: string
          user_id: string
          criado_em?: string
        }
        Update: {
          id?: string
          evento_id?: string
          user_id?: string
          criado_em?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          id: string
          igreja_id: string
          destinatario_id: string
          tipo: TipoNotificacao
          titulo: string
          mensagem: string
          dados: Record<string, string> | null
          lida: boolean
          created_at: string
        }
        Insert: {
          id?: string
          igreja_id: string
          destinatario_id: string
          tipo: TipoNotificacao
          titulo: string
          mensagem: string
          dados?: Record<string, string> | null
          lida?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          destinatario_id?: string
          tipo?: TipoNotificacao
          titulo?: string
          mensagem?: string
          dados?: Record<string, string> | null
          lida?: boolean
          created_at?: string
        }
        Relationships: []
      }
      ensino_equipe: {
        Row: {
          igreja_id: string
          profile_id: string
          papel: PapelEnsino
          criado_em: string
        }
        Insert: {
          igreja_id: string
          profile_id: string
          papel?: PapelEnsino
          criado_em?: string
        }
        Update: {
          igreja_id?: string
          profile_id?: string
          papel?: PapelEnsino
          criado_em?: string
        }
        Relationships: []
      }
      ensino_cursos: {
        Row: {
          id: string
          igreja_id: string
          nome: string
          descricao: string | null
          capa_url: string | null
          ativo: boolean
          ordem: number
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          igreja_id: string
          nome: string
          descricao?: string | null
          capa_url?: string | null
          ativo?: boolean
          ordem?: number
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          descricao?: string | null
          capa_url?: string | null
          ativo?: boolean
          ordem?: number
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      ensino_turmas: {
        // `vagas` nulo = sem limite. `dias_semana` usa 0=domingo…6=sábado, a
        // mesma convenção de `celulas.dia_semana`.
        Row: {
          id: string
          /** Endereço legível da turma (`/ensino/turma/carta-de-tiago`). */
          slug: string | null
          curso_id: string
          igreja_id: string
          nome: string
          descricao: string | null
          /** Card da turma — o retrato das listagens. */
          capa_url: string | null
          /** Capa exclusiva do topo da página. Sem ela, o card faz as vezes. */
          capa_pagina_url: string | null
          local: string | null
          /** Nulo = turma gratuita. Ver `ensino_pagamentos.sql`. */
          valor: number | null
          pagamento_instrucoes: string | null
          data_inicio: string | null
          data_fim: string | null
          dias_semana: number[]
          horario_inicio: string | null
          horario_fim: string | null
          total_aulas: number | null
          vagas: number | null
          inscricoes_abertas: boolean
          aprovacao_automatica: boolean
          status: StatusTurma
          modo: ModoTurma
          /** Só em `gravado`: a aula N só abre com a N-1 concluída. */
          sequencial: boolean
          destaque: boolean
          cor: string | null
          cor_secundaria: string | null
          fundo_tipo: string | null
          fundo_imagem_url: string | null
          fundo_opacidade: number
          fundo_galeria: boolean
          fundo_galeria_opacidade: number
          fundo_auto_cor: boolean
          fundo_auto_cor_origem: string | null
          /**
           * O grupo da turma. É também o destino da inscrição quando
           * `tipo_inscricao` é `whatsapp` — entrar no grupo é a confirmação.
           */
          whatsapp_url: string | null
          tipo_inscricao: TipoInscricaoTurma
          link_inscricao_url: string | null
          formulario_id: string | null
          video_chamada_modo: ModoVideoChamada
          /** Só em `video_chamada_modo = 'turma'`: a sala do curso inteiro. */
          video_chamada_url: string | null
          criado_por: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          /** Em branco, o gatilho `gerar_slug_turma` monta a partir do nome. */
          slug?: string | null
          curso_id: string
          igreja_id: string
          nome: string
          descricao?: string | null
          capa_url?: string | null
          capa_pagina_url?: string | null
          local?: string | null
          valor?: number | null
          pagamento_instrucoes?: string | null
          data_inicio?: string | null
          data_fim?: string | null
          dias_semana?: number[]
          horario_inicio?: string | null
          horario_fim?: string | null
          total_aulas?: number | null
          vagas?: number | null
          inscricoes_abertas?: boolean
          aprovacao_automatica?: boolean
          status?: StatusTurma
          modo?: ModoTurma
          sequencial?: boolean
          destaque?: boolean
          cor?: string | null
          cor_secundaria?: string | null
          fundo_tipo?: string | null
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          whatsapp_url?: string | null
          tipo_inscricao?: TipoInscricaoTurma
          link_inscricao_url?: string | null
          formulario_id?: string | null
          video_chamada_modo?: ModoVideoChamada
          video_chamada_url?: string | null
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          slug?: string | null
          curso_id?: string
          igreja_id?: string
          nome?: string
          descricao?: string | null
          capa_url?: string | null
          capa_pagina_url?: string | null
          local?: string | null
          valor?: number | null
          pagamento_instrucoes?: string | null
          data_inicio?: string | null
          data_fim?: string | null
          dias_semana?: number[]
          horario_inicio?: string | null
          horario_fim?: string | null
          total_aulas?: number | null
          vagas?: number | null
          inscricoes_abertas?: boolean
          aprovacao_automatica?: boolean
          status?: StatusTurma
          modo?: ModoTurma
          sequencial?: boolean
          destaque?: boolean
          cor?: string | null
          cor_secundaria?: string | null
          fundo_tipo?: string | null
          fundo_imagem_url?: string | null
          fundo_opacidade?: number
          fundo_galeria?: boolean
          fundo_galeria_opacidade?: number
          fundo_auto_cor?: boolean
          fundo_auto_cor_origem?: string | null
          whatsapp_url?: string | null
          tipo_inscricao?: TipoInscricaoTurma
          link_inscricao_url?: string | null
          formulario_id?: string | null
          video_chamada_modo?: ModoVideoChamada
          video_chamada_url?: string | null
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      ensino_turma_professores: {
        // Exatamente um entre `profile_id` e `pre_cadastro_id`: o professor que
        // ainda não tem conta entra pela lista da igreja e vira perfil quando
        // criar a dela.
        Row: {
          id: string
          turma_id: string
          profile_id: string | null
          pre_cadastro_id: string | null
          principal: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          turma_id: string
          profile_id?: string | null
          pre_cadastro_id?: string | null
          principal?: boolean
          criado_em?: string
        }
        Update: {
          id?: string
          turma_id?: string
          profile_id?: string | null
          pre_cadastro_id?: string | null
          principal?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      ensino_inscricoes: {
        // `nome`, `telefone` e `email` são cópia do perfil no momento da
        // inscrição: a lista do professor não pode mudar sozinha quando o
        // aluno troca o telefone.
        // `user_id` é nulo no aluno que o professor cadastrou à mão: ele ainda
        // não tem conta. Nesse caso a identidade da pessoa mora em
        // `pre_cadastro_id`, e o vínculo preenche o `user_id` depois.
        Row: {
          id: string
          turma_id: string
          user_id: string | null
          nome: string
          telefone: string | null
          email: string | null
          dados: Record<string, string>
          status: StatusInscricaoEnsino
          origem: OrigemInscricaoEnsino
          pre_cadastro_id: string | null
          /** Bolsa, meia, isenção. Nulo = vale o valor da turma. */
          valor_combinado: number | null
          observacao: string | null
          decidido_por: string | null
          decidido_em: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          turma_id: string
          user_id?: string | null
          nome: string
          telefone?: string | null
          email?: string | null
          dados?: Record<string, string>
          status?: StatusInscricaoEnsino
          origem?: OrigemInscricaoEnsino
          pre_cadastro_id?: string | null
          valor_combinado?: number | null
          observacao?: string | null
          decidido_por?: string | null
          decidido_em?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          turma_id?: string
          user_id?: string | null
          nome?: string
          telefone?: string | null
          email?: string | null
          dados?: Record<string, string>
          status?: StatusInscricaoEnsino
          origem?: OrigemInscricaoEnsino
          pre_cadastro_id?: string | null
          valor_combinado?: number | null
          observacao?: string | null
          decidido_por?: string | null
          decidido_em?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      ensino_aulas: {
        // `data` é `date`, não instante: a aula acontece num dia do calendário
        // de Natal, e guardar UTC empurraria a aula da noite para o dia seguinte.
        Row: {
          id: string
          turma_id: string
          numero: number
          titulo: string | null
          descricao: string | null
          data: string
          hora_inicio: string | null
          local: string | null
          status: StatusAula
          /** Só em turma com `video_chamada_modo = 'aula'`. */
          video_chamada_url: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          turma_id: string
          numero: number
          titulo?: string | null
          descricao?: string | null
          data: string
          hora_inicio?: string | null
          local?: string | null
          status?: StatusAula
          video_chamada_url?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          turma_id?: string
          numero?: number
          titulo?: string | null
          descricao?: string | null
          data?: string
          hora_inicio?: string | null
          local?: string | null
          status?: StatusAula
          video_chamada_url?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      ensino_turma_parcelas: {
        // Plano de parcelas da turma. Sem linhas, o valor é cobrado de uma vez;
        // `percentual` nulo divide o total igualmente.
        Row: {
          id: string
          turma_id: string
          numero: number
          vencimento: string
          percentual: number | null
        }
        Insert: {
          id?: string
          turma_id: string
          numero: number
          vencimento: string
          percentual?: number | null
        }
        Update: {
          id?: string
          turma_id?: string
          numero?: number
          vencimento?: string
          percentual?: number | null
        }
        Relationships: []
      }
      ensino_pagamentos: {
        // Um lançamento por pagamento recebido — o app é o livro-caixa da
        // secretaria, não uma integração bancária.
        Row: {
          id: string
          inscricao_id: string
          valor: number
          pago_em: string
          metodo: string | null
          observacao: string | null
          registrado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          inscricao_id: string
          valor: number
          pago_em?: string
          metodo?: string | null
          observacao?: string | null
          registrado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          inscricao_id?: string
          valor?: number
          pago_em?: string
          metodo?: string | null
          observacao?: string | null
          registrado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      ensino_presencas: {
        // `user_id` acompanha o da inscrição: nulo enquanto o aluno cadastrado
        // pela mão do professor não tiver conta.
        Row: {
          id: string
          aula_id: string
          inscricao_id: string
          user_id: string | null
          presente: boolean
          observacao: string | null
          registrado_por: string | null
          registrado_em: string
        }
        Insert: {
          id?: string
          aula_id: string
          inscricao_id: string
          user_id?: string | null
          presente?: boolean
          observacao?: string | null
          registrado_por?: string | null
          registrado_em?: string
        }
        Update: {
          id?: string
          aula_id?: string
          inscricao_id?: string
          user_id?: string | null
          presente?: boolean
          observacao?: string | null
          registrado_por?: string | null
          registrado_em?: string
        }
        Relationships: []
      }
      ensino_progresso: {
        // O "assisti" do aluno, que não se confunde com presença: em
        // `ensino_presencas` quem escreve é o professor, e presença marcada
        // por si mesmo não seria presença. `turma_id` vem repetido da aula
        // para as policies filtrarem sem subconsulta.
        Row: {
          aula_id: string
          user_id: string
          turma_id: string
          concluida_em: string
        }
        Insert: {
          aula_id: string
          user_id: string
          turma_id: string
          concluida_em?: string
        }
        Update: {
          aula_id?: string
          user_id?: string
          turma_id?: string
          concluida_em?: string
        }
        Relationships: []
      }
      ensino_materiais: {
        // `arquivo_path` aponta para o bucket privado `ensino-materiais`;
        // `url` guarda link externo. Um dos dois é preenchido.
        Row: {
          id: string
          turma_id: string
          aula_id: string | null
          titulo: string
          descricao: string | null
          tipo: TipoMaterial
          url: string | null
          arquivo_path: string | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          publico: boolean
          ordem: number
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          turma_id: string
          aula_id?: string | null
          titulo: string
          descricao?: string | null
          tipo?: TipoMaterial
          url?: string | null
          arquivo_path?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          publico?: boolean
          ordem?: number
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          turma_id?: string
          aula_id?: string | null
          titulo?: string
          descricao?: string | null
          tipo?: TipoMaterial
          url?: string | null
          arquivo_path?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          publico?: boolean
          ordem?: number
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      consolidacao: {
        Row: {
          id: string
          igreja_id: string
          nome: string
          telefone: string | null
          origem: OrigemConsolidacao
          encontro_id: string | null
          decisao: DecisaoConsolidacao | null
          celula_id: string | null
          responsavel_id: string | null
          profile_id: string | null
          etapa: EtapaConsolidacao
          observacao: string | null
          data_acolhimento: string
          criado_por: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          igreja_id: string
          nome: string
          telefone?: string | null
          origem?: OrigemConsolidacao
          encontro_id?: string | null
          decisao?: DecisaoConsolidacao | null
          celula_id?: string | null
          responsavel_id?: string | null
          profile_id?: string | null
          etapa?: EtapaConsolidacao
          observacao?: string | null
          data_acolhimento?: string
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          telefone?: string | null
          origem?: OrigemConsolidacao
          encontro_id?: string | null
          decisao?: DecisaoConsolidacao | null
          celula_id?: string | null
          responsavel_id?: string | null
          profile_id?: string | null
          etapa?: EtapaConsolidacao
          observacao?: string | null
          data_acolhimento?: string
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      consolidacao_contatos: {
        Row: {
          id: string
          consolidacao_id: string
          autor_id: string | null
          canal: CanalContato
          resultado: ResultadoContato
          nota: string | null
          data: string
          criado_em: string
        }
        Insert: {
          id?: string
          consolidacao_id: string
          autor_id?: string | null
          canal?: CanalContato
          resultado?: ResultadoContato
          nota?: string | null
          data?: string
          criado_em?: string
        }
        Update: {
          id?: string
          consolidacao_id?: string
          autor_id?: string | null
          canal?: CanalContato
          resultado?: ResultadoContato
          nota?: string | null
          data?: string
          criado_em?: string
        }
        Relationships: []
      }
      supervisoes: {
        Row: {
          id: string
          rede_id: string
          celula_id: string | null
          supervisor_id: string | null
          data: string
          pauta: string | null
          encaminhamentos: string | null
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          rede_id: string
          celula_id?: string | null
          supervisor_id?: string | null
          data?: string
          pauta?: string | null
          encaminhamentos?: string | null
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          rede_id?: string
          celula_id?: string | null
          supervisor_id?: string | null
          data?: string
          pauta?: string | null
          encaminhamentos?: string | null
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      ensino_aula_fotos: {
        Row: {
          id: string
          turma_id: string
          aula_id: string | null
          url: string
          legenda: string | null
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          turma_id: string
          aula_id?: string | null
          url: string
          legenda?: string | null
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          turma_id?: string
          aula_id?: string | null
          url?: string
          legenda?: string | null
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      ensino_atividades: {
        Row: {
          id: string
          turma_id: string
          tipo: TipoAtividade
          titulo: string
          descricao: string | null
          capa_url: string | null
          fundo_url: string | null
          fundo_opacidade: number
          cor: string | null
          video_url: string | null
          abre_em: string | null
          prazo: string | null
          publicada: boolean
          ordem: number
          leitura: ConfigLeitura | null
          criado_por: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          turma_id: string
          tipo: TipoAtividade
          titulo: string
          descricao?: string | null
          capa_url?: string | null
          fundo_url?: string | null
          fundo_opacidade?: number
          cor?: string | null
          video_url?: string | null
          abre_em?: string | null
          prazo?: string | null
          publicada?: boolean
          ordem?: number
          leitura?: ConfigLeitura | null
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          turma_id?: string
          tipo?: TipoAtividade
          titulo?: string
          descricao?: string | null
          capa_url?: string | null
          fundo_url?: string | null
          fundo_opacidade?: number
          cor?: string | null
          video_url?: string | null
          abre_em?: string | null
          prazo?: string | null
          publicada?: boolean
          ordem?: number
          leitura?: ConfigLeitura | null
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      ensino_atividade_secoes: {
        Row: {
          id: string
          atividade_id: string
          tipo: TipoSecaoAtividade
          titulo: string | null
          conteudo: string | null
          midia_url: string | null
          video_url: string | null
          ordem: number
          criado_em: string
        }
        Insert: {
          id?: string
          atividade_id: string
          tipo: TipoSecaoAtividade
          titulo?: string | null
          conteudo?: string | null
          midia_url?: string | null
          video_url?: string | null
          ordem?: number
          criado_em?: string
        }
        Update: {
          id?: string
          atividade_id?: string
          tipo?: TipoSecaoAtividade
          titulo?: string | null
          conteudo?: string | null
          midia_url?: string | null
          video_url?: string | null
          ordem?: number
          criado_em?: string
        }
        Relationships: []
      }
      ensino_atividade_perguntas: {
        Row: {
          id: string
          atividade_id: string
          secao_id: string | null
          ordem: number
          enunciado: string
          tipo: TipoPergunta
          opcoes: OpcaoPergunta[]
          resposta_esperada: string | null
          pontos: number
          obrigatoria: boolean
          midia_url: string | null
          midia_tipo: 'imagem' | 'video' | null
          criado_em: string
        }
        Insert: {
          id?: string
          atividade_id: string
          secao_id?: string | null
          ordem?: number
          enunciado: string
          tipo: TipoPergunta
          opcoes?: OpcaoPergunta[]
          resposta_esperada?: string | null
          pontos?: number
          obrigatoria?: boolean
          midia_url?: string | null
          midia_tipo?: 'imagem' | 'video' | null
          criado_em?: string
        }
        Update: {
          id?: string
          atividade_id?: string
          secao_id?: string | null
          ordem?: number
          enunciado?: string
          tipo?: TipoPergunta
          opcoes?: OpcaoPergunta[]
          resposta_esperada?: string | null
          pontos?: number
          obrigatoria?: boolean
          midia_url?: string | null
          midia_tipo?: 'imagem' | 'video' | null
          criado_em?: string
        }
        Relationships: []
      }
      ensino_atividade_entregas: {
        Row: {
          id: string
          atividade_id: string
          inscricao_id: string
          status: StatusEntrega
          concluida: boolean
          comentario: string | null
          nota: number | null
          observacao: string | null
          entregue_em: string | null
          corrigida_em: string | null
          corrigida_por: string | null
          atualizado_em: string
        }
        Insert: {
          id?: string
          atividade_id: string
          inscricao_id: string
          status?: StatusEntrega
          concluida?: boolean
          comentario?: string | null
          nota?: number | null
          observacao?: string | null
          entregue_em?: string | null
          corrigida_em?: string | null
          corrigida_por?: string | null
          atualizado_em?: string
        }
        Update: {
          id?: string
          atividade_id?: string
          inscricao_id?: string
          status?: StatusEntrega
          concluida?: boolean
          comentario?: string | null
          nota?: number | null
          observacao?: string | null
          entregue_em?: string | null
          corrigida_em?: string | null
          corrigida_por?: string | null
          atualizado_em?: string
        }
        Relationships: []
      }
      ensino_atividade_respostas: {
        Row: {
          id: string
          entrega_id: string
          pergunta_id: string
          opcoes: string[]
          texto: string | null
          correta: boolean | null
          pontos: number | null
          atualizado_em: string
        }
        Insert: {
          id?: string
          entrega_id: string
          pergunta_id: string
          opcoes?: string[]
          texto?: string | null
          correta?: boolean | null
          pontos?: number | null
          atualizado_em?: string
        }
        Update: {
          id?: string
          entrega_id?: string
          pergunta_id?: string
          opcoes?: string[]
          texto?: string | null
          correta?: boolean | null
          pontos?: number | null
          atualizado_em?: string
        }
        Relationships: []
      }
      ensino_leitura_itens: {
        Row: {
          id: string
          atividade_id: string
          inscricao_id: string
          ordem: number
          rotulo: string
          livro_id: number | null
          capitulo_inicio: number | null
          capitulo_fim: number | null
          rodada: number
          data_prevista: string | null
          feito: boolean
          feito_em: string | null
        }
        Insert: {
          id?: string
          atividade_id: string
          inscricao_id: string
          ordem: number
          rotulo: string
          livro_id?: number | null
          capitulo_inicio?: number | null
          capitulo_fim?: number | null
          rodada?: number
          data_prevista?: string | null
          feito?: boolean
          feito_em?: string | null
        }
        Update: {
          id?: string
          atividade_id?: string
          inscricao_id?: string
          ordem?: number
          rotulo?: string
          livro_id?: number | null
          capitulo_inicio?: number | null
          capitulo_fim?: number | null
          rodada?: number
          data_prevista?: string | null
          feito?: boolean
          feito_em?: string | null
        }
        Relationships: []
      }
      biblia_livros: {
        Row: {
          id: number
          sigla: string
          nome: string
          testamento: Testamento
          capitulos: number
        }
        Insert: {
          id: number
          sigla: string
          nome: string
          testamento: Testamento
          capitulos: number
        }
        Update: {
          id?: number
          sigla?: string
          nome?: string
          testamento?: Testamento
          capitulos?: number
        }
        Relationships: []
      }
      biblia_versoes: {
        Row: {
          id: string
          nome: string
          abreviacao: string
          ano: number | null
          dominio_publico: boolean
          fonte: string | null
          ordem: number
        }
        Insert: {
          id: string
          nome: string
          abreviacao: string
          ano?: number | null
          dominio_publico?: boolean
          fonte?: string | null
          ordem?: number
        }
        Update: {
          id?: string
          nome?: string
          abreviacao?: string
          ano?: number | null
          dominio_publico?: boolean
          fonte?: string | null
          ordem?: number
        }
        Relationships: []
      }
      biblia_versiculos: {
        Row: {
          versao_id: string
          livro_id: number
          capitulo: number
          versiculo: number
          texto: string
        }
        Insert: {
          versao_id: string
          livro_id: number
          capitulo: number
          versiculo: number
          texto: string
        }
        Update: {
          versao_id?: string
          livro_id?: number
          capitulo?: number
          versiculo?: number
          texto?: string
        }
        Relationships: []
      }
      campanhas_contribuicao: {
        Row: {
          id: string
          igreja_id: string
          nome: string
          descricao: string | null
          centavos: number
          ativa: boolean
          ordem: number
          imagem_url: string | null
          video_url: string | null
          destaque: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          igreja_id: string
          nome: string
          descricao?: string | null
          centavos: number
          ativa?: boolean
          ordem?: number
          imagem_url?: string | null
          video_url?: string | null
          destaque?: boolean
          criado_em?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          descricao?: string | null
          centavos?: number
          ativa?: boolean
          ordem?: number
          imagem_url?: string | null
          video_url?: string | null
          destaque?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      supervisao_participantes: {
        Row: {
          supervisao_id: string
          user_id: string
          presente: boolean
        }
        Insert: {
          supervisao_id: string
          user_id: string
          presente?: boolean
        }
        Update: {
          supervisao_id?: string
          user_id?: string
          presente?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_has_role: {
        Args: { check_role: string }
        Returns: boolean
      }
      user_igreja_id: {
        Args: Record<string, never>
        Returns: string
      }
      ensino_e_coordenador: {
        Args: Record<string, never>
        Returns: boolean
      }
      ensino_e_professor: {
        Args: Record<string, never>
        Returns: boolean
      }
      ensino_leciona: {
        Args: { p_turma_id: string }
        Returns: boolean
      }
      ensino_inscrito: {
        Args: { p_turma_id: string }
        Returns: boolean
      }
      consolidacao_pode: {
        Args: { p_celula_id: string; p_responsavel_id: string }
        Returns: boolean
      }
      supervisiona_rede: {
        Args: { p_rede_id: string }
        Returns: boolean
      }
      saude_celulas: {
        Args: { p_celula_ids: string[] }
        Returns: {
          celula_id: string
          ultimo_encontro: string | null
          encontros_90d: number
          media_presenca: number | null
          ultima_supervisao: string | null
        }[]
      }
      presenca_serie: {
        Args: {
          p_celula_ids: string[]
          p_granularidade?: string
          p_periodos?: number
        }
        Returns: {
          inicio: string
          encontros: number
          membros: number
          conjuges: number
          visitantes: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helpers para uso no app
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Igreja = Tables<'igrejas'>
export type Profile = Tables<'profiles'>
export type Rede = Tables<'redes'>
export type Celula = Tables<'celulas'>
export type CelulaMembro = Tables<'celula_membros'>
export type Encontro = Tables<'encontros'>
export type Escala = Tables<'escalas'>
export type Lanche = Tables<'lanches'>
export type Evento = Tables<'eventos'>
export type Importacao = Tables<'importacoes'>
export type EnsinoCurso = Tables<'ensino_cursos'>
export type EnsinoTurma = Tables<'ensino_turmas'>
export type EnsinoInscricao = Tables<'ensino_inscricoes'>
export type EnsinoAula = Tables<'ensino_aulas'>
export type EnsinoPresenca = Tables<'ensino_presencas'>
export type EnsinoProgresso = Tables<'ensino_progresso'>
export type EnsinoMaterial = Tables<'ensino_materiais'>
export type Consolidacao = Tables<'consolidacao'>
export type ConsolidacaoContato = Tables<'consolidacao_contatos'>
export type Supervisao = Tables<'supervisoes'>
