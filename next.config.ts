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

/**
 * Подпуть — только в продакшен-сборке. В `npm run dev` сайт живёт в корне:
 * иначе адрес, который печатает dev-сервер (localhost:3000), показывал
 * заглушку «404 This page could not be found» поверх 3D-сцены, а рабочим
 * был только localhost:3000/loft-park/ — ловушка при каждом запуске.
 */
const BASE_PATH = process.env.NODE_ENV === 'production' ? `/${REPO}` : ''

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: BASE_PATH,
  // для ссылки «На главную» со страницы 404 (NotFoundView)
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
