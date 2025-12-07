
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Filter, MapPin, Coffee } from 'lucide-react';
import { AmenityKey, Cafe } from '../../types';
import { AMENITY_CONFIG, AMENITY_KEYS, COLORS } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { searchAddress, AddressSuggestion } from '../../lib/geocoding';
import { useDebounce } from '../../hooks/useDebounce';

interface SearchFilterProps {
  activeFilter: AmenityKey | null;
  onFilterChange: (key: AmenityKey | null) => void;
  onSearch: (query: string) => void;
  onAddressSelected?: (address: { fullAddress: string; lat: number; lng: number }) => void;
  cafes?: Cafe[]; // Cafes list for suggestions
  onCafeSelected?: (cafe: Cafe) => void; // Callback when cafe is selected
}

// Combined suggestion type
type SuggestionItem = 
  | { type: 'cafe'; data: Cafe }
  | { type: 'address'; data: AddressSuggestion };

export const SearchFilter: React.FC<SearchFilterProps> = ({ 
  activeFilter, 
  onFilterChange, 
  onSearch,
  onAddressSelected,
  cafes = [],
  onCafeSelected
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchTerm, 300);

  // Filter cafes based on search query
  const cafeSuggestions = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    
    const query = searchTerm.toLowerCase();
    return cafes.filter(cafe => 
      cafe.name.toLowerCase().includes(query) ||
      cafe.address.toLowerCase().includes(query)
    ).slice(0, 5); // Limit to 5 cafes
  }, [searchTerm, cafes]);

  // Combine all suggestions
  const allSuggestions = useMemo<SuggestionItem[]>(() => {
    const items: SuggestionItem[] = [];
    
    // Add cafes first
    cafeSuggestions.forEach(cafe => {
      items.push({ type: 'cafe', data: cafe });
    });
    
    // Add addresses
    addressSuggestions.forEach(addr => {
      items.push({ type: 'address', data: addr });
    });
    
    return items;
  }, [cafeSuggestions, addressSuggestions]);

  // Search addresses when query is long enough
  useEffect(() => {
    const query = debouncedQuery.trim();

    if (query.length < 3) {
      setAddressSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Detect if user is typing an address (heuristic)
    const addressKeywords = ['sok', 'cad', 'mah', 'no', 'daire', 'apt', 'blok', 'kat'];
    const hasAddressKeywords = addressKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
    const hasNumbers = /\d/.test(query);
    const isAddressQuery = hasAddressKeywords || hasNumbers;

    // Only search addresses if it looks like an address query
    if (isAddressQuery) {
      const performSearch = async () => {
        setIsLoading(true);
        setError(null);

        try {
          const results = await searchAddress(query, {
            limit: 5,
            countryCode: 'tr',
          });

          setAddressSuggestions(results);
        } catch (err: any) {
          setError(err.message || 'Adresler alınamadı, tekrar deneyin');
          setAddressSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      };

      performSearch();
    } else {
      setAddressSuggestions([]);
    }
  }, [debouncedQuery]);

  // Open/close dropdown based on suggestions
  useEffect(() => {
    setIsDropdownOpen(allSuggestions.length > 0 && searchTerm.length >= 2);
  }, [allSuggestions.length, searchTerm.length]);

  const handleToggleFilter = () => {
    if (!activeFilter) {
      onFilterChange(AMENITY_KEYS[0]); // Start with first
    } else {
      const currentIndex = AMENITY_KEYS.indexOf(activeFilter);
      if (currentIndex === AMENITY_KEYS.length - 1) {
        onFilterChange(null); // Reset
      } else {
        onFilterChange(AMENITY_KEYS[currentIndex + 1]); // Next
      }
    }
  };

  const handleSearchSubmit = () => {
    if (isDropdownOpen && selectedIndex >= 0 && allSuggestions[selectedIndex]) {
      // If suggestion is selected, use it
      const selected = allSuggestions[selectedIndex];
      if (selected.type === 'cafe' && onCafeSelected) {
        onCafeSelected(selected.data);
        setSearchTerm(selected.data.name);
      } else if (selected.type === 'address') {
        handleSelectAddress(selected.data);
      }
    } else {
      // Otherwise, perform regular search
      onSearch(searchTerm);
    }
  };

  const handleSelectAddress = (address: AddressSuggestion) => {
    setSearchTerm(address.fullAddress);
    setAddressSuggestions([]);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    
    if (onAddressSelected) {
      onAddressSelected({
        fullAddress: address.fullAddress,
        lat: address.lat,
        lng: address.lng,
      });
    }
    
    inputRef.current?.blur();
  };

  const handleSelectCafe = (cafe: Cafe) => {
    setSearchTerm(cafe.name);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    
    if (onCafeSelected) {
      onCafeSelected(cafe);
    }
    
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isDropdownOpen && allSuggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < allSuggestions.length - 1 ? prev + 1 : prev
          );
          return;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          return;

        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < allSuggestions.length) {
            const selected = allSuggestions[selectedIndex];
            if (selected.type === 'cafe') {
              handleSelectCafe(selected.data);
            } else {
              handleSelectAddress(selected.data);
            }
          } else {
            handleSearchSubmit();
          }
          return;

        case 'Escape':
          e.preventDefault();
          setIsDropdownOpen(false);
          setSelectedIndex(-1);
          return;
      }
    }

    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const CurrentIcon = activeFilter ? AMENITY_CONFIG[activeFilter].icon : Filter;
  const currentLabel = activeFilter ? AMENITY_CONFIG[activeFilter].label : 'All Locations';

  return (
    <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2 w-full max-w-sm relative">
      <div 
        className="flex items-center gap-0 rounded-xl shadow-2xl backdrop-blur-md border border-slate-700/50 overflow-hidden relative"
        style={{ backgroundColor: `${COLORS.bgCard}CC` }}
      >
        {/* Toggle Button */}
        <button 
          onClick={handleToggleFilter}
          className="h-12 w-14 flex items-center justify-center border-r border-slate-700/50 hover:bg-slate-800/50 transition-colors group relative"
          title="Cycle Filters"
        >
          <AnimatePresence mode="wait">
             <motion.div
                key={activeFilter || 'default'}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
             >
               <CurrentIcon 
                size={20} 
                className={activeFilter ? 'text-cyan-400' : 'text-slate-400'} 
               />
             </motion.div>
          </AnimatePresence>
          
          {/* Active Dot */}
          {activeFilter && (
            <span className="absolute top-3 right-3 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          )}
        </button>

        {/* Search Input */}
        <div className="flex-1 flex items-center px-4 gap-3 relative">
          <input 
            ref={inputRef}
            type="text" 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setError(null);
            }}
            onFocus={() => {
              if (allSuggestions.length > 0) {
                setIsDropdownOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              activeFilter 
                ? `Filtering by ${currentLabel}...` 
                : "Search cafes or addresses..."
            }
            className="bg-transparent border-none outline-none w-full text-sm placeholder-slate-500 h-12"
            style={{ color: COLORS.textPrimary, caretColor: '#22d3ee' }} 
          />
          {isLoading && (
            <div className="flex-shrink-0">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Search size={18} className="text-emerald-400" />
              </motion.div>
            </div>
          )}
          {!isLoading && (
            <button 
              onClick={handleSearchSubmit} 
              className="hover:text-cyan-400 transition-colors text-slate-500 flex-shrink-0"
            >
              <Search size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto top-full"
          style={{ backgroundColor: `${COLORS.bgCard}FF` }}
        >
          {isLoading && (
            <div className="p-4 text-center text-slate-400 text-sm">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="inline-block mr-2"
              >
                <Search size={14} className="text-emerald-400" />
              </motion.div>
              Searching...
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 text-center text-rose-400 text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && allSuggestions.length === 0 && searchTerm.length >= 2 && (
            <div className="p-4 text-center text-slate-500 text-sm">
              Sonuç bulunamadı
            </div>
          )}

          {!isLoading && !error && allSuggestions.length > 0 && (
            <div className="py-1">
              {/* Cafe Suggestions */}
              {cafeSuggestions.length > 0 && (
                <>
                  {cafeSuggestions.map((cafe, index) => {
                    const globalIndex = index;
                    return (
                      <button
                        key={`cafe-${cafe.id}`}
                        type="button"
                        onClick={() => handleSelectCafe(cafe)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 ${
                          globalIndex === selectedIndex
                            ? 'bg-cyan-500/20 border-l-2 border-cyan-500'
                            : 'hover:bg-slate-800 border-l-2 border-transparent'
                        }`}
                      >
                        <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                          <Coffee size={14} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white mb-0.5">
                            {cafe.name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {cafe.address}
                          </div>
                        </div>
                        <div className="text-xs text-amber-400 font-bold">
                          {cafe.rating}★
                        </div>
                      </button>
                    );
                  })}
                  {addressSuggestions.length > 0 && (
                    <div className="border-t border-slate-700 my-1"></div>
                  )}
                </>
              )}

              {/* Address Suggestions */}
              {addressSuggestions.length > 0 && (
                <>
                  {addressSuggestions.map((suggestion, index) => {
                    const globalIndex = cafeSuggestions.length + index;
                    return (
                      <button
                        key={`addr-${index}`}
                        type="button"
                        onClick={() => handleSelectAddress(suggestion)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 ${
                          globalIndex === selectedIndex
                            ? 'bg-emerald-500/20 border-l-2 border-emerald-500'
                            : 'hover:bg-slate-800 border-l-2 border-transparent'
                        }`}
                      >
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                          <MapPin size={14} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white mb-0.5">
                            {suggestion.fullAddress}
                          </div>
                          <div className="text-xs text-slate-400">
                            {[suggestion.district, suggestion.city]
                              .filter(Boolean)
                              .join(', ') || suggestion.displayName.split(',').slice(-2).join(', ')}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Helper Text */}
      <div className="pl-1 text-[10px] text-slate-500 font-mono tracking-wide uppercase">
        {activeFilter ? (
          <span className="text-cyan-400 flex items-center gap-1 shadow-cyan-500/20">
             ● Filter Active: {currentLabel}
          </span>
        ) : "Click icon to filter amenities"}
      </div>
    </div>
  );
};
