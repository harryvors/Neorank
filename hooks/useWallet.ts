import { useState, useEffect } from 'react';

interface Wallet {
  name: string;
  icon: string;
  accounts: readonly { address: string }[];
  features: {
    [key: string]: {
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      signAndExecuteTransactionBlock: (params: any) => Promise<any>;
    };
  };
}

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if Walrus wallet is installed
  useEffect(() => {
    const checkWallet = () => {
      if (typeof window !== 'undefined' && (window as any).wallet) {
        const walrusWallet = (window as any).wallet;
        setWallet(walrusWallet);
        
        // Check if already connected
        if (walrusWallet.accounts && walrusWallet.accounts.length > 0) {
          setAddress(walrusWallet.accounts[0].address);
          setIsConnected(true);
        }
      }
    };

    checkWallet();
    
    // Listen for wallet events
    const handleWalletChange = () => {
      checkWallet();
    };

    window.addEventListener('wallet#initialized', handleWalletChange);
    window.addEventListener('wallet#accountsChanged', handleWalletChange);

    return () => {
      window.removeEventListener('wallet#initialized', handleWalletChange);
      window.removeEventListener('wallet#accountsChanged', handleWalletChange);
    };
  }, []);

  const connect = async () => {
    if (!wallet) {
      alert('Walrus wallet not found. Please install Walrus wallet extension.');
      return;
    }

    setIsConnecting(true);
    try {
      // Connect to wallet
      await wallet.features['standard:connect'].connect();
      
      if (wallet.accounts && wallet.accounts.length > 0) {
        setAddress(wallet.accounts[0].address);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!wallet) return;

    try {
      await wallet.features['standard:disconnect'].disconnect();
      setAddress(null);
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  return {
    wallet,
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
  };
}

