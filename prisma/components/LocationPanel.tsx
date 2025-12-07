import React, { useState } from 'react';
import { MapPin, Star, ArrowRight, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { COLORS, LOCATION_INFO, INITIAL_CAFES } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationPanelProps {
  sources?: { title: string, uri: string }[];
}

export const LocationPanel: React.FC<LocationPanelProps> = ({ sources = [] }) => {
  const [isOpen, setIsOpen] = useState(true);

  // Sort cafes by rating for "Top Rated" list (Using Mock Data for stability in list)
  const topCafes = [...INITIAL_CAFES].sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <div className="absolute top-28 left-6 z-[900] hidden md:flex items-start gap-2">
      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="mt-2 p-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-cyan-500/50 transition-colors shadow-lg"
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <AnimatePresence>
        {isOpen && (
            <motion.div 
            initial={{ x: -20, opacity: 0, width: 0 }}
            animate={{ x: 0, opacity: 1, width: 'auto' }}
            exit={{ x: -20, opacity: 0, width: 0 }}
            className="flex flex-col gap-4 w-80 overflow-hidden"
            >
            {/* Main Info Card */}
            <div 
                className="p-5 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-2xl"
                style={{ backgroundColor: `${COLORS.bgCard}D9` }} // Higher transparency
            >
                <div className="flex items-center gap-2 mb-3">
                <MapPin size={16} className="text-cyan-400" />
                <h1 className="text-2xl font-bold tracking-tight text-white uppercase">{LOCATION_INFO.title}</h1>
                </div>
                
                <p className="text-xs leading-5 text-slate-400 mb-5 border-l-2 border-cyan-500/20 pl-3">
                {LOCATION_INFO.description}
                </p>

                {/* Must Visit Section */}
                <div className="space-y-3">
                <h2 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Must Visit</h2>
                <div className="grid grid-cols-2 gap-2">
                    {LOCATION_INFO.mustVisit.map((place, idx) => {
                    const Icon = place.icon;
                    return (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded bg-slate-950/30 border border-slate-700/30 hover:bg-slate-800/50 transition-colors cursor-pointer group">
                        <Icon size={12} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                        <span className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">{place.name}</span>
                        </div>
                    );
                    })}
                </div>
                </div>
            </div>

            {/* Top Rated List */}
            <div 
                className="p-5 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-2xl"
                style={{ backgroundColor: `${COLORS.bgCard}D9` }}
            >
                <h2 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-3">Top Rated This Week</h2>
                <div className="space-y-3">
                {topCafes.map((cafe, index) => (
                    <div key={cafe.id} className="flex items-center justify-between group cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-slate-700 group-hover:text-cyan-400 transition-colors">0{index + 1}</span>
                        <div>
                        <h3 className="text-sm font-medium text-slate-200 group-hover:text-cyan-200 transition-colors">{cafe.name}</h3>
                        <div className="flex items-center gap-1">
                            <Star size={10} className="fill-amber-500 text-amber-500" />
                            <span className="text-[10px] text-slate-500">{cafe.rating}</span>
                        </div>
                        </div>
                    </div>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </div>
                ))}
                </div>
            </div>

             {/* Grounding Sources (If Available) */}
             {sources.length > 0 && (
                <div className="p-3 rounded-xl backdrop-blur-md border border-slate-700/50 bg-slate-950/80">
                  <h2 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1">
                    <ExternalLink size={10} /> Data Sources
                  </h2>
                  <div className="flex flex-col gap-1">
                    {sources.map((source, idx) => (
                      <a 
                        key={idx} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 truncate hover:underline"
                      >
                        {source.title || source.uri}
                      </a>
                    ))}
                  </div>
                </div>
             )}

            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};