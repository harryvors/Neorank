
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, MapPin } from 'lucide-react';
import { COLORS, AMENITY_KEYS, AMENITY_CONFIG } from '../constants';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddLocationModal: React.FC<AddLocationModalProps> = ({ isOpen, onClose }) => {
  const [scores, setScores] = useState<Record<string, number>>({});

  const handleSliderChange = (key: string, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }));
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
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 shadow-2xl flex flex-col"
            style={{ backgroundColor: COLORS.bgCard }}
          >
             {/* Header */}
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <Plus size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Add Location</h2>
                  <p className="text-xs text-slate-400">Contribute a new spot to the map</p>
                </div>
              </div>
              <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                >
                  <X size={24} />
              </button>
            </div>

            {/* Form */}
            <div className="p-8 space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Cafe Name</label>
                        <input type="text" placeholder="e.g. Luna Coffee Lab" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">District / City</label>
                         <div className="relative">
                            <MapPin size={16} className="absolute left-3 top-3.5 text-slate-500" />
                            <input type="text" placeholder="e.g. Beşiktaş" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-10 text-white text-sm focus:border-emerald-500 outline-none transition-colors" />
                         </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Address</label>
                    <input type="text" placeholder="Full street address" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors" />
                </div>

                 {/* Amenities Scoring */}
                 <div className="space-y-4 pt-4 border-t border-slate-800">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Rate Amenities <span className="text-xs font-normal text-slate-500">(Slide to score 1-10)</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {AMENITY_KEYS.map(key => {
                            const config = AMENITY_CONFIG[key];
                            const Icon = config.icon;
                            const score = scores[key] || 5;

                            return (
                                <div key={key} className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                                    <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-300">{config.label}</span>
                                            <span className="text-xs font-mono text-emerald-400">{score}/10</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="10" 
                                            step="1"
                                            value={score}
                                            onChange={(e) => handleSliderChange(key, parseInt(e.target.value))}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                 </div>

                 <button 
                    onClick={onClose}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-emerald-500/20"
                 >
                    Submit Location (+50 Points)
                 </button>

            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
