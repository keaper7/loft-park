import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, JetBrains_Mono, Onest, Unbounded } from 'next/font/google'
import { meta } from '@/content'
import { SmoothScroll } from '@/lib/SmoothScroll'
import { SceneLayer } from '@/components/SceneLayer'
import { Preloader } from '@/components/Preloader'
import { Cursor } from '@/components/Cursor'
import { Nav } from '@/components/Nav'
import { OrderTray } from '@/components/OrderTray'
import './globals.css'

// Кириллица обязательна: без сабсета Next подгрузит только латиницу
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], weight: ['500', '700', '800'], variable: '--font-unbounded', display: 'swap' })
const cormorant = Cormorant_Garamond({ subsets: ['latin', 'cyrillic'], weight: ['500', '600'], style: ['italic'], variable: '--font-cormorant', display: 'swap' })
const onest = Onest({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600'], variable: '--font-onest', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], weight: ['500'], variable: '--font-mono-ui', display: 'swap' })

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: { type: 'website', locale: 'ru_RU', title: meta.title, description: meta.description },
  // Концепт, а не официальный сайт ресторана: в поиске он не должен
  // конкурировать с настоящими страницами заведения.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#0c0a08',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${cormorant.variable} ${onest.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('scrollRestoration' in history) history.scrollRestoration='manual';window.scrollTo(0,0)`,
          }}
        />
      </head>
      <body>
        <SmoothScroll />
        <SceneLayer />
        <Preloader />
        <Cursor />
        <Nav />
        <main id="main" className="relative z-10">
          {children}
        </main>
        <OrderTray />
      </body>
    </html>
  )
}
