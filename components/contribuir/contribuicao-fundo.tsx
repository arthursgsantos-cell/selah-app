'use client'

import {
  atualizarFundoContribuicaoAction,
  uploadFundoContribuicaoAction,
} from '@/app/actions/contribuicao-aparencia'
import { FundoPagina, type FundoPaginaProps } from '@/components/shared/fundo-pagina'

type Props = Omit<
  FundoPaginaProps,
  'acoes' | 'capaUrl' | 'autoCorAtivo' | 'autoCorOrigem' | 'galeriaAtiva' | 'galeriaOpacidade' | 'totalFotos'
>

/**
 * Fundo da página de contribuição — dedicado, não o mesmo da home.
 *
 * Sem auto-cor e sem galeria: não há uma capa nem um álbum de fotos que
 * pertença naturalmente a esta página, então a cor é escolha da liderança e a
 * galeria fica sempre desligada.
 */
export function ContribuicaoFundo(props: Props) {
  return (
    <FundoPagina
      {...props}
      capaUrl={null}
      autoCorAtivo={false}
      autoCorOrigem={null}
      galeriaAtiva={false}
      galeriaOpacidade={0}
      totalFotos={0}
      acoes={{
        salvarAparencia: (dados) => atualizarFundoContribuicaoAction(dados),
        uploadImagem: (formData) => uploadFundoContribuicaoAction(formData),
        salvarGaleria: async () => {},
        alternarAutoCor: async () => {},
        salvarAutoCor: async () => {},
      }}
    />
  )
}
