/**
 * Geolocation Utilities
 * 
 * Functions for getting user location and calculating distances
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get user's current location using browser Geolocation API
 * Returns Promise with coordinates or null if denied/error
 * 
 * @param retryCount - Number of retries if user denies (default: 1, so 2 total attempts)
 */
export function getCurrentLocation(retryCount: number = 1): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      resolve(null);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 0, // Don't use cached position
    };

    const attemptGetLocation = (attempt: number) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn(`Geolocation error (attempt ${attempt}):`, error.message);
          
          // If user denied (PERMISSION_DENIED) and we have retries left, try again
          if (error.code === error.PERMISSION_DENIED && attempt < retryCount + 1) {
            console.log(`Retrying location request (attempt ${attempt + 1}/${retryCount + 1})...`);
            // Wait a bit before retrying
            setTimeout(() => {
              attemptGetLocation(attempt + 1);
            }, 500);
          } else {
            resolve(null);
          }
        },
        options
      );
    };

    attemptGetLocation(1);
  });
}

/**
 * Check if user is within verification distance of a place
 * Default threshold: 150 meters
 */
export function isWithinVerificationDistance(
  userLat: number,
  userLng: number,
  placeLat: number,
  placeLng: number,
  thresholdMeters: number = 150
): boolean {
  const distance = calculateDistance(userLat, userLng, placeLat, placeLng);
  return distance <= thresholdMeters;
}

