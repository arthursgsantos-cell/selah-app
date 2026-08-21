import Link from 'next/link'
import { ArrowUpRight, Cake, CalendarDays, ChevronRight, ChurchIcon, MapPin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { montarAtalhos, type Atalho, type ContextoAtalhos } from '@/lib/home-atalhos'
import { TrocarLayoutHome } from '@/components/home/trocar-layout-home'

export interface CartaoVida {
  id: string
  href: string
  titulo: string
  detalhe: string | null
  quando: string | null
  icone: 'celula' | 'evento' | 'aniversario'
}

interface Props extends ContextoAtalhos {
  igrejaNome: string
  logoUrl: string | null
  /** Cor da igreja, quando a liderança escolheu uma. Cai no azul da marca. */
  cor: string | null
  primeiroNome: string
  iniciais: string
  avatarUrl: string | null
  saudacao: string
  papel: string
  /** O que está por acontecer: encontro da célula, próximo evento, aniversário. */
  vida: CartaoVida[]
}

/**
 * A home em Modo Ícones.
 *
 * É a mesma home, não uma segunda tela: quem escolhe este modo passa a receber
 * esta página em `/home`, e não a Landing Page com um painel por cima. A
 * primeira versão desenhava a grade num `position: fixed` sobre a landing — a
 * página inteira continuava sendo montada e rolando por baixo, o que aparecia
 * em qualquer rolagem mais rápida.
 *
 * Renderiza no servidor porque tudo aqui é dado de servidor: cargo, próximo
 * encontro, se a transmissão está no ar. O que é clique — trocar de layout —
 * mora em `TrocarLayoutHome`.
 */
export function HomeIcones({
  igrejaNome, logoUrl, cor, primeiroNome, iniciais, avatarUrl, saudacao, papel,
  vida, ...contexto
}: Props) {
  const atalhos = montarAtalhos(contexto)
  const corBase = cor?.trim() || '#0F52BA'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-4">
      {/* Identidade — logo, nome da igreja e a saudação de quem entrou.
          Compacto de propósito: o assunto desta tela é a grade abaixo. */}
      <header
        className="relative overflow-hidden rounded-3xl px-5 py-5 text-white shadow-lg"
        style={{
          backgroundImage: `linear-gradient(135deg, ${corBase} 0%, ${escurecer(corBase, 0.55)} 100%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: 'radial-gradient(circle at 88% 8%, rgba(255,255,255,.55) 0%, transparent 55%)' }}
        />
        <div className="relative flex items-center gap-4">
          {logoUrl ? (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/95 p-1.5 shadow-md ring-1 ring-white/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" aria-hidden className="h-full w-full object-contain" />
            </span>
          ) : (
            /* Sem logo, a igreja entra pelo símbolo — e não pela foto de quem
               está logado, que já está do outro lado do cabeçalho. */
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <ChurchIcon className="h-7 w-7" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight">{igrejaNome}</h1>
            <p className="mt-0.5 truncate text-sm text-white/75">
              {saudacao}, {primeiroNome}
            </p>
            <span className="mt-1.5 inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/90 ring-1 ring-white/20">
              {papel}
            </span>
          </div>
          <Link
            href="/perfil"
            aria-label="Meu perfil"
            className="shrink-0 rounded-full ring-2 ring-white/30 transition hover:ring-white/60 focus-visible:outline-none focus-visible:ring-white"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarUrl ?? undefined} alt={primeiroNome} />
              <AvatarFallback className="bg-white/20 text-xs font-bold text-white">{iniciais}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* A grade se ajusta pela largura do quadrado, e não por um número fixo
          de colunas: no celular dá três, no computador dá sete, e o quadrado
          tem o mesmo tamanho nos dois — que é o que faz parecer a tela de um
          aplicativo. Com `grid-cols-4` fixo, o mesmo quadrado virava um
          retângulo esticado de 160px na tela grande. */}
      <nav
        aria-label="Atalhos"
        className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(92px,1fr))]"
      >
        {atalhos.map((atalho, i) => (
          <Quadrado key={atalho.id} atalho={atalho} indice={i} />
        ))}
      </nav>

      {vida.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">
            Por perto
          </h2>
          <div className="grid gap-2">
            {vida.map((item, i) => (
              <Link
                key={item.id}
                href={item.href}
                style={{ '--atraso': `${(atalhos.length + i) * 32}ms` } as React.CSSProperties}
                className="atalho-entra group flex min-w-0 items-center gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {item.icone === 'celula' && <MapPin className="h-5 w-5" />}
                  {item.icone === 'evento' && <CalendarDays className="h-5 w-5" />}
                  {item.icone === 'aniversario' && <Cake className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug line-clamp-2">{item.titulo}</span>
                  {item.detalhe && (
                    <span className="block truncate text-xs text-muted-foreground">{item.detalhe}</span>
                  )}
                </span>
                {item.quando && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {item.quando}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* A saída. No fim da página, e não boiando num canto da tela: é decisão
          que se toma depois de olhar a grade, não durante. */}
      <TrocarLayoutHome destino="landing" />
    </div>
  )
}

/** Um quadrado da grade. */
function Quadrado({ atalho, indice }: { atalho: Atalho; indice: number }) {
  const { icon: Icone, cores, largo, selo, externo } = atalho
  const estilo = { '--atraso': `${indice * 32}ms` } as React.CSSProperties

  if (largo) {
    // A transmissão no ar: deitada, ocupando a linha, com o ponto pulsando.
    return (
      <a
        href={atalho.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...estilo, backgroundImage: `linear-gradient(120deg, ${cores[0]} 0%, ${cores[1]} 100%)` }}
        className="atalho-entra group col-span-full flex items-center gap-3 overflow-hidden rounded-[22px] p-4 text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
          <Icone className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold leading-tight">
            {atalho.label}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              {selo}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-white/80">Toque para assistir agora</span>
        </span>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-white/80" />
      </a>
    )
  }

  const conteudo = (
    <>
      {selo && (
        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground shadow-sm">
          {selo}
        </span>
      )}
      <span
        className="flex h-12 w-12 items-center justify-center rounded-[15px] text-white shadow-md transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
        style={{
          backgroundImage: `linear-gradient(150deg, ${cores[0]} 0%, ${cores[1]} 100%)`,
          boxShadow: `0 6px 16px -6px ${cores[1]}99`,
        }}
      >
        <Icone className="h-6 w-6" strokeWidth={2} />
      </span>
      <span className="mt-2 block text-center text-[11px] font-semibold leading-tight tracking-tight sm:text-xs">
        {atalho.label}
      </span>
    </>
  )

  const classe =
    'atalho-entra group relative flex flex-col items-center justify-center rounded-[22px] bg-card p-3 shadow-sm ring-1 ring-border/60 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97]'

  if (externo) {
    return (
      <a href={atalho.href} target="_blank" rel="noopener noreferrer" className={classe} style={estilo}>
        {conteudo}
      </a>
    )
  }

  return (
    <Link href={atalho.href} className={classe} style={estilo}>
      {conteudo}
    </Link>
  )
}

/**
 * Escurece um hex para formar o segundo tom do degradê da capa.
 *
 * Existe para o Modo Ícones herdar a cor que a liderança escolheu em Aparência
 * sem pedir uma segunda cor: entra uma cor, sai o degradê.
 */
function escurecer(hex: string, fator: number): string {
  const limpo = hex.replace('#', '')
  if (limpo.length !== 6) return hex
  const n = Number.parseInt(limpo, 16)
  if (Number.isNaN(n)) return hex
  const canal = (deslocamento: number) =>
    Math.max(0, Math.round(((n >> deslocamento) & 255) * (1 - fator)))
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0')).join('')}`
}
