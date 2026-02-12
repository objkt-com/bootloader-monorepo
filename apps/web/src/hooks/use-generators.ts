import { useState, useEffect, useCallback } from 'react'
import { tzktService } from '@/services/tzkt'
import { fetchUserProfilesBatch, getDisplayName } from '@/services/objkt'
import type { Generator } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'
import { CONFIG } from '@/config'

interface UseGeneratorsOptions {
  bootloaderId?: BootloaderId
  creator?: string
  excludeFlagged?: boolean
}

interface UseGeneratorsResult {
  generators: Generator[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useGenerators(options: UseGeneratorsOptions = {}): UseGeneratorsResult {
  const [generators, setGenerators] = useState<Generator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchGenerators = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    // Clear generators immediately when refetching to prevent stale data
    setGenerators([])
    try {
      // Fetch from both contracts and combine
      let data = await tzktService.getAllGenerators()

      // Filter by bootloader if specified
      if (options.bootloaderId) {
        data = data.filter((g) => g.bootloaderId === options.bootloaderId)
      }

      // Filter by creator if specified
      if (options.creator) {
        data = data.filter((g) => g.creator === options.creator)
      }

      // Exclude flagged generators by default
      if (options.excludeFlagged !== false) {
        data = data.filter((g) => !g.flagged)
      }

      const creatorAddresses = Array.from(
        new Set(
          data
            .map((generator) => generator.creator)
            .filter((address): address is string => Boolean(address))
        )
      )
      if (creatorAddresses.length > 0) {
        const profileMap = await fetchUserProfilesBatch(creatorAddresses)
        data = data.map((generator) => ({
          ...generator,
          creatorName: getDisplayName(profileMap.get(generator.creator) || null, generator.creator),
        }))
      }

      setGenerators(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch generators'))
    } finally {
      setIsLoading(false)
    }
  }, [options.bootloaderId, options.creator, options.excludeFlagged])

  useEffect(() => {
    fetchGenerators()
  }, [fetchGenerators])

  return { generators, isLoading, error, refetch: fetchGenerators }
}

interface UseGeneratorResult {
  generator: Generator | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useGenerator(generatorId: string | undefined, bootloaderId?: BootloaderId): UseGeneratorResult {
  const [generator, setGenerator] = useState<Generator | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchGenerator = useCallback(async () => {
    if (!generatorId) {
      setGenerator(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      let data: Generator | null = null

      // If bootloaderId is specified, use the appropriate service
      if (bootloaderId === 'generic-web') {
        data = await tzktService.getGenericWebGenerator(generatorId)
      } else if (bootloaderId === 'svg-js') {
        data = await tzktService.getGenerator(generatorId)
      } else {
        // Try svg-js first, then generic-web
        data = await tzktService.getGenerator(generatorId)
        if (!data) {
          data = await tzktService.getGenericWebGenerator(generatorId)
        }
      }

      if (data?.creator) {
        const profileMap = await fetchUserProfilesBatch([data.creator])
        data = {
          ...data,
          creatorName: getDisplayName(profileMap.get(data.creator) || null, data.creator),
        }
      }

      setGenerator(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch generator'))
    } finally {
      setIsLoading(false)
    }
  }, [generatorId, bootloaderId])

  useEffect(() => {
    fetchGenerator()
  }, [fetchGenerator])

  return { generator, isLoading, error, refetch: fetchGenerator }
}

/**
 * Hook to fetch generator metadata from D1 database
 * This includes descriptions that are stored off-chain for fast retrieval
 */
interface GeneratorMetadata {
  id: number
  network: string
  bootloader: string
  name: string | null
  artifactCid: string | null
  metadataCid: string | null
  generatorDescription: string | null
  tokenDescription: string | null
  creatorAddress: string | null
  thumbnailSeed: string | null
}

interface UseGeneratorMetadataResult {
  metadata: GeneratorMetadata | null
  isLoading: boolean
  error: Error | null
}

export function useGeneratorMetadata(
  generatorId: string | number | undefined,
  bootloaderId: BootloaderId | undefined
): UseGeneratorMetadataResult {
  const [metadata, setMetadata] = useState<GeneratorMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!generatorId || !bootloaderId) {
      setMetadata(null)
      setIsLoading(false)
      return
    }

    const fetchMetadata = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const base = CONFIG.sandboxWorkerUrl || CONFIG.mediaCdnUrl || ''
        const network = CONFIG.network
        const url = `${base}/${bootloaderId}/v1/generators/${generatorId}/metadata?network=${network}`

        const response = await fetch(url)
        if (!response.ok) {
          if (response.status === 404) {
            // Generator not found in DB yet - not an error
            setMetadata(null)
            return
          }
          throw new Error(`Failed to fetch metadata: ${response.status}`)
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.toLowerCase().includes('application/json')) {
          const bodyText = await response.text().catch(() => '')
          throw new Error(
            `Expected JSON metadata response but got "${contentType || 'unknown'}". ` +
            `Body starts with: ${bodyText.slice(0, 120)}`
          )
        }

        const data = await response.json() as GeneratorMetadata
        setMetadata(data)
      } catch (err) {
        console.warn('Failed to fetch generator metadata:', err)
        setError(err instanceof Error ? err : new Error('Failed to fetch metadata'))
        setMetadata(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetadata()
  }, [generatorId, bootloaderId])

  return { metadata, isLoading, error }
}
