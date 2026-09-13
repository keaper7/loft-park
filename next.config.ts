import type { NextConfig } from 'next'

/**
 * Статический экспорт: сайт — концепт для портфолио, живёт на GitHub Pages,
 * сервера нет. `next build` кладёт готовые файлы в `out/`.
 *
 * Сайт открывается по адресу keaper7.github.io/loft-park/ — не в корне
 * домена, а в подпути с именем репозитория. Без basePath все ссылки на
 * стили, скрипты и шрифты Next.js генерирует от корня (/_next/...), и
 * браузер ищет их на keaper7.github.io/_next/... — там их нет, 404,
 * и сайт остаётся голым текстом без единого стиля. Ровно это и
 * произошло при первом деплое.
 *
 * Если сайт когда-нибудь переедет на свой домен (как zarechye-boxing.ru) —
 * basePath нужно будет убрать, а домен прописать в public/CNAME.
 */
const REPO = 'loft-park'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: `/${REPO}`,
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
