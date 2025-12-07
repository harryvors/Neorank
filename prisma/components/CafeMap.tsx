import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Cafe, AmenityKey } from '../../types';
import { COLORS } from '../../constants';

interface CafeMapProps {
  cafes: Cafe[];
  selectedCafeId: string | null;
  activeFilter: AmenityKey | null;
  onSelectCafe: (cafe: Cafe) => void;
  onBoundsChange?: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void;
  selectedAddress?: { fullAddress: string; lat: number; lng: number } | null;
}

// Component to handle map center updates smoothly
const MapController: React.FC<{ 
  selectedCafe: Cafe | undefined;
  selectedAddress: { fullAddress: string; lat: number; lng: number } | null | undefined;
}> = ({ selectedCafe, selectedAddress }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedAddress) {
      // Fly to selected address
      map.flyTo([selectedAddress.lat, selectedAddress.lng], 16, { duration: 1.5 });
    } else if (selectedCafe) {
      // Fly to selected cafe
      map.flyTo(selectedCafe.coordinates, 15, { duration: 1.5 });
    }
  }, [selectedCafe, selectedAddress, map]);
  return null;
};

// Component to handle bounding box changes
const BoundsController: React.FC<{ onBoundsChange?: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void }> = ({ onBoundsChange }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!onBoundsChange) return;

    const updateBounds = () => {
      const bounds = map.getBounds();
      onBoundsChange({
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      });
    };

    // Initial bounds
    updateBounds();

    // Update on move/zoom
    map.on('moveend', updateBounds);
    map.on('zoomend', updateBounds);

    // Also invalidate size on mount to ensure proper rendering
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.off('moveend', updateBounds);
      map.off('zoomend', updateBounds);
    };
  }, [map, onBoundsChange]);

  return null;
};

// Custom Icon Generator with SVG Pin
const createCustomIcon = (isSelected: boolean, isHighlighted: boolean, isDimmed: boolean, score: number) => {
  // Color Logic
  let fillClass = 'fill-slate-500'; // Default Slate Grey
  let strokeClass = 'stroke-[#020617]'; // Deep Navy Stroke
  let glowClass = '';
  let zIndex = 'z-10';
  
  if (isSelected) {
    fillClass = 'fill-white';
    zIndex = 'z-50';
  } else if (isHighlighted) {
    zIndex = 'z-40';
    if (score >= 8) {
      fillClass = 'fill-cyan-400'; // Cyan/Electric Blue
      glowClass = 'marker-glow-green'; // Uses the Cyan glow CSS
    } else if (score >= 4) {
      fillClass = 'fill-amber-400';
      glowClass = 'marker-glow-yellow';
    } else {
      fillClass = 'fill-rose-400';
      glowClass = 'marker-glow-red';
    }
  }

  const opacity = isDimmed ? 0.3 : 1;
  const size = isSelected ? 48 : (isHighlighted ? 42 : 32); // Icon size

  // SVG Map Pin Path
  const html = `
    <div class="relative flex items-center justify-center w-full h-full transition-all duration-500 ${zIndex}" style="opacity: ${opacity}">
      <svg 
        viewBox="0 0 24 24" 
        class="w-full h-full drop-shadow-lg ${glowClass} transition-all duration-300"
      >
        <path 
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
          class="${fillClass} ${strokeClass}" 
          stroke-width="1.5"
        />
        <circle cx="12" cy="9" r="2.5" class="fill-[#020617]" />
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'bg-transparent',
    html: html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size], // Anchor at bottom tip
  });
};

// Address marker icon (emerald/green color)
const createAddressIcon = () => {
  const size = 40;
  const html = `
    <div class="relative flex items-center justify-center w-full h-full">
      <svg 
        viewBox="0 0 24 24" 
        class="w-full h-full drop-shadow-lg"
        style="filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.8));"
      >
        <path 
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
          class="fill-emerald-500 stroke-[#020617]" 
          stroke-width="1.5"
        />
        <circle cx="12" cy="9" r="3" class="fill-white" />
        <circle cx="12" cy="9" r="1.5" class="fill-emerald-500" />
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'bg-transparent',
    html: html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size], // Anchor at bottom tip
  });
};

export const CafeMap: React.FC<CafeMapProps> = ({ 
  cafes, 
  selectedCafeId, 
  activeFilter, 
  onSelectCafe, 
  onBoundsChange,
  selectedAddress 
}) => {
  const selectedCafe = cafes.find(c => c.id === selectedCafeId);

  return (
    <MapContainer 
      center={[41.0422, 29.0081]} // Beşiktaş center
      zoom={14} 
      zoomControl={false}
      style={{ height: '100%', width: '100%', background: COLORS.bgMain }}
    >
      {/* Dark Matter Tiles - CSS filter in index.html tints this blue */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      {/* Zoom Control at Top Right */}
      <ZoomControl position="topright" />
      
      <MapController selectedCafe={selectedCafe} selectedAddress={selectedAddress} />
      <BoundsController onBoundsChange={onBoundsChange} />

      {/* Selected Address Marker */}
      {selectedAddress && (
        <Marker
          key="selected-address"
          position={[selectedAddress.lat, selectedAddress.lng]}
          icon={createAddressIcon()}
        />
      )}

      {/* Cafe Markers */}
      {cafes.map((cafe) => {
        const isSelected = selectedCafeId === cafe.id;
        
        // Filter Logic
        let isHighlighted = false;
        let isDimmed = false;
        let score = 0;

        if (activeFilter) {
            score = cafe.amenities[activeFilter];
            if (score >= 8) {
                isHighlighted = true; // High score in this category
            } else {
                isDimmed = true; // Fade out low scores
            }
        }

        return (
          <Marker
            key={cafe.id}
            position={cafe.coordinates}
            icon={createCustomIcon(isSelected, isHighlighted, isDimmed, score)}
            eventHandlers={{
              click: () => onSelectCafe(cafe),
            }}
          />
        );
      })}
    </MapContainer>
  );
};