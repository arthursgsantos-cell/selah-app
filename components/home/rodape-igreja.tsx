import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'

export interface IgrejaRodape {
  nome?: string | null
  logo_url?: string | null
  descricao?: string | null
  endereco?: string | null
  horario_culto?: string | null
  instagram_url?: string | null
  facebook_url?: string | null
  youtube_url?: string | null
  spotify_url?: string | null
}

export interface LinkRodape {
  href: string
  label: string
}

/**
 * O rodapé da página inicial — identidade, endereço, horários, redes e os
 * atalhos de sempre.
 *
 * Estava escrito duas vezes dentro de `app/(app)/home/page.tsx`, uma para o
 * visitante e outra para quem entrou, iguais em tudo menos na fileira de
 * atalhos. Agora é um componente só, e a fileira vem por `links` — que é a
 * única coisa que de fato muda entre quem pode entrar e quem já entrou. O
 * Modo Ícones é o terceiro a usar: a igreja tem um endereço só, e ele não
 * muda porque a pessoa escolheu ver a home em grade.
 *
 * A margem negativa horizontal fica com quem chama, porque cada home tem o seu
 * respiro lateral; a de baixo é sempre a mesma e mora em `.rodape-ate-o-fim`,
 * no CSS global.
 */
export function RodapeIgreja({
  igreja,
  links,
  className = '',
}: {
  igreja: IgrejaRodape | null
  links: LinkRodape[]
  className?: string
}) {
  const nome = igreja?.nome ?? 'Igreja Batista Zona Sul'
  const temRedes = Boolean(
    igreja?.instagram_url || igreja?.facebook_url || igreja?.youtube_url || igreja?.spotify_url
  )

  return (
    <footer
      className={`rodape-ate-o-fim bg-[#0B2447] text-white px-6 pt-8 rounded-t-3xl mt-2 ${className}`}
    >
      {/* Logo + nome */}
      <div className="flex items-center gap-3 mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={igreja?.logo_url || '/logo.png'}
          alt={nome}
          className="h-10 w-10 rounded-xl bg-white p-1.5 object-contain shrink-0"
        />
        <div className="min-w-0">
          <p className="font-bold text-base leading-tight">{nome}</p>
          {igreja?.descricao && (
            <p className="text-xs text-blue-200/70 mt-0.5 line-clamp-1">{igreja.descricao}</p>
          )}
        </div>
      </div>

      {/* Endereço e horários */}
      {(igreja?.endereco || igreja?.horario_culto) && (
        <div className="space-y-2 mb-5">
          {igreja?.endereco && (
            <div className="flex items-start gap-2 text-xs text-blue-100/80">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-300" />
              <span>{igreja.endereco}</span>
            </div>
          )}
          {igreja?.horario_culto && (
            <div className="flex items-start gap-2 text-xs text-blue-100/80">
              <CalendarDays className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-300" />
              <span>{igreja.horario_culto}</span>
            </div>
          )}
        </div>
      )}

      {/* Redes sociais. `flex-wrap` porque com quatro botões a linha estoura na
          largura de celular — sem ele o último fica cortado fora da tela. */}
      {temRedes && (
        <div className="flex flex-wrap gap-2 mb-6">
          {igreja?.instagram_url && (
            <a href={igreja.instagram_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> Instagram
            </a>
          )}
          {igreja?.facebook_url && (
            <a href={igreja.facebook_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Facebook
            </a>
          )}
          {igreja?.youtube_url && (
            <a href={igreja.youtube_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF0000] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> YouTube
            </a>
          )}
          {igreja?.spotify_url && (
            <a href={igreja.spotify_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1DB954] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.56 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg> Mensagens
            </a>
          )}
        </div>
      )}

      {/* Atalhos — o que muda entre a home do visitante e a de quem entrou. */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-blue-200/70 border-t border-white/10 pt-5 mb-4">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white transition-colors">
              {link.label}
            </Link>
          ))}
        </div>
      )}

      <p className="text-[10px] text-blue-200/40">
        © {new Date().getFullYear()} {nome} · Todos os direitos reservados
      </p>
    </footer>
  )
}
