import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { PwaInstaller } from '@/components/shared/pwa-installer'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const TITULO = 'IBZS · Gestão de Células'
const DESCRICAO = 'Gerencie sua célula, encontros e eventos da sua igreja.'

const iconeLogo = (largura: number) =>
  `/_next/image?url=%2Flogo-icon.png&w=${largura}&q=75`

export const viewport: Viewport = {
  themeColor: '#0f62fe',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://ibzs.vercel.app'),
  title: TITULO,
  description: DESCRICAO,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IBZS',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: iconeLogo(48), sizes: '48x48', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
        <PwaInstaller />
      </body>
    </html>
  )
}

