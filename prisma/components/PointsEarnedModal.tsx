
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, Sparkles } from 'lucide-react';
import { COLORS } from '../../constants';

interface PointsEarnedModalProps {
  isOpen: boolean;
  onClose: () => void;
  pointsEarned: number;
  totalPoints: number;
  onPointsUpdated?: () => void; // Callback when points are updated
}

export const PointsEarnedModal: React.FC<PointsEarnedModalProps> = ({ 
  isOpen, 
  onClose, 
  pointsEarned,
  totalPoints,
  onPointsUpdated
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="relative w-full max-w-md rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl"
            style={{ 
              backgroundColor: COLORS.bgCard,
              boxShadow: '0 0 40px rgba(6, 182, 212, 0.3)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-10"
            >
              <X size={20} />
            </button>

            {/* Content */}
            <div className="p-8 text-center">
              {/* Animated Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 200, 
                  damping: 15,
                  delay: 0.1
                }}
                className="mb-6 flex justify-center"
              >
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border-4 border-cyan-500/50">
                    <Award size={48} className="text-cyan-400" />
                  </div>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 rounded-full bg-cyan-500/20"
                  />
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-black text-white mb-2"
              >
                🎉 Tebrikler!
              </motion.h2>

              {/* Points Earned */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-6"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles size={24} className="text-cyan-400" />
                  <span className="text-lg text-slate-400">Kazandığınız Puan</span>
                </div>
                <div className="text-5xl font-black text-cyan-400 mb-1">
                  +{pointsEarned}
                </div>
                <div className="text-sm text-slate-500 uppercase tracking-wider">
                  PTS
                </div>
              </motion.div>

              {/* Total Points */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 mb-6"
              >
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Toplam Puanınız
                </div>
                <div className="text-2xl font-bold text-white">
                  {totalPoints.toLocaleString()} <span className="text-cyan-400 text-lg">PTS</span>
                </div>
              </motion.div>

              {/* Message */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-slate-400 mb-6"
              >
                Değerlendirmeniz başarıyla kaydedildi ve blockchain'e yazıldı!
              </motion.p>

              {/* Close Button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                onClick={() => {
                  // Trigger points refresh in parent components
                  if (onPointsUpdated) {
                    onPointsUpdated();
                  }
                  onClose();
                }}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/20"
              >
                Harika!
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

