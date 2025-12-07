/**
 * Cafe Image Helper
 * 
 * Provides coffee/cafe-related images from Unsplash
 * Uses Unsplash Source API for free, high-quality coffee shop images
 */

/**
 * Get a coffee shop image URL based on cafe name or ID
 * Uses Unsplash to fetch relevant coffee/cafe images
 * 
 * @param cafeName - Name of the cafe (for consistent image selection)
 * @param width - Image width (default: 800)
 * @param height - Image height (default: 600)
 * @returns Unsplash image URL
 */
export function getCafeImageUrl(cafeName: string, width: number = 800, height: number = 600): string {
  // Create a hash from cafe name to get consistent image
  const hash = cafeName.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  // Use hash to select from different coffee-related image IDs
  // These are curated Unsplash photo IDs for coffee shops/cafes
  // Using Unsplash's photo ID format: {timestamp}-{hash}
  const coffeeImageIds = [
    // High-quality coffee shop and cafe images from Unsplash
    '1495474472287-4d4b2a99b8c9', // Coffee shop interior with warm lighting
    '1501339847302-ac426a4a7cbb', // Modern minimalist cafe
    '1447933601403-0c6681de3cd5', // Coffee beans close-up
    '1461020411469-80fdd6a19119', // Coffee cup on wooden table
    '1509042239860-9aa423b1d3c1', // Cozy coffee shop ambiance
    '1511920170033-83939dbb8a77', // Barista making coffee
    '1442514202408-0c4a3a0b0e4e', // Latte art close-up
    '1501339847302-ac426a4a7cbb', // Modern cafe interior
    '1495474472287-4d4b2a99b8c9', // Coffee shop with plants
    '1447933601403-0c6681de3cd5', // Coffee beans and cups
    '1461020411469-80fdd6a19119', // Coffee on rustic table
    '1509042239860-9aa423b1d3c1', // Coffee shop counter
    '1511920170033-83939dbb8a77', // Coffee preparation
    '1442514202408-0c4a3a0b0e4e', // Coffee cup with latte art
    '1501339847302-ac426a4a7cbb', // Cafe atmosphere
    '1495474472287-4d4b2a99b8c9', // Coffee shop interior
  ];
  
  // Select image based on hash for consistent selection
  const imageIndex = Math.abs(hash) % coffeeImageIds.length;
  const imageId = coffeeImageIds[imageIndex];
  
  // Return Unsplash image URL
  // Using Unsplash CDN with optimized parameters
  return `https://images.unsplash.com/photo-${imageId}?w=${width}&h=${height}&fit=crop&auto=format&q=80`;
}

/**
 * Get a random coffee shop image URL
 * 
 * @param seed - Optional seed for consistent random selection
 * @param width - Image width (default: 800)
 * @param height - Image height (default: 600)
 * @returns Unsplash image URL
 */
export function getRandomCafeImageUrl(seed?: string, width: number = 800, height: number = 600): string {
  if (seed) {
    return getCafeImageUrl(seed, width, height);
  }
  
  // Random coffee-related Unsplash photo IDs
  const randomImages = [
    '1495474472287-4d4b2a99b8c9',
    '1501339847302-ac426a4a7cbb',
    '1447933601403-0c6681de3cd5',
    '1461020411469-80fdd6a19119',
    '1509042239860-9aa423b1d3c1',
    '1511920170033-83939dbb8a77',
  ];
  
  const randomIndex = Math.floor(Math.random() * randomImages.length);
  return `https://images.unsplash.com/photo-${randomImages[randomIndex]}?w=${width}&h=${height}&fit=crop&auto=format&q=80`;
}

