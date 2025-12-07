/**
 * Google Places API Integration
 * 
 * Fetches cafes/restaurants from Google Places API for Istanbul area
 * 
 * TODO: Add your Google Places API key to .env.local:
 * VITE_GOOGLE_PLACES_API_KEY=your_api_key_here
 * 
 * Or use a free alternative like Overpass API (OpenStreetMap)
 */

export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  types?: string[];
  photos?: Array<{
    photo_reference: string;
  }>;
}

export interface CafeFromPlaces {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number];
  rating: number;
  googlePlaceId: string;
  photoReference?: string;
}

/**
 * Search cafes in Istanbul using Google Places API
 * 
 * @param bounds - Bounding box for Istanbul area
 * @returns Array of cafes
 */
export async function searchCafesInIstanbul(
  bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): Promise<CafeFromPlaces[]> {
  const apiKey = (import.meta.env as any).VITE_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.warn('Google Places API key not found. Using mock data.');
    return getMockIstanbulCafes();
  }

  try {
    // Istanbul bounding box (approximate)
    const istanbulBounds = bounds || {
      minLat: 40.8,
      maxLat: 41.2,
      minLng: 28.5,
      maxLng: 29.2,
    };

    // Use Nearby Search API
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${(istanbulBounds.minLat + istanbulBounds.maxLat) / 2},${(istanbulBounds.minLng + istanbulBounds.maxLng) / 2}`);
    url.searchParams.set('radius', '20000'); // 20km radius
    url.searchParams.set('type', 'cafe');
    url.searchParams.set('keyword', 'cafe coffee');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status);
      return getMockIstanbulCafes();
    }

    const places: GooglePlace[] = data.results || [];

    // Convert to CafeFromPlaces format
    const cafes: CafeFromPlaces[] = places
      .filter(place => 
        place.types?.some(type => 
          type === 'cafe' || 
          type === 'restaurant' || 
          type === 'food' ||
          type === 'establishment'
        )
      )
      .map(place => ({
        id: `google-${place.place_id}`,
        name: place.name,
        address: place.formatted_address,
        coordinates: [place.geometry.location.lat, place.geometry.location.lng],
        rating: place.rating || 4.0,
        googlePlaceId: place.place_id,
        photoReference: place.photos?.[0]?.photo_reference,
      }))
      .slice(0, 50); // Limit to 50 cafes

    return cafes;
  } catch (error) {
    console.error('Error fetching cafes from Google Places:', error);
    return getMockIstanbulCafes();
  }
}

/**
 * Mock Istanbul cafes (fallback when API key is not available)
 */
function getMockIstanbulCafes(): CafeFromPlaces[] {
  // Popular cafes in different Istanbul districts
  const mockCafes: CafeFromPlaces[] = [
    // Beşiktaş
    { id: 'mock-1', name: 'Starbucks Beşiktaş', address: 'Barbaros Bulvarı, Beşiktaş, İstanbul', coordinates: [41.0422, 29.0081], rating: 4.2, googlePlaceId: 'mock-1' },
    { id: 'mock-2', name: 'Kahve Dünyası Beşiktaş', address: 'Abbasağa Mahallesi, Beşiktaş, İstanbul', coordinates: [41.0450, 29.0100], rating: 4.5, googlePlaceId: 'mock-2' },
    { id: 'mock-3', name: 'Coffeeshop Company', address: 'Levent, Beşiktaş, İstanbul', coordinates: [41.0800, 29.0200], rating: 4.3, googlePlaceId: 'mock-3' },
    
    // Kadıköy
    { id: 'mock-4', name: 'Starbucks Kadıköy', address: 'Bahariye Caddesi, Kadıköy, İstanbul', coordinates: [40.9901, 29.0291], rating: 4.4, googlePlaceId: 'mock-4' },
    { id: 'mock-5', name: 'Coffeeshop Company Kadıköy', address: 'Moda, Kadıköy, İstanbul', coordinates: [40.9850, 29.0250], rating: 4.6, googlePlaceId: 'mock-5' },
    { id: 'mock-6', name: 'Kahve Dünyası Kadıköy', address: 'Bağdat Caddesi, Kadıköy, İstanbul', coordinates: [40.9750, 29.0300], rating: 4.3, googlePlaceId: 'mock-6' },
    
    // Şişli
    { id: 'mock-7', name: 'Starbucks Şişli', address: 'Halaskargazi Caddesi, Şişli, İstanbul', coordinates: [41.0609, 28.9877], rating: 4.1, googlePlaceId: 'mock-7' },
    { id: 'mock-8', name: 'Coffeeshop Company Şişli', address: 'Nişantaşı, Şişli, İstanbul', coordinates: [41.0500, 28.9900], rating: 4.7, googlePlaceId: 'mock-8' },
    { id: 'mock-9', name: 'Kahve Dünyası Şişli', address: 'Teşvikiye, Şişli, İstanbul', coordinates: [41.0550, 28.9850], rating: 4.4, googlePlaceId: 'mock-9' },
    
    // Beyoğlu
    { id: 'mock-10', name: 'Starbucks Beyoğlu', address: 'İstiklal Caddesi, Beyoğlu, İstanbul', coordinates: [41.0369, 28.9775], rating: 4.3, googlePlaceId: 'mock-10' },
    { id: 'mock-11', name: 'Coffeeshop Company Beyoğlu', address: 'Galata, Beyoğlu, İstanbul', coordinates: [41.0254, 28.9742], rating: 4.5, googlePlaceId: 'mock-11' },
    { id: 'mock-12', name: 'Kahve Dünyası Beyoğlu', address: 'Taksim, Beyoğlu, İstanbul', coordinates: [41.0370, 28.9850], rating: 4.2, googlePlaceId: 'mock-12' },
    
    // Üsküdar
    { id: 'mock-13', name: 'Starbucks Üsküdar', address: 'Kuzguncuk, Üsküdar, İstanbul', coordinates: [41.0250, 29.0150], rating: 4.4, googlePlaceId: 'mock-13' },
    { id: 'mock-14', name: 'Coffeeshop Company Üsküdar', address: 'Çengelköy, Üsküdar, İstanbul', coordinates: [41.0300, 29.0200], rating: 4.6, googlePlaceId: 'mock-14' },
    
    // Bakırköy
    { id: 'mock-15', name: 'Starbucks Bakırköy', address: 'Zuhuratbaba, Bakırköy, İstanbul', coordinates: [40.9800, 28.8700], rating: 4.3, googlePlaceId: 'mock-15' },
    { id: 'mock-16', name: 'Kahve Dünyası Bakırköy', address: 'Ataköy, Bakırköy, İstanbul', coordinates: [40.9750, 28.8750], rating: 4.5, googlePlaceId: 'mock-16' },
  ];

  return mockCafes;
}

/**
 * Get cafe photo URL from Google Places
 */
export function getCafePhotoUrl(photoReference: string, maxWidth: number = 800): string {
  const apiKey = (import.meta.env as any).VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey || !photoReference) {
    // Fallback to coffee shop image from Unsplash
    return `https://images.unsplash.com/photo-1495474472287-4d4b2a99b8c9?w=${maxWidth}&h=600&fit=crop&auto=format&q=80`;
  }
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
}

