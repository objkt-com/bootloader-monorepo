import { Wallet, LogOut, Copy, ExternalLink, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuCheckboxItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWallet } from '@/hooks/use-wallet'
import { useTokenCardSize } from '@/hooks/use-token-card-size'
import { Link } from 'react-router-dom'
import { fetchUserProfile } from '@/services/objkt'

export function WalletButton() {
  const { address, user, isConnecting, isConnected, connect, disconnect, network } = useWallet()
  const { isLarge, setSize } = useTokenCardSize()
  const [resolvedName, setResolvedName] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address) {
      setResolvedName(null)
      return
    }

    const userDisplayName = user?.displayName?.trim()
    if (userDisplayName) {
      setResolvedName(userDisplayName)
      return
    }

    let active = true
    void (async () => {
      try {
        const profile = await fetchUserProfile(address)
        if (!active) return
        const profileDisplayName = profile?.alias?.trim() || profile?.tzdomain?.trim() || null
        setResolvedName(profileDisplayName)
      } catch {
        if (active) {
          setResolvedName(null)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [address, isConnected, user?.displayName])

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
    }
  }

  if (!isConnected) {
    return (
      <Button
        variant="outline"
        className="min-w-0 px-2 sm:px-3"
        onClick={connect}
        disabled={isConnecting}
      >
        <Wallet className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{isConnecting ? 'Connecting...' : 'Connect'}</span>
        <span className="sr-only sm:hidden">Connect Wallet</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-9 px-0 sm:w-auto sm:max-w-[12rem] sm:px-3">
          <Wallet className="h-4 w-4 sm:hidden" />
          <span className="hidden truncate sm:inline">{resolvedName || 'My Wallet'}</span>
          <ChevronDown className="hidden h-3 w-3 sm:ml-2 sm:inline" />
          <span className="sr-only sm:hidden">Open wallet menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">Connected to {network}</p>
          {resolvedName && (
            <p className="text-sm font-medium truncate" title={resolvedName}>
              {resolvedName}
            </p>
          )}
          <p className="font-mono text-xs break-all">{address}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={`/profile/${address}`}>
            <Wallet className="mr-2 h-4 w-4" />
            My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyAddress}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://${network === 'mainnet' ? '' : 'ghostnet.'}tzkt.io/${address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View on TzKT
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={isLarge}
          onCheckedChange={(checked) => setSize(checked ? "large" : "small")}
        >
          Large Cards
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnect} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
