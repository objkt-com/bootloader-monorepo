import { useState, useEffect, useCallback } from 'react'
import {
  fetchUserProfile,
  fetchOwnedTokens,
  fetchOwnedTokensCount,
  getDisplayName,
  UserProfile,
  OwnedToken,
} from '@/services/objkt'
import { tzktService } from '@/services/tzkt'
import type { Generator } from '@/types/generator'

interface UseProfileResult {
  profile: UserProfile | null
  generators: Generator[]
  ownedTokens: OwnedToken[]
  ownedTokensCount: number
  isLoading: boolean
  isLoadingTokens: boolean
  hasMoreTokens: boolean
  error: Error | null
  loadMoreTokens: () => Promise<void>
  refetch: () => Promise<void>
}

const TOKENS_PER_PAGE = 24

export function useProfile(address: string | undefined): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [generators, setGenerators] = useState<Generator[]>([])
  const [ownedTokens, setOwnedTokens] = useState<OwnedToken[]>([])
  const [ownedTokensCount, setOwnedTokensCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)
  const [hasMoreTokens, setHasMoreTokens] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tokensPage, setTokensPage] = useState(0)

  const loadProfile = useCallback(async () => {
    if (!address) return

    try {
      setIsLoading(true)
      setError(null)

      // Load profile, generators, and token count in parallel
      // Use getAllGenerators to fetch from all bootloader contracts
      const [profileData, allGenerators, tokenCount] = await Promise.all([
        fetchUserProfile(address),
        tzktService.getAllGenerators(),
        fetchOwnedTokensCount(address),
      ])

      setProfile(profileData)
      setOwnedTokensCount(tokenCount)

      // Filter generators created by this user
      const userDisplayName = getDisplayName(profileData, address)
      const userGenerators = allGenerators
        .filter((gen) => gen.creator === address)
        .map((gen) => ({
          ...gen,
          creatorName: userDisplayName,
        }))
      setGenerators(userGenerators)

      // Load first page of owned tokens
      const tokens = await fetchOwnedTokens(address, TOKENS_PER_PAGE, 0)
      setOwnedTokens(tokens)
      setTokensPage(0)
      setHasMoreTokens(tokens.length === TOKENS_PER_PAGE)
    } catch (err) {
      console.error('Failed to load profile:', err)
      setError(err instanceof Error ? err : new Error('Failed to load profile'))
    } finally {
      setIsLoading(false)
    }
  }, [address])

  const loadMoreTokens = useCallback(async () => {
    if (!address || !hasMoreTokens || isLoadingTokens) return

    try {
      setIsLoadingTokens(true)
      const nextPage = tokensPage + 1
      const offset = nextPage * TOKENS_PER_PAGE

      const tokens = await fetchOwnedTokens(address, TOKENS_PER_PAGE, offset)
      setOwnedTokens((prev) => [...prev, ...tokens])
      setTokensPage(nextPage)
      setHasMoreTokens(tokens.length === TOKENS_PER_PAGE)
    } catch (err) {
      console.error('Failed to load more tokens:', err)
    } finally {
      setIsLoadingTokens(false)
    }
  }, [address, hasMoreTokens, isLoadingTokens, tokensPage])

  useEffect(() => {
    if (address) {
      loadProfile()
    }
  }, [address, loadProfile])

  return {
    profile,
    generators,
    ownedTokens,
    ownedTokensCount,
    isLoading,
    isLoadingTokens,
    hasMoreTokens,
    error,
    loadMoreTokens,
    refetch: loadProfile,
  }
}
