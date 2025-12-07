/**
 * Geocoding Service Abstraction
 * 
 * This module provides address search/autocomplete functionality.
 * Currently uses OpenStreetMap Nominatim API (free, no API key required).
 * 
 * TODO: Replace with production geocoding service if needed:
 * - Google Places API
 * - Mapbox Geocoding API
 * - Here Geocoding API
 * - Custom backend service
 */

export interface AddressSuggestion {
  fullAddress: string;
  displayName: string;
  city?: string;
  district?: string;
  lat: number;
  lng: number;
  raw: any; // Raw API response for debugging
}

export interface GeocodingError {
  message: string;
  code?: string;
}

/**
 * Search addresses using OpenStreetMap Nominatim API
 * 
 * Documentation: https://nominatim.org/release-docs/develop/api/Search/
 * 
 * Note: Nominatim has usage policies:
 * - Maximum 1 request per second
 * - Include User-Agent header
 * - For production, consider using a paid service or self-hosted instance
 * 
 * @param query - Search query (e.g., "Abc Sok. No:12, Beşiktaş")
 * @param options - Optional parameters (limit, country code, etc.)
 * @returns Array of address suggestions
 */
export async function searchAddress(
  query: string,
  options: {
    limit?: number;
    countryCode?: string; // e.g., "tr" for Turkey
    viewbox?: string; // "minLon,minLat,maxLon,maxLat" for bounding box
  } = {}
): Promise<AddressSuggestion[]> {
  const { limit = 5, countryCode = 'tr', viewbox } = options;

  try {
    // Build Nominatim API URL
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: limit.toString(),
      countrycodes: countryCode,
      'accept-language': 'tr,en', // Prefer Turkish, fallback to English
    });

    // Add viewbox if provided (helps prioritize results in a specific area)
    if (viewbox) {
      params.append('viewbox', viewbox);
      params.append('bounded', '1');
    }

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CafeReviewApp/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Transform Nominatim response to our AddressSuggestion format
    const suggestions: AddressSuggestion[] = data.map((item: any) => {
      const address = item.address || {};
      
      // Extract city and district from address components
      const city = address.city || address.town || address.municipality || address.state_district;
      const district = address.suburb || address.neighbourhood || address.quarter || 
                      address.city_district || address.district;

      // Build full address string
      const addressParts = [
        item.address?.road,
        item.address?.house_number,
        item.address?.house_name,
      ].filter(Boolean);
      
      const fullAddress = addressParts.length > 0 
        ? `${addressParts.join(' ')}, ${city || district || ''}`.trim()
        : item.display_name;

      return {
        fullAddress: fullAddress || item.display_name,
        displayName: item.display_name,
        city: city || undefined,
        district: district || undefined,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        raw: item,
      };
    });

    return suggestions;
  } catch (error: any) {
    console.error('Geocoding error:', error);
    throw {
      message: error.message || 'Adresler alınamadı, tekrar deneyin',
      code: 'GEOCODING_ERROR',
    } as GeocodingError;
  }
}

/**
 * Mock address search function (for development/testing)
 * 
 * TODO: Remove this when using real geocoding service
 */
export async function mockSearchAddress(query: string): Promise<AddressSuggestion[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // Mock Istanbul addresses
  const mockAddresses: AddressSuggestion[] = [
    {
      fullAddress: 'Abc Sok. No:12 D:3, Beşiktaş',
      displayName: 'Abc Sokak No:12 Daire:3, Beşiktaş, İstanbul, Türkiye',
      city: 'İstanbul',
      district: 'Beşiktaş',
      lat: 41.0422,
      lng: 29.0081,
      raw: {},
    },
    {
      fullAddress: 'Def Cad. No:45, Kadıköy',
      displayName: 'Def Caddesi No:45, Kadıköy, İstanbul, Türkiye',
      city: 'İstanbul',
      district: 'Kadıköy',
      lat: 40.9901,
      lng: 29.0291,
      raw: {},
    },
    {
      fullAddress: 'Ghi Mah. Jkl Sk. No:78, Şişli',
      displayName: 'Ghi Mahallesi Jkl Sokak No:78, Şişli, İstanbul, Türkiye',
      city: 'İstanbul',
      district: 'Şişli',
      lat: 41.0609,
      lng: 28.9877,
      raw: {},
    },
  ];

  // Filter by query (case-insensitive)
  const filtered = mockAddresses.filter(addr =>
    addr.fullAddress.toLowerCase().includes(query.toLowerCase()) ||
    addr.district?.toLowerCase().includes(query.toLowerCase()) ||
    addr.city?.toLowerCase().includes(query.toLowerCase())
  );

  return filtered;
}

/**
 * Reverse geocoding: Convert coordinates to address
 * Uses OpenStreetMap Nominatim Reverse Geocoding API
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Address information
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<AddressSuggestion | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=tr,en`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CafeReviewApp/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.address) {
      return null;
    }

    const address = data.address || {};
    
    // Extract city and district from address components
    const city = address.city || address.town || address.municipality || address.state_district || address.state;
    const district = address.suburb || address.neighbourhood || address.quarter || 
                    address.city_district || address.district || address.county;

    // Build full address string
    const addressParts = [
      address.road,
      address.house_number,
      address.house_name,
    ].filter(Boolean);
    
    const fullAddress = addressParts.length > 0 
      ? `${addressParts.join(' ')}, ${city || district || ''}`.trim()
      : data.display_name;

    return {
      fullAddress: fullAddress || data.display_name || '',
      displayName: data.display_name || '',
      city: city || undefined,
      district: district || undefined,
      lat: parseFloat(data.lat || lat),
      lng: parseFloat(data.lon || lng),
      raw: data,
    };
  } catch (error: any) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

