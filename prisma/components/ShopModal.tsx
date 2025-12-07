
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag } from 'lucide-react';
import { COLORS, SHOP_ITEMS } from '../../constants';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { usePoints } from '../../contexts/PointsContext';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger?: number; // Trigger refresh when this changes
}

interface UserPoints {
  walletAddress: string;
  totalPoints: number;
  currentTier: string;
}

export const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose, refreshTrigger }) => {
  const currentAccount = useCurrentAccount();
  const walletAddress = currentAccount?.address;
  const { balance, isLoading: pointsLoading, refreshPoints } = usePoints(); // Global points state
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null);
  
  // Use global points balance for display and afford checks
  const displayPoints = balance; // Global points balance

  // Fetch user points when modal opens or refreshTrigger changes
  useEffect(() => {
    if (isOpen && walletAddress) {
      refreshPoints(); // Refresh global points
      fetchUserPoints(); // Still fetch tier info from backend
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
        console.log('[Shop] On-chain points:', onChainPoints);
      } catch (onChainError) {
        console.warn('[Shop] Failed to fetch on-chain points:', onChainError);
      }

      // Also fetch from backend for tier info
      let backendData = null;
      try {
        const response = await fetch(`/api/user/points?walletAddress=${walletAddress}`);
        if (response.ok) {
          backendData = await response.json();
        }
      } catch (backendError) {
        console.warn('[Shop] Failed to fetch backend points:', backendError);
      }

      // Use on-chain points as primary source
      setUserPoints({
        walletAddress,
        totalPoints: onChainPoints || backendData?.totalPoints || 0, // Prefer on-chain
        currentTier: backendData?.currentTier || 'Bronze',
      });
    } catch (error) {
      console.error('Error fetching user points:', error);
      setUserPoints({
        walletAddress,
        totalPoints: 0,
        currentTier: 'Bronze',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async (itemId: string, itemCost: number) => {
    if (!walletAddress) {
      alert('Lütfen önce cüzdanınızı bağlayın!');
      return;
    }

    if (!userPoints || userPoints.totalPoints < itemCost) {
      alert(`Yetersiz puan! ${itemCost} puan gerekiyor, sizde ${userPoints?.totalPoints || 0} puan var.`);
      return;
    }

    setIsRedeeming(itemId);
    try {
      const response = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          rewardId: itemId,
          useBlockchainPoints: true, // İndirim kodu kullanımında blockchain'deki puan bilgisi kullanılır
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Ödül başarıyla alındı! ${data.reward.name}\nKalan puan: ${data.remainingPoints}`);
        // Refresh global points state
        await refreshPoints();
        // Also refresh backend data for tier info
        await fetchUserPoints();
      } else {
        const error = await response.json();
        alert(`Ödül alınamadı: ${error.message || 'Bilinmeyen hata'}`);
      }
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      alert(`Ödül alınamadı: ${error.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsRedeeming(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 shadow-2xl flex flex-col"
            style={{ backgroundColor: COLORS.bgCard }}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/20 rounded-xl text-cyan-400">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Points Shop</h2>
                  <p className="text-xs text-slate-400">Redeem points for exclusive perks</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="px-4 py-2 bg-slate-950 rounded-lg border border-slate-800 text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Balance</span>
                    {pointsLoading ? (
                      <span className="text-lg font-black text-slate-500">Loading...</span>
                    ) : (
                      <span className="text-lg font-black text-cyan-400">{displayPoints} PTS</span>
                    )}
                 </div>
                 <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Grid Content */}
            <div className="p-8 overflow-y-auto">
              {!walletAddress ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 mb-4">Ödülleri görmek için cüzdanınızı bağlayın</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {SHOP_ITEMS.map((item) => {
                    // Use global balance for afford check
                    const canAfford = balance >= item.cost;
                    const isRedeemingThis = isRedeeming === item.id;
                    
                    return (
                      <div 
                        key={item.id} 
                        className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-cyan-500/50 transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col"
                      >
                        <div className="h-40 w-full overflow-hidden relative">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            />
                            <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase text-white tracking-wider">
                               {item.rarity}
                            </div>
                        </div>
                        
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold text-white mb-1">{item.name}</h3>
                          <p className="text-xs text-slate-400 leading-relaxed mb-4 flex-1">
                            {item.description}
                          </p>
                          
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800">
                             <span className="text-lg font-bold text-cyan-400">{item.cost} PTS</span>
                             <button 
                               onClick={() => handleRedeem(item.id, item.cost)}
                               disabled={!canAfford || isRedeemingThis}
                               className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border ${
                                 canAfford && !isRedeemingThis
                                   ? 'bg-slate-800 hover:bg-cyan-500 hover:text-slate-900 text-cyan-400 border-slate-700 hover:border-cyan-400 cursor-pointer'
                                   : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                               }`}
                             >
                                {isRedeemingThis ? 'Alınıyor...' : canAfford ? 'Redeem' : 'Yetersiz Puan'}
                             </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
