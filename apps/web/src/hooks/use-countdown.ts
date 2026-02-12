import { useState, useEffect } from 'react'

export interface CountdownTime {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
  isExpired: boolean
}

/**
 * Hook that returns a countdown to a target date
 * Updates every second when active
 */
export function useCountdown(targetDate: string | null | undefined): CountdownTime {
  const [timeLeft, setTimeLeft] = useState<CountdownTime>(() => calculateTimeLeft(targetDate))

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true })
      return
    }

    // Calculate immediately
    setTimeLeft(calculateTimeLeft(targetDate))

    // Update every second
    const interval = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(targetDate)
      setTimeLeft(newTimeLeft)

      // Stop the interval if expired
      if (newTimeLeft.isExpired) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

function calculateTimeLeft(targetDate: string | null | undefined): CountdownTime {
  if (!targetDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true }
  }

  const target = new Date(targetDate).getTime()
  const now = Date.now()
  const difference = target - now

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true }
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24))
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((difference % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, total: difference, isExpired: false }
}

/**
 * Format countdown for display
 * Shows different formats based on time remaining
 */
export function formatCountdown(countdown: CountdownTime): string {
  if (countdown.isExpired) return ''

  const { days, hours, minutes, seconds } = countdown

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Format countdown for compact display (cards)
 */
export function formatCountdownCompact(countdown: CountdownTime): string {
  if (countdown.isExpired) return ''

  const { days, hours, minutes, seconds } = countdown

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}
