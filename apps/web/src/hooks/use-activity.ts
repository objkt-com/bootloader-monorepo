import { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchBootloaderActivity,
  fetchUserProfilesBatch,
  getDisplayName,
  ActivityEvent,
} from '@/services/objkt'

interface UseActivityOptions {
  limit?: number
  pollInterval?: number
  enabled?: boolean
}

interface UseActivityResult {
  events: ActivityEvent[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

async function hydrateActivityNames(events: ActivityEvent[]): Promise<ActivityEvent[]> {
  const addresses = Array.from(
    new Set(
      events.flatMap((event) => [event.creatorAddress, event.recipientAddress])
        .filter((address): address is string => Boolean(address))
    )
  )
  if (addresses.length === 0) return events

  try {
    const profiles = await fetchUserProfilesBatch(addresses)
    return events.map((event) => ({
      ...event,
      creatorAlias: event.creatorAlias || (event.creatorAddress
        ? getDisplayName(profiles.get(event.creatorAddress) || null, event.creatorAddress)
        : undefined),
      recipientAlias: event.recipientAlias || (event.recipientAddress
        ? getDisplayName(profiles.get(event.recipientAddress) || null, event.recipientAddress)
        : undefined),
    }))
  } catch (error) {
    console.warn('Failed to hydrate activity display names:', error)
    return events
  }
}

export function useActivity(options: UseActivityOptions = {}): UseActivityResult {
  const { limit = 50, pollInterval = 5000, enabled = true } = options
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const lastTimestamp = useRef<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const loadInitialActivity = useCallback(async () => {
    if (!enabled) return

    try {
      setIsLoading(true)
      setError(null)

      const activityData = await fetchBootloaderActivity(limit)
      const hydratedEvents = await hydrateActivityNames(activityData)
      setEvents(hydratedEvents)

      // Store the timestamp of the most recent event for polling
      if (activityData.length > 0) {
        lastTimestamp.current = activityData[0].timestamp
      }
    } catch (err) {
      console.error('Failed to load activity:', err)
      setError(err instanceof Error ? err : new Error('Failed to load activity'))
    } finally {
      setIsLoading(false)
    }
  }, [limit, enabled])

  const pollForNewActivity = useCallback(async () => {
    if (!lastTimestamp.current || !enabled) return

    try {
      const newEvents = await fetchBootloaderActivity(10, lastTimestamp.current)
      const hydratedNewEvents = await hydrateActivityNames(newEvents)

      if (hydratedNewEvents.length > 0) {
        setEvents((prevEvents) => {
          // Merge new events with existing ones, avoiding duplicates
          const existingIds = new Set(prevEvents.map((e) => e.id))
          const uniqueNewEvents = hydratedNewEvents.filter((e) => !existingIds.has(e.id))

          if (uniqueNewEvents.length > 0) {
            // Update the last timestamp
            lastTimestamp.current = uniqueNewEvents[0].timestamp

            // Add new events to the beginning and limit total to 100
            return [...uniqueNewEvents, ...prevEvents].slice(0, 100)
          }

          return prevEvents
        })
      }
    } catch (err) {
      console.error('Failed to poll for new activity:', err)
      // Don't show error for polling failures, just log them
    }
  }, [enabled])

  // Initial load
  useEffect(() => {
    loadInitialActivity()
  }, [loadInitialActivity])

  // Set up polling
  useEffect(() => {
    if (!enabled || !pollInterval) return

    intervalRef.current = setInterval(pollForNewActivity, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [pollForNewActivity, pollInterval, enabled])

  return {
    events,
    isLoading,
    error,
    refetch: loadInitialActivity,
  }
}
