import type { Metadata } from 'next'
import { NotFoundView } from '@/components/NotFoundView'

export const metadata: Metadata = {
  title: 'Страница не найдена — Loft Park',
}

/**
 * 404 в стиле сайта вместо английской заглушки Next.js («This page could
 * not be found»). На GitHub Pages она же — 404.html: её отдают по любому
 * неизвестному адресу внутри /loft-park/.
 */
export default function NotFound() {
  return <NotFoundView />
}
