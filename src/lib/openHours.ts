import { contact } from '@/content'

/**
 * Статус «открыто / закрыто» по времени Нальчика (Europe/Moscow),
 * а не по часам посетителя — сайт могут открыть и из другого пояса.
 * Закрытие после полуночи: открыто, если час ≥ open ИЛИ час < close.
 */
export function openStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const mins = h * 60 + m
  const { open, close } = contact.hours
  const openAt = open * 60
  const closeAt = close * 60

  const isOpen = mins >= openAt || mins < closeAt
  const until = isOpen
    ? (closeAt - mins + 1440) % 1440
    : (openAt - mins + 1440) % 1440

  return { isOpen, until, label: isOpen ? `закроется через ${fmt(until)}` : `откроется через ${fmt(until)}` }
}

/** Текущие дата (без времени) и минуты от полуночи — в поясе Нальчика */
export function moscowNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return {
    date: new Date(get('year'), get('month') - 1, get('day')),
    minutes: get('hour') * 60 + get('minute'),
  }
}

function fmt(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} мин`
  if (m === 0) return `${h} ч`
  return `${h} ч ${m} мин`
}
