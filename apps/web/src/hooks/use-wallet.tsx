import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { BeaconWallet } from '@taquito/beacon-wallet'
import { TezosToolkit } from '@taquito/taquito'
import { BeaconEvent, NetworkType, SigningType } from '@airgap/beacon-dapp'
import { getNetworkConfig, getContractAddress, CONFIG } from '@/config'
import { clearAuthToken, getAuthToken, setAuthToken } from '@/services/auth-token'

interface User {
  id: string
  address: string
  publicKey: string | null
  roles: number
  createdAt: string
  lastLogin: string | null
  displayName: string | null
  avatarUrl: string | null
}

interface WalletContextType {
  address: string | null
  user: User | null
  authToken: string | null
  isConnecting: boolean
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  tezos: TezosToolkit | null
  contractAddress: string
  network: 'mainnet' | 'ghostnet'
}

const WalletContext = createContext<WalletContextType | null>(null)

let wallet: BeaconWallet | null = null

function getWallet(): BeaconWallet {
  if (!wallet) {
    wallet = new BeaconWallet({
      name: 'bootloader:',
      preferredNetwork: import.meta.env.VITE_NETWORK === 'mainnet'
        ? NetworkType.MAINNET
        : NetworkType.GHOSTNET,
    })
  }
  return wallet
}

// Get the API base URL for auth endpoints
function getApiBaseUrl(): string {
  return CONFIG.sandboxWorkerUrl || ''
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authToken, setAuthTokenState] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [tezos, setTezos] = useState<TezosToolkit | null>(null)
  const latestAddressRef = useRef<string | null>(null)
  const latestUserRef = useRef<User | null>(null)

  const network = (import.meta.env.VITE_NETWORK || 'ghostnet') as 'mainnet' | 'ghostnet'
  const networkConfig = getNetworkConfig()
  const contractAddress = getContractAddress()

  useEffect(() => {
    latestAddressRef.current = address
  }, [address])

  useEffect(() => {
    latestUserRef.current = user
  }, [user])

  // Initialize Tezos toolkit
  useEffect(() => {
    let cancelled = false

    const tk = new TezosToolkit(networkConfig.rpcUrl)
    const w = getWallet()
    tk.setWalletProvider(w)
    setTezos(tk)
    const existingToken = getAuthToken()
    setAuthTokenState(existingToken)

    // Check for existing connection and try to restore user session
    void w.client.getActiveAccount().then(async (activeAccount) => {
      if (!activeAccount || cancelled) return

      setAddress(activeAccount.address)
      const apiBase = getApiBaseUrl()
      const token = getAuthToken()
      if (!token) return

      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (cancelled) return

        if (res.ok) {
          const { user: existingUser } = await res.json()
          if (existingUser?.address === activeAccount.address) {
            setUser(existingUser)
            setAuthTokenState(token)
          } else {
            clearAuthToken()
            setAuthTokenState(null)
            setUser(null)
          }
          return
        }

        if (res.status === 401 || res.status === 403) {
          clearAuthToken()
          setAuthTokenState(null)
          setUser(null)
          return
        }

        console.warn(
          'Failed to restore user session (non-auth status), keeping auth token for retry:',
          res.status
        )
      } catch (error) {
        if (cancelled) return
        console.warn('Failed to restore user session, keeping auth token for retry:', error)
      }
    })

    // Subscribe to account changes
    w.client.subscribeToEvent(BeaconEvent.ACTIVE_ACCOUNT_SET, (data) => {
      // The data structure for this event is the account itself or undefined
      const account = data as { address?: string } | undefined
      const nextAddress = account?.address || null
      const previousAddress = latestAddressRef.current
      const currentUser = latestUserRef.current

      if (!nextAddress) {
        clearAuthToken()
        setAuthTokenState(null)
        setUser(null)
        setAddress(null)
        return
      }

      // Beacon can emit ACTIVE_ACCOUNT_SET on normal page init with the same account.
      // Do not clear auth in that case.
      if (previousAddress && previousAddress === nextAddress) {
        return
      }

      setAddress(nextAddress)

      if (currentUser && currentUser.address !== nextAddress) {
        clearAuthToken()
        setAuthTokenState(null)
        setUser(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [networkConfig.rpcUrl])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    try {
      const w = getWallet()
      // Network is already set via preferredNetwork in getWallet()
      await w.requestPermissions()
      const activeAccount = await w.client.getActiveAccount()
      if (!activeAccount) {
        throw new Error('No active account after connection')
      }

      const publicKey = activeAccount.publicKey
      const apiBase = getApiBaseUrl()

      // Step 1: Get a challenge from the server
      const challengeRes = await fetch(`${apiBase}/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey }),
      })

      if (!challengeRes.ok) {
        throw new Error('Failed to get auth challenge')
      }

      const { payload } = await challengeRes.json()

      // Step 2: Sign the challenge payload with the wallet
      // Convert payload to hex and prepend Micheline string expression marker (05 + 01 + length + string)
      // This creates a proper Micheline-encoded string that Taquito can verify
      const payloadBytes = new TextEncoder().encode(payload)
      const len = payloadBytes.length
      // Micheline string format: 01 (string tag) + 4 bytes big-endian length + string bytes
      const michelineBytes = new Uint8Array(1 + 4 + len)
      michelineBytes[0] = 0x01 // string tag
      michelineBytes[1] = (len >> 24) & 0xff
      michelineBytes[2] = (len >> 16) & 0xff
      michelineBytes[3] = (len >> 8) & 0xff
      michelineBytes[4] = len & 0xff
      michelineBytes.set(payloadBytes, 5)

      // Prepend 05 (expression marker) for the full Micheline payload
      const fullPayload = new Uint8Array(1 + michelineBytes.length)
      fullPayload[0] = 0x05
      fullPayload.set(michelineBytes, 1)

      const hexPayload = Array.from(fullPayload, b => b.toString(16).padStart(2, '0')).join('')

      const signResult = await w.client.requestSignPayload({
        signingType: SigningType.MICHELINE,
        payload: hexPayload,
      })

      // Step 3: Verify the signature with the server
      const verifyRes = await fetch(`${apiBase}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey, signature: signResult.signature }),
      })

      if (!verifyRes.ok) {
        const error = await verifyRes.json()
        throw new Error(error.error || 'Signature verification failed')
      }

      const { user: authenticatedUser, token } = await verifyRes.json()
      if (authenticatedUser?.address !== activeAccount.address) {
        throw new Error('Authenticated user does not match active wallet address')
      }

      // Success - user has proven wallet ownership
      setAddress(activeAccount.address)
      setUser(authenticatedUser)
      if (typeof token === 'string' && token.length > 0) {
        setAuthToken(token)
        setAuthTokenState(token)
      } else {
        throw new Error('Missing auth token in verify response')
      }
    } catch (error) {
      console.error('Wallet connection failed:', error)
      // Clear any partial state on failure
      const w = getWallet()
      await w.clearActiveAccount().catch(() => {})
      clearAuthToken()
      setAuthTokenState(null)
      setAddress(null)
      setUser(null)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      const w = getWallet()
      await w.clearActiveAccount()
      clearAuthToken()
      setAuthTokenState(null)
      setAddress(null)
      setUser(null)
    } catch (error) {
      console.error('Wallet disconnect failed:', error)
    }
  }, [])

  return (
    <WalletContext.Provider
      value={{
        address,
        user,
        authToken,
        isConnecting,
        isConnected: !!address && !!user,
        connect,
        disconnect,
        tezos,
        contractAddress,
        network,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
