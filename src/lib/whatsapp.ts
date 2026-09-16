import { rub, trayTotal, type TrayItem } from './store'

export type BookingData = {
  date: Date
  time: string
  guests: number
  zone: string
  name: string
  comment: string
  tray: TrayItem[]
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * Собирает читаемый текст брони — так, как он выглядел бы в WhatsApp
 * администратора. Сайт концептуальный и с реальным Loft Park не
 * согласован, поэтому никуда не отправляется: это витрина интерфейса,
 * а не рабочий канал бронирования. См. contact в content.ts.
 */
export function bookingMessage(d: BookingData): string {
  const lines = [
    'Здравствуйте! Хочу забронировать стол в Loft Park.',
    '',
    `📅 ${dateFmt.format(d.date)}, ${d.time}`,
    `👥 Гостей: ${d.guests}`,
    `📍 Зона: ${d.zone}`,
    `🙂 Имя: ${d.name.trim()}`,
  ]
  if (d.comment.trim()) lines.push(`💬 ${d.comment.trim()}`)
  if (d.tray.length) {
    lines.push('', 'Хотим сразу заказать:')
    d.tray.forEach((i) => lines.push(`• ${i.name} × ${i.qty}`))
    lines.push(`Ориентировочно: ${rub(trayTotal(d.tray))}`)
  }
  return lines.join('\n')
}
