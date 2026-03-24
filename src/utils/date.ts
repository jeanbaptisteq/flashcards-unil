const DAY_MS = 24 * 60 * 60 * 1000

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function todayLocal(): string {
  return formatDate(new Date())
}

export function addDaysToToday(days: number): string {
  return addDays(todayLocal(), days)
}

export function addDays(baseDate: string, days: number): string {
  const parsed = parseDate(baseDate) ?? new Date()
  const next = new Date(parsed)
  next.setDate(next.getDate() + days)
  return formatDate(next)
}

export function compareDate(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function daysBetween(fromDate: string, toDate: string): number {
  const from = parseDate(fromDate)
  const to = parseDate(toDate)
  if (!from || !to) return 0
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS)
}

