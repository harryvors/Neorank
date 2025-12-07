
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, Target, Wallet } from 'lucide-react';
import { COLORS } from '../../constants';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { usePoints } from '../../contexts/PointsContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger?: number; // Trigger refresh when this changes
}

interface UserPoints {
  walletAddress: string;
  totalPoints: number;
  currentTier: string;
  reputationScore?: number;
  consistencyScore?: number;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, refreshTrigger }) => {
  const currentAccount = useCurrentAccount();
  const walletAddress = currentAccount?.address;
  const { balance, isLoading: pointsLoading, refreshPoints } = usePoints(); // Global points state
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refresh global points when modal opens or refreshTrigger changes
  useEffect(() => {
    if (isOpen && walletAddress) {
      refreshPoints();
      fetchUserPoints(); // Still fetch tier/reputation info from backend
    }
  }, [isOpen, walletAddress, refreshTrigger, refreshPoints]);

  // Also refresh when modal is already open and refreshTrigger changes
  // This ensures points update immediately when a review is posted
  useEffect(() => {
    if (isOpen && walletAddress && refreshTrigger > 0) {
      // Immediate refresh for optimistic update
      refreshPoints();
      // Then refresh again after a delay to ensure on-chain transaction is processed
      const timer = setTimeout(() => {
        refreshPoints();
        fetchUserPoints();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [refreshTrigger, refreshPoints, isOpen, walletAddress]);

  const fetchUserPoints = async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    try {
      // First, try to get points from on-chain (Sui blockchain)
      let onChainPoints = 0;
      try {
        const { getUserPoints } = await import('../../lib/sui-points');
        onChainPoints = await getUserPoints(walletAddress);
        console.log('[Profile] On-chain points:', onChainPoints);
      } catch (onChainError) {
        console.warn('[Profile] Failed to fetch on-chain points:', onChainError);
      }

      // Also fetch from backend for tier/reputation info
      let backendData = null;
      try {
        const response = await fetch(`/api/user/points?walletAddress=${walletAddress}`);
        if (response.ok) {
          backendData = await response.json();
        }
      } catch (backendError) {
        console.warn('[Profile] Failed to fetch backend points:', backendError);
      }

      // Use on-chain points as primary source, backend for other info
      setUserPoints({
        walletAddress,
        totalPoints: onChainPoints || backendData?.totalPoints || 0, // Prefer on-chain
        currentTier: backendData?.currentTier || 'Bronze',
        reputationScore: backendData?.reputationScore || 50.0,
        consistencyScore: backendData?.consistencyScore || 50.0,
      });
    } catch (error) {
      console.error('Error fetching user points:', error);
      setUserPoints({
        walletAddress,
        totalPoints: 0,
        currentTier: 'Bronze',
        reputationScore: 50.0,
        consistencyScore: 50.0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl rounded-2xl border border-slate-700 overflow-hidden shadow-2xl"
            style={{ backgroundColor: COLORS.bgCard }}
          >
            {/* Header / Banner */}
            <div className="relative h-40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors border border-white/5 z-10"
              >
                <X size={20} />
              </button>
              
              <div className="absolute -bottom-10 left-8 flex items-end gap-5 max-w-[calc(100%-200px)]">
                <div className="w-24 h-24 rounded-2xl border-4 border-slate-900 shadow-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Wallet size={32} className="text-cyan-400" />
                </div>
                <div className="mb-3 min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-white tracking-tight font-mono break-words leading-tight">
                    {walletAddress || 'No Wallet Connected'}
                  </h2>
                  {walletAddress && userPoints && (
                    <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-amber-400">
                        <Award size={14} />
                        <span className="font-bold text-xs">{userPoints.currentTier}</span>
                    </div>
                  </div>
                  )}
                </div>
              </div>

              {/* Points Display (Top Right) - Uses global points balance */}
              {walletAddress && (
                <div className="absolute top-4 right-8 text-right">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold opacity-80">Available Points</span>
                  <div className="text-3xl font-black text-white tracking-tighter drop-shadow-lg">
                    {pointsLoading ? (
                      <span className="text-slate-500">Loading...</span>
                    ) : (
                      <>
                        {balance.toLocaleString()} <span className="text-sm font-bold text-cyan-400">PTS</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-16 px-8 pb-8 space-y-8">
              
              {/* Main Dashboard - Full Width (Active Rewards Removed) */}
              {walletAddress && (
              <div className="space-y-4">
                  <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider flex items-center gap-2">
                    <Target size={14} /> Performance Stats
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800/50 transition-colors text-center md:text-left">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Points</span>
                        <span className="text-2xl font-bold text-white">{pointsLoading ? '...' : balance.toLocaleString()}</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800/50 transition-colors text-center md:text-left">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tier</span>
                        <span className="text-2xl font-bold text-emerald-400">{isLoading ? '...' : (userPoints?.currentTier || 'Bronze')}</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800/50 transition-colors text-center md:text-left">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Reputation</span>
                        <span className="text-2xl font-bold text-cyan-400">{isLoading ? '...' : (userPoints?.reputationScore?.toFixed(1) || '50.0')}</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800/50 transition-colors text-center md:text-left">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Consistency</span>
                        <span className="text-sm font-bold text-amber-400 truncate block mt-1">{isLoading ? '...' : (userPoints?.consistencyScore?.toFixed(1) || '50.0')}</span>
                    </div>
                  </div>
              </div>
              )}

              {!walletAddress && (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-sm">Connect a wallet to view your performance stats</p>
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
