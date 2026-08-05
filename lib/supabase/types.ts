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
export type FuncaoEscala = 'louvor' | 'quebra_gelo' | 'edificacao' | 'compartilhar' | 'lanche' | 'card'
export type PapelCelula = 'lider' | 'membro'
export type TipoEvento = 'culto' | 'igreja' | 'rede' | 'celula' | 'outro'
export type RecorrenciaTipo = 'semanal' | 'quinzenal' | 'mensal'
export type TipoInscricao = 'aberto' | 'whatsapp' | 'formulario' | 'pix' | 'link'
export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
export type TipoImportacao = 'roteiro' | 'foto_celula' | 'evento'
export type StatusImportacao = 'importado' | 'ignorado' | 'pendente' | 'erro'
export type TipoSecaoEvento = 'inscricao' | 'botoes' | 'cards' | 'video' | 'fotos'

// --- Ensino ---------------------------------------------------------------
/**
 * Papel dentro do Ensino. Deliberadamente fora de `Role`: `ROLE_ORDER` compara
 * cargos por hierarquia, e dar aula não é um degrau dessa escada — um membro
 * comum pode ser professor.
 */
export type PapelEnsino = 'professor' | 'coordenador'
export type StatusTurma = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'
export type StatusInscricaoEnsino = 'pendente' | 'aprovada' | 'recusada' | 'cancelada' | 'concluida'
export type StatusAula = 'agendada' | 'realizada' | 'cancelada'
export type TipoMaterial = 'arquivo' | 'link' | 'video'
/**
 * Como a pessoa se inscreve numa turma. `link` e `whatsapp` mandam para fora —
 * nesses dois o app não registra inscrição nem monta lista de chamada.
 */
export type TipoInscricaoTurma = 'app' | 'formulario' | 'link' | 'whatsapp'
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
          curso_id: string
          igreja_id: string
          nome: string
          descricao: string | null
          capa_url: string | null
          local: string | null
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
          whatsapp_url: string | null
          tipo_inscricao: TipoInscricaoTurma
          link_inscricao_url: string | null
          whatsapp_inscricao: string | null
          formulario_id: string | null
          criado_por: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          curso_id: string
          igreja_id: string
          nome: string
          descricao?: string | null
          capa_url?: string | null
          local?: string | null
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
          whatsapp_inscricao?: string | null
          formulario_id?: string | null
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          curso_id?: string
          igreja_id?: string
          nome?: string
          descricao?: string | null
          capa_url?: string | null
          local?: string | null
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
          whatsapp_inscricao?: string | null
          formulario_id?: string | null
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      ensino_turma_professores: {
        Row: {
          turma_id: string
          profile_id: string
          principal: boolean
          criado_em: string
        }
        Insert: {
          turma_id: string
          profile_id: string
          principal?: boolean
          criado_em?: string
        }
        Update: {
          turma_id?: string
          profile_id?: string
          principal?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      ensino_inscricoes: {
        // `nome`, `telefone` e `email` são cópia do perfil no momento da
        // inscrição: a lista do professor não pode mudar sozinha quando o
        // aluno troca o telefone.
        Row: {
          id: string
          turma_id: string
          user_id: string
          nome: string
          telefone: string | null
          email: string | null
          dados: Record<string, string>
          status: StatusInscricaoEnsino
          observacao: string | null
          decidido_por: string | null
          decidido_em: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          turma_id: string
          user_id: string
          nome: string
          telefone?: string | null
          email?: string | null
          dados?: Record<string, string>
          status?: StatusInscricaoEnsino
          observacao?: string | null
          decidido_por?: string | null
          decidido_em?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          turma_id?: string
          user_id?: string
          nome?: string
          telefone?: string | null
          email?: string | null
          dados?: Record<string, string>
          status?: StatusInscricaoEnsino
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
          criado_em?: string
        }
        Relationships: []
      }
      ensino_presencas: {
        Row: {
          id: string
          aula_id: string
          inscricao_id: string
          user_id: string
          presente: boolean
          observacao: string | null
          registrado_por: string | null
          registrado_em: string
        }
        Insert: {
          id?: string
          aula_id: string
          inscricao_id: string
          user_id: string
          presente?: boolean
          observacao?: string | null
          registrado_por?: string | null
          registrado_em?: string
        }
        Update: {
          id?: string
          aula_id?: string
          inscricao_id?: string
          user_id?: string
          presente?: boolean
          observacao?: string | null
          registrado_por?: string | null
          registrado_em?: string
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
export type EnsinoMaterial = Tables<'ensino_materiais'>
