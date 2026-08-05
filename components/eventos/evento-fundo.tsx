'use client'

import {
  atualizarFundoEventoAction,
  uploadFundoEventoAction,
  atualizarFundoGaleriaEventoAction,
  alternarAutoCorEventoAction,
  salvarAutoCorEventoAction,
} from '@/app/actions/evento-pagina'
import { FundoPagina, type FundoPaginaProps } from '@/components/shared/fundo-pagina'

type Props = Omit<FundoPaginaProps, 'acoes'> & { eventoId: string }

/**
 * Fundo da página do evento.
 *
 * A mecânica toda mora em `FundoPagina`, compartilhada com as turmas do
 * Ensino; aqui ficam apenas as ações que sabem gravar em `eventos`.
 */
export function EventoFundo({ eventoId, ...resto }: Props) {
  return (
    <FundoPagina
      {...resto}
      acoes={{
        salvarAparencia: (dados) => atualizarFundoEventoAction(eventoId, dados),
        uploadImagem: (formData) => uploadFundoEventoAction(eventoId, formData),
        salvarGaleria: (dados) => atualizarFundoGaleriaEventoAction(eventoId, dados),
        alternarAutoCor: (ativo) => alternarAutoCorEventoAction(eventoId, ativo),
        salvarAutoCor: (cores) => salvarAutoCorEventoAction(eventoId, cores),
      }}
    />
  )
}
