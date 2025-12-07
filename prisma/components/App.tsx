
import React, { useState, useEffect } from 'react';
import { CafeMap } from './CafeMap';
import { Sidebar } from './Sidebar';
import { SearchFilter } from './SearchFilter';
import { UserProfileModal } from './UserProfileModal';
import { ShopModal } from './ShopModal';
import { AddLocationModal } from './AddLocationModal';
import { INITIAL_CAFES, COLORS } from '../../constants';
import { Cafe, AmenityKey } from '../../types';
import { Wallet, User, ShoppingBag, Plus } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useCurrentAccount, useDisconnectWallet, ConnectButton } from "@mysten/dapp-kit";
import { PlaceIndex } from '../../types';
import { searchCafesInIstanbul, getCafePhotoUrl, CafeFromPlaces } from '../../lib/google-places';
import { getCafeImageUrl } from '../../lib/cafe-images';

export default function App() {
  const [cafes, setCafes] = useState<Cafe[]>(INITIAL_CAFES);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AmenityKey | null>(null);
  const [groundingSources, setGroundingSources] = useState<{title: string, uri: string}[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<{ fullAddress: string; lat: number; lng: number } | null>(null);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const [pointsRefreshTrigger, setPointsRefreshTrigger] = useState(0); // Trigger to refresh points in modals
  
  // Callback to refresh points in modals after review is posted
  const handleReviewPosted = () => {
    // Increment refresh trigger to force re-fetch in Profile and Shop modals
    setPointsRefreshTrigger(prev => prev + 1);
  };
  
  // Wallet integration with dapp-kit
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const walletAddress = currentAccount?.address || null;
  const isWalletConnected = !!currentAccount;

  // Fetch Real Data using Gemini API with Google Maps Tool
  useEffect(() => {
    const fetchCafesFromAI = async () => {
      try {
        // Skip AI fetch if API key is not available
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.warn('GEMINI_API_KEY not found, skipping AI cafe fetch');
          return;
        }
        const ai = new GoogleGenAI({ apiKey });
        
        const systemInstruction = `
          You are a cafe discovery engine. 
          Find 8-10 popular cafes, roasteries, or work-friendly coffee spots in Beşiktaş, Istanbul.
          Return a purely JSON object with a key "cafes" containing an array.
          
          For each cafe, you MUST provide:
          - id: generate a unique string id (e.g., "ai-1", "ai-2")
          - name: string
          - address: string
          - coordinates: [latitude, longitude] (Numbers)
          - rating: number (1-5)
          - description: A short, moody, 1-sentence description.
          - isOpen: boolean (assume true for now)
          - imageUrl: Use a placeholder like "https://picsum.photos/seed/{name}/800/600"
          - googleMapsUri: The Google Maps URL if available from the tool.
          - amenities: An object with estimated scores (0-10) for: wifi, outlet, comfort, hygiene, quality, noise, service.
            (Estimate these based on the vibe of the place. Work places have high wifi/outlet/comfort. Quick stops have high service/quality).
        `;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: "Find highly rated coffee shops in Besiktas, Istanbul.",
          config: {
            systemInstruction: systemInstruction,
            tools: [{ googleMaps: {} }],
            // responseMimeType: "application/json" // REMOVED: Unsupported with googleMaps
          }
        });

        if (response.text) {
          // Manually parse JSON from text, handling potential Markdown code blocks
          let jsonStr = response.text.trim();
          const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1];
          } else {
             // Fallback cleanup if no json tag
             jsonStr = jsonStr.replace(/^```\w*\s*/, '').replace(/\s*```$/, '');
          }

          try {
            const data = JSON.parse(jsonStr);
            if (data.cafes && Array.isArray(data.cafes)) {
              // Merge new cafes, avoiding duplicates by name if possible, or just append
              setCafes(prev => {
                const newCafes = data.cafes.filter((newC: Cafe) => !prev.some(p => p.name === newC.name));
                return [...prev, ...newCafes];
              });
            }
          } catch (e) {
            console.error("Failed to parse JSON from AI response:", e);
          }
        }

        // Extract Grounding Chunks (Sources)
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          const sources = chunks
            .map((chunk: any) => {
              if (chunk.web?.uri && chunk.web?.title) {
                return { title: chunk.web.title, uri: chunk.web.uri };
              }
              if (chunk.maps?.uri) {
                return { title: chunk.maps.title || 'Google Maps', uri: chunk.maps.uri };
              }
              return null;
            })
            .filter((s: any) => s !== null) as {title: string, uri: string}[];
            
            setGroundingSources(prev => [...prev, ...sources]);
        }

      } catch (error) {
        console.error("Failed to fetch cafes from AI:", error);
      }
    };

    fetchCafesFromAI();
  }, []);

  // Fetch Istanbul cafes from Google Places API on mount
  useEffect(() => {
    const fetchIstanbulCafes = async () => {
      try {
        console.log('Fetching Istanbul cafes from Google Places...');
        const googleCafes = await searchCafesInIstanbul();
        
        // Convert Google Places cafes to Cafe format
        const cafesFromPlaces: Cafe[] = googleCafes.map(googleCafe => ({
          id: googleCafe.id,
          name: googleCafe.name,
          address: googleCafe.address,
          coordinates: googleCafe.coordinates,
          rating: googleCafe.rating,
          description: `Popular cafe in Istanbul`,
          isOpen: true,
          imageUrl: googleCafe.photoReference 
            ? getCafePhotoUrl(googleCafe.photoReference)
            : getCafeImageUrl(googleCafe.name),
          amenities: {
            wifi: 5,
            outlet: 5,
            comfort: 5,
            hygiene: 5,
            quality: 5,
            noise: 5,
            service: 5,
          },
          reviews: [],
        }));

        // Merge with existing cafes (avoid duplicates by ID)
        setCafes(prevCafes => {
          const cafeMap = new Map<string, Cafe>();
          
          // Add existing cafes
          prevCafes.forEach(cafe => {
            cafeMap.set(cafe.id, cafe);
          });
          
          // Add Google Places cafes (don't overwrite existing ones)
          cafesFromPlaces.forEach(cafe => {
            if (!cafeMap.has(cafe.id)) {
              cafeMap.set(cafe.id, cafe);
            }
          });
          
          return Array.from(cafeMap.values());
        });
        
        console.log(`Loaded ${cafesFromPlaces.length} cafes from Google Places`);
      } catch (error) {
        console.error('Error fetching Istanbul cafes:', error);
      }
    };

    fetchIstanbulCafes();
    
    // Fetch persistent places from backend (MVP persistence)
    fetchPersistentPlaces();
    
    // Also fetch blockchain reviews on initial load
    fetchBlockchainReviews();
  }, []);

  // Fetch persistent places from backend (simple Place model)
  const fetchPersistentPlaces = async () => {
    try {
      console.log('Fetching persistent places from backend...');
      const response = await fetch('/api/places');
      
      if (!response.ok) {
        console.warn('Failed to fetch persistent places, continuing without them');
        return;
      }

      const places = await response.json();
      console.log(`Loaded ${places.length} persistent places from backend`);

      // Convert Place to Cafe format and merge with existing cafes
      setCafes(prevCafes => {
        const cafeMap = new Map<string, Cafe>();
        
        // Keep existing cafes
        prevCafes.forEach(cafe => {
          cafeMap.set(cafe.id, cafe);
        });

        // Add/update places from backend (persistent places)
        places.forEach((place: any) => {
          // Use place.id as the key to avoid duplicates
          const placeId = place.id;
          
          if (!cafeMap.has(placeId)) {
            // Create new cafe from persistent place
            cafeMap.set(placeId, {
              id: placeId,
              name: place.name,
              address: place.address || place.name,
              coordinates: [place.lat, place.lng],
              rating: 0, // No rating yet for simple places
              description: place.city || place.district 
                ? `Location in ${place.city || ''} ${place.district || ''}`.trim()
                : 'User contributed location',
              isOpen: true,
              imageUrl: getCafeImageUrl(place.name),
              amenities: {
                wifi: 5,
                outlet: 5,
                comfort: 5,
                hygiene: 5,
                quality: 5,
                noise: 5,
                service: 5,
              },
              reviews: [],
              walletAddress: place.walletAddress || undefined, // Store wallet address for duplicate prevention
            });
          }
        });

        return Array.from(cafeMap.values());
      });
    } catch (error) {
      console.error('Error fetching persistent places:', error);
    }
  };

  // Fetch blockchain reviews from backend
  const fetchBlockchainReviews = async (bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
    try {
      // Use provided bounds or Istanbul bounding box for initial load
      const searchBounds = bounds || {
        minLat: 40.8,
        maxLat: 41.2,
        minLng: 28.5,
        maxLng: 29.5,
      };

      const params = new URLSearchParams({
        minLat: searchBounds.minLat.toString(),
        maxLat: searchBounds.maxLat.toString(),
        minLng: searchBounds.minLng.toString(),
        maxLng: searchBounds.maxLng.toString(),
      });

      const response = await fetch(`/api/places?${params}`);
      if (!response.ok) {
        console.warn('Failed to fetch blockchain reviews, continuing without them');
        return;
      }

      const places: PlaceIndex[] = await response.json();
      console.log(`Loaded ${places.length} blockchain-reviewed places from backend`);

      // Convert PlaceIndex to Cafe format and merge with existing cafes
      setCafes(prevCafes => {
        const cafeMap = new Map<string, Cafe>();
        
        // Keep existing cafes
        prevCafes.forEach(cafe => {
          cafeMap.set(cafe.id, cafe);
        });

        // Add/update places from backend (blockchain reviews)
        places.forEach(place => {
          if (cafeMap.has(place.placeId)) {
            // Update existing cafe with backend data (prioritize blockchain data)
            const existing = cafeMap.get(place.placeId)!;
            cafeMap.set(place.placeId, {
              ...existing,
              rating: place.avgRating,
              description: `Blockchain verified cafe with ${place.reviewCount} review(s)`,
              // Keep existing amenities if available
            });
          } else {
            // Create new cafe from place index (blockchain review)
            cafeMap.set(place.placeId, {
              id: place.placeId,
              name: place.placeName,
              address: place.placeName,
              coordinates: [place.lat, place.lng],
              rating: place.avgRating,
              description: `Blockchain verified cafe with ${place.reviewCount} review(s)`,
              isOpen: true,
              imageUrl: getCafeImageUrl(place.placeName),
              amenities: {
                wifi: 5,
                outlet: 5,
                comfort: 5,
                hygiene: 5,
                quality: 5,
                noise: 5,
                service: 5,
              },
              reviews: [],
            });
          }
        });

        return Array.from(cafeMap.values());
      });
    } catch (error) {
      console.error('Error fetching blockchain reviews:', error);
    }
  };

  // Fetch places from backend API based on map bounds (for blockchain reviews)
  const handleBoundsChange = async (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
    // Use the shared fetchBlockchainReviews function
    await fetchBlockchainReviews(bounds);
  };

  const handleSelectCafe = (cafe: Cafe) => {
    setSelectedCafeId(cafe.id);
    setSelectedAddress(null); // Clear address selection when cafe is selected
  };

  const handleCloseSidebar = () => {
    setSelectedCafeId(null);
  };

  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    const lowerQuery = query.toLowerCase();
    
    // Find first cafe that matches name or address
    const match = cafes.find(c => 
      c.name.toLowerCase().includes(lowerQuery) || 
      c.address.toLowerCase().includes(lowerQuery)
    );

    if (match) {
      setSelectedCafeId(match.id);
    } else {
      // Optional: Add a visual feedback/toast here if cafe not found
      console.log("No cafe found matching:", query);
    }
  };

  const handleAddressSelected = (address: { fullAddress: string; lat: number; lng: number }) => {
    // Set selected address to show on map
    setSelectedAddress(address);
    
    // Clear cafe selection when address is selected
    setSelectedCafeId(null);
    
    console.log('Address selected:', address);
  };

  const selectedCafe = cafes.find(c => c.id === selectedCafeId) || null;

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: COLORS.bgMain, height: '100vh', width: '100vw' }}>
      
      {/* Combined Search & Filter (Top Left) */}
      <SearchFilter 
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onSearch={handleSearch}
        onAddressSelected={handleAddressSelected}
        cafes={cafes}
        onCafeSelected={(cafe) => {
          setSelectedCafeId(cafe.id);
        }}
      />


      {/* Center Logo */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none drop-shadow-2xl hidden md:block">
        <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#c084fc', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#22d3ee', stopOpacity: 1 }} />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <path d="M50 5 C25 5 5 25 5 50 C5 80 50 100 50 100 C50 100 95 80 95 50 C95 25 75 5 50 5 Z" fill="url(#logoGrad)" filter="url(#glow)" opacity="0.9"/>
            <circle cx="50" cy="45" r="30" fill="#020617" />
            
            <rect x="35" y="30" width="10" height="35" rx="2" fill="url(#logoGrad)" />
            <rect x="48" y="25" width="10" height="40" rx="2" fill="url(#logoGrad)" />
            <rect x="61" y="35" width="10" height="30" rx="2" fill="url(#logoGrad)" />
            
            <path d="M35 30 L40 25 L45 30 Z" fill="#fff" opacity="0.8"/>
            <circle cx="70" cy="55" r="12" fill="#22d3ee" stroke="#020617" strokeWidth="3"/>
            <circle cx="66" cy="55" r="2" fill="#020617"/>
            <circle cx="70" cy="55" r="2" fill="#020617"/>
            <circle cx="74" cy="55" r="2" fill="#020617"/>
        </svg>
      </div>

      {/* Top Right Action Buttons */}
      <div className="absolute top-6 right-6 sm:right-12 z-[1000] hidden sm:flex items-center gap-3">
        
        {/* Add Location Button */}
        <button
          onClick={() => setIsAddLocationOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-[0_0_15px_rgba(2,6,23,0.5)] transition-all hover:bg-slate-800/60 hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] active:scale-95 group"
          style={{ backgroundColor: `${COLORS.bgCard}E6` }}
          title="Rate New Shop"
        >
          <Plus size={18} className="text-slate-300 group-hover:text-emerald-400 transition-colors" />
          <span className="text-sm font-medium text-slate-300 group-hover:text-emerald-400 transition-colors">Rate New Shop</span>
        </button>

        {/* Shop Button */}
        <button
          onClick={() => setIsShopOpen(true)}
          className="p-4 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-[0_0_15px_rgba(2,6,23,0.5)] transition-all hover:bg-slate-800/60 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95 group"
          style={{ backgroundColor: `${COLORS.bgCard}E6` }}
          title="Points Shop"
        >
          <ShoppingBag size={20} className="text-slate-300 group-hover:text-cyan-400 transition-colors" />
        </button>

        {/* User Profile Button */}
        <button
          onClick={() => setIsProfileOpen(true)}
          className="p-4 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-[0_0_15px_rgba(2,6,23,0.5)] transition-all hover:bg-slate-800/60 hover:border-purple-500/30 hover:shadow-[0_0_15px_rgba(192,132,252,0.15)] active:scale-95 group"
          style={{ backgroundColor: `${COLORS.bgCard}E6` }}
        >
          <User size={20} className="text-slate-300 group-hover:text-purple-400 transition-colors" />
        </button>

        {/* Connect Wallet Button */}
        {isWalletConnected ? (
          <div className="relative">
            <button
              onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
              className="flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-md border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-all hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:scale-[1.02] active:scale-[0.98] group"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.bgCard}E8 0%, rgba(6,182,212,0.1) 100%)`,
              }}
            >
              <div className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/30">
                <Wallet size={16} className="text-cyan-300 group-hover:text-cyan-200 transition-colors" />
              </div>
              <span className="text-sm font-bold text-cyan-50 group-hover:text-white tracking-wide font-mono">
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </span>
            </button>

            {/* Wallet Menu Dropdown */}
            {isWalletMenuOpen && (
              <div 
                data-wallet-menu
                className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[1100]"
              >
                <div className="p-3 border-b border-slate-700">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Connected Wallet</div>
                  <div className="text-sm font-mono text-cyan-400 break-all">
                    {walletAddress}
                  </div>
                </div>
                <button
                  onClick={() => {
                    disconnect();
                    setIsWalletMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-rose-400 hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <Wallet size={16} />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="wallet-button-wrapper">
            <ConnectButton
              connectText={
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-md border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-all hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:scale-[1.02] active:scale-[0.98] group cursor-pointer"
                  style={{ 
                    background: `linear-gradient(135deg, ${COLORS.bgCard}E8 0%, rgba(6,182,212,0.1) 100%)`,
                  }}>
                  <div className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/30 group-hover:bg-cyan-500/30 transition-colors">
                    <Wallet size={16} className="text-cyan-300 group-hover:text-cyan-200 transition-colors" />
                  </div>
                  <span 
                    className="text-base font-extrabold tracking-wide"
                    style={{ 
                      color: '#ffffff',
                      textShadow: '0 0 12px rgba(34,211,238,1), 0 0 24px rgba(34,211,238,0.6), 0 0 36px rgba(34,211,238,0.3)',
                    }}
                  >
                    Connect Wallet
                  </span>
                </div>
              }
            />
          </div>
        )}
      </div>

      {/* Main Map Area */}
      <div className="absolute inset-0 z-0" style={{ height: '100vh', width: '100vw' }}>
        <CafeMap 
          cafes={cafes} 
          selectedCafeId={selectedCafeId}
          activeFilter={activeFilter}
          onSelectCafe={handleSelectCafe}
          onBoundsChange={handleBoundsChange}
          selectedAddress={selectedAddress}
        />
      </div>

      {/* Details Sidebar (Right Drawer) */}
      <Sidebar 
        cafe={selectedCafe} 
        onClose={handleCloseSidebar}
        onReviewPosted={handleReviewPosted}
      />

      {/* User Profile Modal */}
      <UserProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        refreshTrigger={pointsRefreshTrigger}
      />

      {/* Shop Modal */}
      <ShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        refreshTrigger={pointsRefreshTrigger}
      />

      {/* Add Location Modal */}
      <AddLocationModal
        isOpen={isAddLocationOpen}
        onClose={() => setIsAddLocationOpen(false)}
        onReviewPosted={handleReviewPosted}
        onLocationAdded={async (newCafe) => {
          // Create full Cafe object with all required fields
          const fullCafe: Cafe = {
            ...newCafe,
            description: `User contributed location in ${newCafe.address}`,
            isOpen: true,
            imageUrl: getCafeImageUrl(newCafe.name),
            reviews: [],
            amenities: newCafe.amenities || {
              wifi: 5,
              outlet: 5,
              comfort: 5,
              hygiene: 5,
              quality: 5,
              noise: 5,
              service: 5,
            },
            walletAddress: walletAddress || undefined, // Store wallet address for duplicate prevention
          };

          // Add new cafe to map immediately with wallet address
          setCafes(prevCafes => {
            const cafeMap = new Map<string, Cafe>();
            prevCafes.forEach(cafe => cafeMap.set(cafe.id, cafe));
            cafeMap.set(fullCafe.id, fullCafe);
            return Array.from(cafeMap.values());
          });

          // Select the newly added cafe
          setSelectedCafeId(fullCafe.id);
          
          // Also refresh blockchain reviews to ensure the new location persists
          // Wait a bit for backend to process the new review
          setTimeout(async () => {
            await fetchBlockchainReviews();
            // Refresh points in modals after review is added (100 points earned)
            setPointsRefreshTrigger(prev => prev + 1);
          }, 1500); // Increased timeout to ensure backend has processed the review and added points

          // Clear address selection
          setSelectedAddress(null);
        }}
      />

      {/* X (Twitter) Logo (Bottom Right) */}
      <a 
        href="https://x.com/fikriytm" 
        target="_blank" 
        rel="noopener noreferrer"
        className="absolute bottom-6 right-6 z-[1000] p-3 rounded-full bg-[#020617] hover:bg-[#0f172a] transition-all hover:scale-110 shadow-2xl border border-white/10 group"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-slate-400 group-hover:fill-white transition-colors">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

    </div>
  );
}
