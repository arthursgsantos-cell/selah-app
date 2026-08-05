/**
 * Fotos do próprio lugar (célula, rede ou evento) em cascata atrás do
 * conteúdo.
 *
 * É uma camada ADICIONAL: fica entre o fundo colorido (`-z-[20]`) e o
 * conteúdo, então cor, degradê e nébula continuam valendo por baixo.
 *
 * A cascata usa `columns` do CSS: as fotos preenchem colunas de cima para
 * baixo, cada uma com sua altura natural, e o resultado é um mosaico
 * irregular — mais interessante que uma grade certinha. As mais recentes vêm
 * primeiro na lista e por isso aparecem no topo.
 */

interface Props {
  /** URLs já ordenadas da mais recente para a mais antiga. */
  fotos: string[]
  /** 0–100. */
  opacidade: number
  ativo: boolean
}

/** Repetimos as fotos até encher a tela quando são poucas. */
const MINIMO_PARA_PREENCHER = 12

/** Quantas vezes, no máximo, a mesma foto pode reaparecer. */
const REPETICOES_MAXIMAS = 6

export function FundoGaleria({ fotos, opacidade, ativo }: Props) {
  if (!ativo || fotos.length === 0) return null

  // Com duas ou três fotos, a cascata deixaria metade da tela vazia; repetir
  // preenche. Mas repetir *na mesma ordem* alinha a mesma foto lado a lado —
  // `columns` preenche uma coluna inteira antes de passar para a seguinte, e
  // ciclos idênticos caem na mesma altura em todas elas.
  //
  // Deslocar o começo de cada ciclo desencontra as repetições: o ciclo 0 sai
  // como a,b,c; o ciclo 1 como b,c,a; o ciclo 2 como c,a,b.
  const preenchidas: string[] = []
  for (let ciclo = 0; ciclo < REPETICOES_MAXIMAS; ciclo++) {
    for (let i = 0; i < fotos.length; i++) {
      preenchidas.push(fotos[(i + ciclo) % fotos.length])
    }
    if (preenchidas.length >= MINIMO_PARA_PREENCHER) break
  }

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ opacity: Math.min(100, Math.max(0, opacidade)) / 100 }}
      aria-hidden="true"
    >
      <div className="columns-2 gap-1.5 p-1.5 sm:columns-3">
        {preenchidas.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${i}`}
            src={url}
            alt=""
            loading="lazy"
            className="mb-1.5 w-full break-inside-avoid rounded-lg object-cover"
          />
        ))}
      </div>
    </div>
  )
}
