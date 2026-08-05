'use client'

import {
  atualizarFundoTurmaAction,
  uploadFundoTurmaAction,
  atualizarFundoGaleriaTurmaAction,
  alternarAutoCorTurmaAction,
  salvarAutoCorTurmaAction,
} from '@/app/actions/ensino/aparencia'
import { FundoPagina, type FundoPaginaProps } from '@/components/shared/fundo-pagina'

type Props = Omit<FundoPaginaProps, 'acoes'> & { turmaId: string }

/**
 * Fundo da página da turma. Mesma mecânica dos eventos — só muda a tabela.
 */
export function TurmaFundo({ turmaId, ...resto }: Props) {
  return (
    <FundoPagina
      {...resto}
      acoes={{
        salvarAparencia: (dados) => atualizarFundoTurmaAction(turmaId, dados),
        uploadImagem: (formData) => uploadFundoTurmaAction(turmaId, formData),
        salvarGaleria: (dados) => atualizarFundoGaleriaTurmaAction(turmaId, dados),
        alternarAutoCor: (ativo) => alternarAutoCorTurmaAction(turmaId, ativo),
        salvarAutoCor: (cores) => salvarAutoCorTurmaAction(turmaId, cores),
      }}
    />
  )
}
