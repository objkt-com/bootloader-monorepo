import { useState, useEffect } from 'react';
import { tezosService } from '../services/tezos.js';

export default function WalletConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      await tezosService.initialize();
      setIsConnected(tezosService.isConnected);
      setUserAddress(tezosService.userAddress);
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await tezosService.connectWallet();
      if (result.success) {
        setIsConnected(true);
        setUserAddress(result.address);
      } else {
        console.error('Connection failed:', result.error);
      }
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const result = await tezosService.disconnectWallet();
      if (result.success) {
        setIsConnected(false);
        setUserAddress(null);
      }
    } catch (error) {
      console.error('Disconnection error:', error);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isConnected) {
    return (
      <div className="wallet-info">
        <span>{formatAddress(userAddress)}</span>
        <button onClick={handleDisconnect}>disconnect</button>
      </div>
    );
  }

  return (
    <button 
      onClick={handleConnect} 
      disabled={isConnecting}
    >
      {isConnecting ? 'connecting...' : 'connect wallet'}
    </button>
  );
}
