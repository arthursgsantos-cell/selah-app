import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const TITULO = 'IBZS · Gestão de Células'
const DESCRICAO = 'Gerencie sua célula, encontros e eventos da sua igreja.'

/**
 * A logo em `/logo-icon.png` tem 1024x1024 e 697 KB — peso demais para um
 * ícone de aba, que é exibido em 16 ou 32px. O otimizador do Next entrega o
 * mesmo arquivo redimensionado (96px sai em 3 KB) sem precisar manter cópias
 * do asset no repositório.
 *
 * Nota: `app/favicon.ico` foi removido de propósito. Era o arquivo padrão do
 * Next — a logo da Vercel — e, por ser .ico, ganhava do PNG na aba.
 */
const iconeLogo = (largura: number) =>
  `/_next/image?url=%2Flogo-icon.png&w=${largura}&q=75`

/**
 * `metadataBase` é obrigatório para o Next transformar esses caminhos em URL
 * absoluta — WhatsApp, Telegram e a folha de compartilhamento do celular só
 * aceitam caminho absoluto no og:image e, sem ele, caem no ícone genérico da
 * hospedagem.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://ibzs.vercel.app'),
  title: TITULO,
  description: DESCRICAO,
  icons: {
    icon: [
      { url: iconeLogo(48), sizes: '48x48', type: 'image/png' },
      { url: iconeLogo(96), sizes: '96x96', type: 'image/png' },
    ],
    apple: iconeLogo(256),
  },
  openGraph: {
    type: 'website',
    siteName: 'IBZS',
    title: TITULO,
    description: DESCRICAO,
    locale: 'pt_BR',
    images: [{ url: iconeLogo(640), width: 640, height: 640, alt: 'IBZS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRICAO,
    images: [iconeLogo(640)],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
