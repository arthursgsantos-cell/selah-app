import type { CampoFormulario } from '@/lib/supabase/types'

export const FORMULARIO_TEMPLATES: { nome: string; descricao: string; campos: CampoFormulario[] }[] = [
  {
    nome: 'Inscrição Básica',
    descricao: 'Nome e WhatsApp — ideal para eventos simples.',
    campos: [
      { id: 'nome', tipo: 'texto', label: 'Nome completo', obrigatorio: true },
      { id: 'telefone', tipo: 'telefone', label: 'WhatsApp', obrigatorio: true },
    ],
  },
  {
    nome: 'Inscrição para Evento',
    descricao: 'Nome, WhatsApp e e-mail.',
    campos: [
      { id: 'nome', tipo: 'texto', label: 'Nome completo', obrigatorio: true },
      { id: 'telefone', tipo: 'telefone', label: 'WhatsApp', obrigatorio: true },
      { id: 'email', tipo: 'email', label: 'E-mail', obrigatorio: false },
    ],
  },
  {
    nome: 'Inscrição para Retiro',
    descricao: 'Formulário completo com dados pessoais e restrições.',
    campos: [
      { id: 'nome', tipo: 'texto', label: 'Nome completo', obrigatorio: true },
      { id: 'telefone', tipo: 'telefone', label: 'WhatsApp', obrigatorio: true },
      { id: 'email', tipo: 'email', label: 'E-mail', obrigatorio: false },
      { id: 'estado_civil', tipo: 'opcoes', label: 'Estado civil', obrigatorio: true,
        opcoes: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)'] },
      { id: 'tem_filhos', tipo: 'opcoes', label: 'Tem filhos?', obrigatorio: true,
        opcoes: ['Sim', 'Não'] },
      { id: 'restricoes', tipo: 'textarea', label: 'Restrições alimentares ou necessidades especiais', obrigatorio: false },
    ],
  },
]
