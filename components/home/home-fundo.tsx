'use client'

import {
  atualizarFundoHomeAction,
  uploadFundoHomeAction,
  atualizarFundoGaleriaHomeAction,
} from '@/app/actions/home-aparencia'
import { FundoPagina, type FundoPaginaProps } from '@/components/shared/fundo-pagina'

type Props = Omit<FundoPaginaProps, 'acoes' | 'capaUrl' | 'autoCorAtivo' | 'autoCorOrigem'>

/**
 * Fundo da página inicial.
 *
 * Sem auto-cor: a home não tem uma capa única de onde extrair a paleta — quem
 * define a cor é a liderança, à mão.
 */
export function HomeFundo(props: Props) {
  return (
    <FundoPagina
      {...props}
      capaUrl={null}
      autoCorAtivo={false}
      autoCorOrigem={null}
      acoes={{
        salvarAparencia: (dados) => atualizarFundoHomeAction(dados),
        uploadImagem: (formData) => uploadFundoHomeAction(formData),
        salvarGaleria: (dados) => atualizarFundoGaleriaHomeAction(dados),
        alternarAutoCor: async () => {},
        salvarAutoCor: async () => {},
      }}
    />
  )
}
