import type { NextConfig } from 'next'

/**
 * Статический экспорт: сайт — концепт для портфолио, живёт на GitHub Pages,
 * сервера нет. `next build` кладёт готовые файлы в `out/`.
 * Если сайт будет жить в подпути username.github.io/REPO/ — добавить
 * basePath: '/REPO'.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
