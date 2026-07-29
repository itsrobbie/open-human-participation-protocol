/**
 * Relative time formatting.
 * Produces human-friendly strings like "2 minutes ago", "Yesterday at 3:14 PM", "Mar 15, 2025".
 * Uses Intl.RelativeTimeFormat for recent times and Intl.DateTimeFormat for older dates.
 * No external dependencies.
 */

const MINUTE = 60
const HOUR = 3600
const DAY = 86400

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en', {
  hour: 'numeric',
  minute: '2-digit',
})

/**
 * Format a date string or Date into a human-readable relative time.
 *
 * - < 1 minute: "just now"
 * - < 1 hour: "X minutes ago"
 * - < 24 hours: "X hours ago"
 * - Yesterday: "Yesterday at 3:14 PM"
 * - < 7 days: "3 days ago"
 * - Older: "Mar 15, 2025"
 */
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSeconds < MINUTE) {
    return 'just now'
  }

  if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE)
    return rtf.format(-minutes, 'minute')
  }

  if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR)
    return rtf.format(-hours, 'hour')
  }

  // Check if it was yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday at ${timeFormatter.format(date)}`
  }

  if (diffSeconds < DAY * 7) {
    const days = Math.floor(diffSeconds / DAY)
    return rtf.format(-days, 'day')
  }

  return dateFormatter.format(date)
}

/**
 * Format a date as a short date string: "Mar 15, 2025"
 */
export function formatDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return dateFormatter.format(date)
}

/**
 * Format a date with time: "Mar 15, 2025 at 3:14 PM"
 */
export function formatDateTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return `${dateFormatter.format(date)} at ${timeFormatter.format(date)}`
}
