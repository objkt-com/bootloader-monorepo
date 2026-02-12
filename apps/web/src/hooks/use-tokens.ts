import { useState, useEffect, useCallback } from 'react'
import { tzktService } from '@/services/tzkt'
import { fetchUserProfilesBatch, getDisplayName, type UserProfile } from '@/services/objkt'
import type { Token, Generator } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'
import { CONFIG } from '@/config'

interface UseGeneratorTokensResult {
  tokens: Token[]
  total: number | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export interface GeneratorTokenFilter {
  name: string
  value: string
}

export interface GeneratorFeatureValueOption {
  value: string
  count: number
}

export interface GeneratorFeatureOption {
  name: string
  values: GeneratorFeatureValueOption[]
}

interface IndexedTokenSearchResponse {
  tokens?: Array<{
    id: number
    generatorId: number
    bootloader: 'svg-js' | 'generic-web'
    version?: number | null
    seed: string | null
    iteration: number | null
    ownerAddress: string | null
    mintedAt: string | null
  }>
  total?: number
}

interface GeneratorAttributesResponse {
  attributes?: string[]
}

interface GeneratorAttributeValuesResponse {
  values?: Array<{ value: string; count: number }>
}

export function useGeneratorTokens(
  generatorId: string | undefined,
  bootloaderId: BootloaderId | undefined,
  limit = 12,
  generator?: Generator | null,
  filters: GeneratorTokenFilter[] = []
): UseGeneratorTokensResult {
  const [tokens, setTokens] = useState<Token[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchTokens = useCallback(async () => {
    if (!generatorId || !bootloaderId) {
      setTokens([])
      setTotal(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      if (bootloaderId === 'generic-web') {
        const base = CONFIG.sandboxWorkerUrl || CONFIG.mediaCdnUrl || ''
        const network = CONFIG.network
        const url = `${base}/${bootloaderId}/v1/generators/${generatorId}/tokens/search?network=${network}&limit=${limit}&offset=0`
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ filters }),
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(`Failed to fetch indexed tokens (${response.status}): ${body.slice(0, 200)}`)
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.toLowerCase().includes('application/json')) {
          const bodyText = await response.text().catch(() => '')
          throw new Error(
            `Expected JSON token search response but got "${contentType || 'unknown'}". Body starts with: ${bodyText.slice(0, 120)}`
          )
        }

        const data = (await response.json()) as IndexedTokenSearchResponse
        const mappedTokens: Token[] = (data.tokens || []).map((token) => ({
          id: String(token.id),
          generatorId: String(token.generatorId ?? generatorId),
          bootloaderId: 'generic-web',
          owner: token.ownerAddress || '',
          seed: token.seed || '',
          iteration: token.iteration ?? token.id,
          version:
            typeof token.version === 'number' && Number.isFinite(token.version) && token.version > 0
              ? Math.trunc(token.version)
              : undefined,
          mintedAt: token.mintedAt || undefined,
          generator: generator || undefined,
        }))

        const ownerAddresses = Array.from(
          new Set(
            mappedTokens
              .map((token) => token.owner)
              .filter((owner): owner is string => Boolean(owner))
          )
        )
        const ownerProfiles: Map<string, UserProfile | null> =
          ownerAddresses.length > 0
            ? await fetchUserProfilesBatch(ownerAddresses)
            : new Map()
        const tokensWithOwnerNames = mappedTokens.map((token) => ({
          ...token,
          ownerName: token.owner
            ? getDisplayName(ownerProfiles.get(token.owner) || null, token.owner)
            : undefined,
        }))

        setTokens(tokensWithOwnerNames)
        setTotal(Number.isFinite(Number(data.total)) ? Number(data.total) : tokensWithOwnerNames.length)
      } else {
        const data = await tzktService.getGeneratorMints(generatorId, bootloaderId, limit, generator || undefined)
        const ownerAddresses = Array.from(
          new Set(
            data
              .map((token) => token.owner)
              .filter((owner): owner is string => Boolean(owner))
          )
        )
        const ownerProfiles: Map<string, UserProfile | null> =
          ownerAddresses.length > 0
            ? await fetchUserProfilesBatch(ownerAddresses)
            : new Map()
        const tokensWithOwnerNames = data.map((token) => ({
          ...token,
          ownerName: token.owner
            ? getDisplayName(ownerProfiles.get(token.owner) || null, token.owner)
            : undefined,
        }))
        setTokens(tokensWithOwnerNames)
        setTotal(tokensWithOwnerNames.length)
      }
    } catch (err) {
      setTokens([])
      setTotal(null)
      setError(err instanceof Error ? err : new Error('Failed to fetch tokens'))
    } finally {
      setIsLoading(false)
    }
  }, [generatorId, bootloaderId, limit, generator, filters])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  return { tokens, total, isLoading, error, refetch: fetchTokens }
}

interface UseGeneratorFeatureOptionsResult {
  options: GeneratorFeatureOption[]
  hasFeatures: boolean
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useGeneratorFeatureOptions(
  generatorId: string | undefined,
  bootloaderId: BootloaderId | undefined
): UseGeneratorFeatureOptionsResult {
  const [options, setOptions] = useState<GeneratorFeatureOption[]>([])
  const [hasFeatures, setHasFeatures] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchOptions = useCallback(async () => {
    if (!generatorId || bootloaderId !== 'generic-web') {
      setOptions([])
      setHasFeatures(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const base = CONFIG.sandboxWorkerUrl || CONFIG.mediaCdnUrl || ''
      const network = CONFIG.network
      const namesResponse = await fetch(
        `${base}/${bootloaderId}/v1/generators/${generatorId}/attributes?network=${network}`
      )

      if (!namesResponse.ok) {
        if (namesResponse.status === 404) {
          setOptions([])
          setHasFeatures(false)
          return
        }
        const body = await namesResponse.text().catch(() => '')
        throw new Error(`Failed to fetch attribute names (${namesResponse.status}): ${body.slice(0, 200)}`)
      }

      const namesPayload = (await namesResponse.json()) as GeneratorAttributesResponse
      const names = Array.isArray(namesPayload.attributes) ? namesPayload.attributes : []

      if (names.length === 0) {
        setOptions([])
        setHasFeatures(false)
        return
      }

      const optionsPayload = await Promise.all(
        names.map(async (name): Promise<GeneratorFeatureOption | null> => {
          const valuesResponse = await fetch(
            `${base}/${bootloaderId}/v1/generators/${generatorId}/attributes/${encodeURIComponent(name)}/values?network=${network}`
          )

          if (!valuesResponse.ok) {
            return null
          }

          const valuesPayload = (await valuesResponse.json()) as GeneratorAttributeValuesResponse
          const values = (valuesPayload.values || []).map((entry) => ({
            value:
              entry.value === null || entry.value === undefined
                ? ''
                : typeof entry.value === 'string'
                  ? entry.value
                  : String(entry.value),
            count: Number(entry.count) || 0,
          }))

          return {
            name,
            values,
          }
        })
      )

      const hydratedOptions = optionsPayload
        .filter((option): option is GeneratorFeatureOption => Boolean(option))
        .filter((option) => option.values.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name))

      setOptions(hydratedOptions)
      setHasFeatures(hydratedOptions.length > 0)
    } catch (err) {
      setOptions([])
      setHasFeatures(false)
      setError(err instanceof Error ? err : new Error('Failed to fetch feature options'))
    } finally {
      setIsLoading(false)
    }
  }, [generatorId, bootloaderId])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  return {
    options,
    hasFeatures,
    isLoading,
    error,
    refetch: fetchOptions,
  }
}

interface UseTokenResult {
  token: Token | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useToken(tokenId: string | undefined, bootloaderId?: BootloaderId): UseTokenResult {
  const [token, setToken] = useState<Token | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchToken = useCallback(async () => {
    if (!tokenId) {
      setToken(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const data = await tzktService.getToken(tokenId, bootloaderId)
      if (!data) {
        setToken(null)
        return
      }

      const addresses = Array.from(
        new Set(
          [
            data.owner,
            data.generator?.creator,
          ].filter((address): address is string => Boolean(address))
        )
      )
      const profileMap: Map<string, UserProfile | null> =
        addresses.length > 0 ? await fetchUserProfilesBatch(addresses) : new Map()

      const tokenWithNames: Token = {
        ...data,
        ownerName: data.owner
          ? getDisplayName(profileMap.get(data.owner) || null, data.owner)
          : data.ownerName,
        generator: data.generator
          ? {
              ...data.generator,
              creatorName: data.generator.creator
                ? getDisplayName(
                    profileMap.get(data.generator.creator) || null,
                    data.generator.creator
                  )
                : data.generator.creatorName,
            }
          : data.generator,
      }

      setToken(tokenWithNames)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch token'))
    } finally {
      setIsLoading(false)
    }
  }, [tokenId, bootloaderId])

  useEffect(() => {
    fetchToken()
  }, [fetchToken])

  return { token, isLoading, error, refetch: fetchToken }
}

/**
 * Hook to fetch token features/attributes from the D1 database API
 */
interface TokenAttribute {
  name: string
  value: string
  type: string
  numericValue: number | null
}

interface UseTokenFeaturesResult {
  features: Record<string, string> | null
  isLoading: boolean
  error: Error | null
}

const FEATURE_FETCH_MAX_ATTEMPTS = 6
const FEATURE_FETCH_RETRY_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useTokenFeatures(
  tokenId: string | undefined,
  bootloaderId: BootloaderId | undefined
): UseTokenFeaturesResult {
  const [features, setFeatures] = useState<Record<string, string> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!tokenId || !bootloaderId) {
      setFeatures(null)
      setIsLoading(false)
      return
    }

    // Only generic-web tokens have features for now
    if (bootloaderId !== 'generic-web') {
      setFeatures(null)
      setIsLoading(false)
      return
    }

    const base = CONFIG.sandboxWorkerUrl || CONFIG.mediaCdnUrl || ''
    const primaryNetwork = CONFIG.network

    const fetchAttributes = async (
      network: 'mainnet' | 'ghostnet'
    ): Promise<TokenAttribute[] | null> => {
      const url = `${base}/${bootloaderId}/v1/tokens/${tokenId}/attributes?network=${network}`
      const response = await fetch(url)
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Failed to fetch attributes (${network}): ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.toLowerCase().includes('application/json')) {
        const bodyText = await response.text().catch(() => '')
        throw new Error(
          `Expected JSON attributes response but got "${contentType || 'unknown'}" (${network}). ` +
          `Body starts with: ${bodyText.slice(0, 120)}`
        )
      }

      const data = (await response.json()) as { attributes?: TokenAttribute[] }
      return data.attributes && data.attributes.length > 0 ? data.attributes : null
    }

    const toFeaturesObject = (attributes: TokenAttribute[]): Record<string, string> => {
      const featuresObj: Record<string, string> = {}
      for (const attr of attributes) {
        const rawValue =
          attr.value === null || attr.value === undefined
            ? ''
            : typeof attr.value === 'string'
              ? attr.value
              : String(attr.value)
        const decoded = rawValue
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
        featuresObj[attr.name] = decoded
      }
      return featuresObj
    }

    const fetchFeaturesWithRetry = async () => {
      setIsLoading(true)
      setError(null)
      try {
        for (let attempt = 1; attempt <= FEATURE_FETCH_MAX_ATTEMPTS; attempt += 1) {
          if (cancelled) return

          let attributes = await fetchAttributes(primaryNetwork)
          // Temporary compatibility path:
          // some older feature writes may have been indexed under mainnet when `n` was missing.
          if (!attributes && primaryNetwork === 'ghostnet') {
            attributes = await fetchAttributes('mainnet')
          }

          if (attributes && attributes.length > 0) {
            if (!cancelled) {
              setFeatures(toFeaturesObject(attributes))
            }
            return
          }

          if (attempt < FEATURE_FETCH_MAX_ATTEMPTS) {
            await sleep(FEATURE_FETCH_RETRY_DELAY_MS)
          }
        }

        if (!cancelled) {
          setFeatures(null)
        }
      } catch (err) {
        console.warn('Failed to fetch token features:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch features'))
          setFeatures(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchFeaturesWithRetry()
    return () => {
      cancelled = true
    }
  }, [tokenId, bootloaderId])

  return { features, isLoading, error }
}
