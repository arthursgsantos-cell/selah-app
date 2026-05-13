export type Role = 'admin' | 'pastor' | 'supervisor' | 'lider' | 'membro'
export type Frequencia = 'semanal' | 'quinzenal'
export type StatusEncontro = 'agendado' | 'realizado' | 'cancelado'
export type FuncaoEscala = 'louvor' | 'quebra_gelo' | 'edificacao' | 'compartilhar'
export type PapelCelula = 'lider' | 'membro'
export type TipoEvento = 'culto' | 'igreja' | 'rede' | 'celula' | 'outro'
export type RecorrenciaTipo = 'semanal' | 'quinzenal' | 'mensal'

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
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          slug: string
          logo_url?: string | null
          codigo_convite: string
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          slug?: string
          logo_url?: string | null
          codigo_convite?: string
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
          avatar_url: string | null
          role: Role
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          igreja_id: string
          nome: string
          email?: string | null
          telefone?: string | null
          avatar_url?: string | null
          role?: Role
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          email?: string | null
          telefone?: string | null
          avatar_url?: string | null
          role?: Role
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
      redes: {
        Row: {
          id: string
          igreja_id: string
          nome: string
          descricao: string | null
          cor: string
          created_at: string
        }
        Insert: {
          id?: string
          igreja_id: string
          nome: string
          descricao?: string | null
          cor?: string
          created_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          nome?: string
          descricao?: string | null
          cor?: string
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
          frequencia: Frequencia
          dia_semana: number | null
          horario: string | null
          local_padrao: string | null
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
          frequencia?: Frequencia
          dia_semana?: number | null
          horario?: string | null
          local_padrao?: string | null
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
          frequencia?: Frequencia
          dia_semana?: number | null
          horario?: string | null
          local_padrao?: string | null
          ativa?: boolean
          created_at?: string
        }
        Relationships: []
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
          avisos: string | null
          edificacao_resumo: string | null
          card_imagem_url: string | null
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
          avisos?: string | null
          edificacao_resumo?: string | null
          card_imagem_url?: string | null
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
          avisos?: string | null
          edificacao_resumo?: string | null
          card_imagem_url?: string | null
          status?: StatusEncontro
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      escalas: {
        Row: {
          id: string
          encontro_id: string
          funcao: FuncaoEscala
          responsavel_id: string | null
          observacao: string | null
        }
        Insert: {
          id?: string
          encontro_id: string
          funcao: FuncaoEscala
          responsavel_id?: string | null
          observacao?: string | null
        }
        Update: {
          id?: string
          encontro_id?: string
          funcao?: FuncaoEscala
          responsavel_id?: string | null
          observacao?: string | null
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
          ordem?: number
          created_at?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          id: string
          igreja_id: string
          rede_id: string | null
          celula_id: string | null
          titulo: string
          descricao: string | null
          data_hora: string
          local: string | null
          imagem_url: string | null
          tipo: TipoEvento
          recorrencia_id: string | null
          recorrencia_tipo: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          igreja_id: string
          rede_id?: string | null
          celula_id?: string | null
          titulo: string
          descricao?: string | null
          data_hora: string
          local?: string | null
          imagem_url?: string | null
          tipo?: TipoEvento
          recorrencia_id?: string | null
          recorrencia_tipo?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          igreja_id?: string
          rede_id?: string | null
          celula_id?: string | null
          titulo?: string
          descricao?: string | null
          data_hora?: string
          local?: string | null
          imagem_url?: string | null
          tipo?: TipoEvento
          recorrencia_id?: string | null
          recorrencia_tipo?: string | null
          created_by?: string | null
          created_at?: string
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
