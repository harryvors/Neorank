/**
 * Points Context
 * 
 * Global state management for user points balance.
 * Provides a single source of truth for points across Profile and Shop modals.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';

interface PointsState {
  balance: number;          // Anlık harcanabilir puan (on-chain veya backend'den)
  totalEarned: number;      // Toplam kazanılan puan (opsiyonel, şimdilik balance ile aynı)
  isLoading: boolean;        // Loading state
  error: string | null;      // Error state
  setBalance: (value: number) => void;
  addPoints: (delta: number) => void;
  resetPoints: () => void;
  refreshPoints: () => Promise<void>; // Manual refresh
}

const PointsContext = createContext<PointsState | undefined>(undefined);

interface PointsProviderProps {
  children: React.ReactNode;
}

export const PointsProvider: React.FC<PointsProviderProps> = ({ children }) => {
  const currentAccount = useCurrentAccount();
  const walletAddress = currentAccount?.address;
  
  const [balance, setBalance] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch points from on-chain (Sui) or backend
   * Priority: On-chain > Backend
   */
  const fetchPoints = useCallback(async (address: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // First, try to get points from on-chain (Sui blockchain)
      let onChainPoints = 0;
      try {
        const { getUserPoints } = await import('../lib/sui-points');
        onChainPoints = await getUserPoints(address);
        console.log('[PointsContext] On-chain points:', onChainPoints);
      } catch (onChainError) {
        console.warn('[PointsContext] Failed to fetch on-chain points:', onChainError);
      }

      // Also fetch from backend for tier/reputation info (if needed)
      let backendPoints = 0;
      try {
        const response = await fetch(`/api/user/points?walletAddress=${address}`);
        if (response.ok) {
          const data = await response.json();
          backendPoints = data.totalPoints || 0;
        }
      } catch (backendError) {
        console.warn('[PointsContext] Failed to fetch backend points:', backendError);
      }

      // Use on-chain points as primary source, backend as fallback
      const finalBalance = onChainPoints || backendPoints || 0;
      
      setBalance(finalBalance);
      setTotalEarned(finalBalance); // For now, totalEarned = balance
      
      console.log('[PointsContext] Points fetched:', {
        onChain: onChainPoints,
        backend: backendPoints,
        final: finalBalance,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch points';
      setError(errorMessage);
      console.error('[PointsContext] Error fetching points:', err);
      // Set to 0 on error
      setBalance(0);
      setTotalEarned(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh points manually
   */
  const refreshPoints = useCallback(async () => {
    if (!walletAddress) {
      setBalance(0);
      setTotalEarned(0);
      return;
    }
    await fetchPoints(walletAddress);
  }, [walletAddress, fetchPoints]);

  /**
   * Add points to balance (optimistic update)
   */
  const addPoints = useCallback((delta: number) => {
    setBalance(prev => {
      const newBalance = prev + delta;
      setTotalEarned(prevTotal => prevTotal + delta);
      console.log('[PointsContext] Added points (optimistic):', { delta, oldBalance: prev, newBalance });
      return newBalance;
    });
    
    // Also refresh from chain after a delay to ensure sync with on-chain data
    if (walletAddress) {
      // First refresh after 1 second (transaction might still be processing)
      setTimeout(() => {
        fetchPoints(walletAddress).catch(err => {
          console.warn('[PointsContext] Failed to refresh after adding points (1s):', err);
        });
      }, 1000);
      
      // Second refresh after 3 seconds (transaction should be confirmed)
      setTimeout(() => {
        fetchPoints(walletAddress).catch(err => {
          console.warn('[PointsContext] Failed to refresh after adding points (3s):', err);
        });
      }, 3000);
    }
  }, [walletAddress, fetchPoints]);

  /**
   * Set balance directly
   */
  const setBalanceValue = useCallback((value: number) => {
    setBalance(value);
    setTotalEarned(value);
    console.log('[PointsContext] Balance set to:', value);
  }, []);

  /**
   * Reset points (e.g., when wallet disconnects)
   */
  const resetPoints = useCallback(() => {
    setBalance(0);
    setTotalEarned(0);
    setError(null);
    console.log('[PointsContext] Points reset');
  }, []);

  /**
   * Fetch points when wallet connects or address changes
   */
  useEffect(() => {
    if (walletAddress) {
      console.log('[PointsContext] Wallet connected, fetching points for:', walletAddress);
      fetchPoints(walletAddress);
    } else {
      // Wallet disconnected, reset points
      resetPoints();
    }
  }, [walletAddress, fetchPoints, resetPoints]);

  const value: PointsState = {
    balance,
    totalEarned,
    isLoading,
    error,
    setBalance: setBalanceValue,
    addPoints,
    resetPoints,
    refreshPoints,
  };

  return (
    <PointsContext.Provider value={value}>
      {children}
    </PointsContext.Provider>
  );
};

/**
 * Hook to use points context
 * Must be used within PointsProvider
 */
export function usePoints(): PointsState {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error('usePoints must be used within a PointsProvider');
  }
  return context;
}

