import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { searchAddress, AddressSuggestion, GeocodingError } from '../../lib/geocoding';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * Selected address data structure
 */
export interface SelectedAddress {
  fullAddress: string;
  city?: string;
  district?: string;
  lat?: number;
  lng?: number;
  raw?: any;
}

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelected: (address: SelectedAddress) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * AddressAutocompleteInput Component
 * 
 * A reusable address autocomplete input with dropdown suggestions.
 * Features:
 * - Debounced search (300ms)
 * - Minimum 3 characters to trigger search
 * - Keyboard navigation (Arrow keys, Enter, Esc)
 * - Loading and error states
 * - Dark theme compatible
 * 
 * TODO: Replace searchAddress with production geocoding service
 */
export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  value,
  onChange,
  onAddressSelected,
  disabled = false,
  placeholder = 'Full street address',
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(value, 300);

  /**
   * Search addresses when debounced query changes
   */
  useEffect(() => {
    const query = debouncedQuery.trim();

    // Don't search if query is too short
    if (query.length < 3) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Perform search
    const performSearch = async () => {
      setIsLoading(true);
      setError(null);
      setSelectedIndex(-1);

      try {
        // TODO: Replace with production geocoding service
        // For now, using OpenStreetMap Nominatim (free, no API key)
        // For production, consider: Google Places API, Mapbox, Here, etc.
        const results = await searchAddress(query, {
          limit: 5,
          countryCode: 'tr', // Turkey
          // Optional: Add viewbox for Istanbul area
          // viewbox: '28.5,40.8,29.2,41.2', // minLon,minLat,maxLon,maxLat
        });

        setSuggestions(results);
        setIsDropdownOpen(results.length > 0);
      } catch (err: any) {
        const geocodingError = err as GeocodingError;
        setError(geocodingError.message || 'Adresler alınamadı, tekrar deneyin');
        setSuggestions([]);
        setIsDropdownOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  /**
   * Handle address selection
   */
  const handleSelectAddress = useCallback((address: AddressSuggestion) => {
    const selected: SelectedAddress = {
      fullAddress: address.fullAddress,
      city: address.city,
      district: address.district,
      lat: address.lat,
      lng: address.lng,
      raw: address.raw,
    };

    onChange(address.fullAddress);
    onAddressSelected(selected);
    setSuggestions([]);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  }, [onChange, onAddressSelected]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectAddress(suggestions[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }, [isDropdownOpen, suggestions, selectedIndex, handleSelectAddress]);

  /**
   * Handle input focus
   */
  const handleFocus = () => {
    if (suggestions.length > 0) {
      setIsDropdownOpen(true);
    }
  };

  /**
   * Handle click outside to close dropdown
   */
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

  return (
    <div className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <MapPin 
          size={16} 
          className="absolute left-3 top-3.5 text-slate-500 pointer-events-none" 
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setError(null);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-10 pr-10 text-white text-sm focus:border-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute right-3 top-3.5">
            <Loader2 size={16} className="text-emerald-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="p-4 text-center text-slate-400 text-sm">
              <Loader2 size={16} className="inline-block animate-spin mr-2" />
              Searching...
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-4 text-center">
              <AlertCircle size={16} className="inline-block text-rose-400 mr-2" />
              <span className="text-rose-400 text-sm">{error}</span>
            </div>
          )}

          {/* No Results */}
          {!isLoading && !error && suggestions.length === 0 && debouncedQuery.length >= 3 && (
            <div className="p-4 text-center text-slate-500 text-sm">
              Bu aramaya uygun adres bulunamadı
            </div>
          )}

          {/* Suggestions List */}
          {!isLoading && !error && suggestions.length > 0 && (
            <div className="py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectAddress(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    index === selectedIndex
                      ? 'bg-emerald-500/20 border-l-2 border-emerald-500'
                      : 'hover:bg-slate-800 border-l-2 border-transparent'
                  }`}
                >
                  {/* Primary Line: Full Address */}
                  <div className="text-sm font-medium text-white mb-0.5">
                    {suggestion.fullAddress}
                  </div>
                  
                  {/* Secondary Line: District / City */}
                  <div className="text-xs text-slate-400">
                    {[suggestion.district, suggestion.city]
                      .filter(Boolean)
                      .join(', ') || suggestion.displayName.split(',').slice(-2).join(', ')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

