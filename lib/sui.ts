import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { getCafeImageUrl } from './cafe-images';

// Sui client instance
export const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'), // Using testnet for development
});

// Package ID - Update this after deploying the Move contract
// To get the Package ID, run: sui client publish --gas-budget 100000000
// Then copy the Package ID from the output and add it to .env.local as VITE_SUI_PACKAGE_ID
// Or update the default value below
// @ts-ignore - Vite environment variables
const PACKAGE_ID = import.meta.env.VITE_SUI_PACKAGE_ID || '0x0';

// Review data structure for Sui blockchain
export interface ReviewData {
  cafeId: string;
  cafeName: string;
  ratings: Record<string, number>;
  text: string;
  timestamp: number;
  walletAddress: string;
  coordinates?: [number, number]; // [lat, lng] - optional for backward compatibility
  address?: string; // Cafe address - optional
  totalPoints: number; // Mevcut toplam puan (on-chain'de saklanır)
}

/**
 * Create a transaction to store a review on Sui blockchain
 * This creates a Move object that stores the review data
 */
export async function createReviewTransaction(
  reviewData: ReviewData,
  wallet: any
): Promise<string> {
  const tx = new Transaction();
  
  // Serialize ratings to JSON bytes
  const ratingsJson = JSON.stringify(reviewData.ratings);
  const ratingsBytes = new TextEncoder().encode(ratingsJson);
  
  // Convert strings to byte vectors for Move
  const cafeIdBytes = new TextEncoder().encode(reviewData.cafeId);
  const cafeNameBytes = new TextEncoder().encode(reviewData.cafeName);
  const textBytes = new TextEncoder().encode(reviewData.text);
  
  // Call the Move function to create a review with total_points
  tx.moveCall({
    target: `${PACKAGE_ID}::reviews::create_review`,
    arguments: [
      tx.pure.vector('u8', Array.from(cafeIdBytes)),
      tx.pure.vector('u8', Array.from(cafeNameBytes)),
      tx.pure.vector('u8', Array.from(ratingsBytes)),
      tx.pure.vector('u8', Array.from(textBytes)),
      tx.pure.u64(BigInt(reviewData.totalPoints)), // Mevcut toplam puan (on-chain'de saklanır)
    ],
  });
  
  try {
    // Sign and execute transaction
    const result = await wallet.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    return result.digest;
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
}

/**
 * Get all reviews from Sui blockchain
 * Fetches Review objects owned by wallets and extracts cafe information
 */
export async function getAllReviews(): Promise<ReviewData[]> {
  try {
    // Query events for ReviewCreated to get all reviews
    const events = await suiClient.queryEvents({
      query: {
        MoveModule: {
          package: PACKAGE_ID,
          module: 'reviews',
        },
      },
      limit: 1000, // Get more reviews
      order: 'descending',
    });

    const reviews: ReviewData[] = [];
    const processedTxns = new Set<string>();

    for (const event of events.data) {
      if (event.type === `${PACKAGE_ID}::reviews::ReviewCreated`) {
        const eventData = event.parsedJson as any;
        const txnDigest = event.id.txDigest;
        
        // Avoid processing same transaction multiple times
        if (processedTxns.has(txnDigest)) continue;
        processedTxns.add(txnDigest);

        try {
          // Get transaction details to find created objects
          const txn = await suiClient.getTransactionBlock({
            digest: txnDigest,
            options: {
              showEffects: true,
              showObjectChanges: true,
            },
          });

          // Find Review objects created in this transaction
          if (txn.objectChanges) {
            for (const change of txn.objectChanges) {
              if (change.type === 'created' && change.objectType?.includes('reviews::Review')) {
                const objectId = change.objectId;
                
                try {
                  // Get the Review object
                  const reviewObj = await suiClient.getObject({
                    id: objectId,
                    options: {
                      showContent: true,
                      showType: true,
                    },
                  });

                  if (reviewObj.data && 'content' in reviewObj.data && 'fields' in reviewObj.data.content) {
                    const fields = reviewObj.data.content.fields as any;
                    
                    // Parse ratings from bytes
                    let ratings: Record<string, number> = {};
                    try {
                      const ratingsBytes = fields.ratings as number[];
                      const ratingsStr = new TextDecoder().decode(new Uint8Array(ratingsBytes));
                      ratings = JSON.parse(ratingsStr);
                    } catch (e) {
                      console.warn('Failed to parse ratings:', e);
                    }

                    reviews.push({
                      cafeId: fields.cafe_id,
                      cafeName: fields.cafe_name,
                      ratings,
                      text: fields.text,
                      timestamp: Number(fields.timestamp),
                      walletAddress: fields.wallet_address,
                      totalPoints: Number(fields.total_points || 0), // On-chain'den gelen puan bilgisi
                    });
                  }
                } catch (e) {
                  console.warn('Failed to fetch review object:', e);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Failed to fetch transaction:', e);
        }
      }
    }

    return reviews;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}

/**
 * Get reviews for a specific cafe from Sui blockchain
 */
export async function getCafeReviews(cafeId: string, walletAddress?: string): Promise<ReviewData[]> {
  const allReviews = await getAllReviews();
  return allReviews.filter(r => r.cafeId === cafeId);
}

/**
 * Convert reviews to cafes for map display
 * Groups reviews by cafeId and creates Cafe objects
 */
export function reviewsToCafes(reviews: ReviewData[], existingCafes: any[] = []): any[] {
  const cafeMap = new Map<string, any>();

  // Add existing cafes to map
  existingCafes.forEach(cafe => {
    cafeMap.set(cafe.id, cafe);
  });

  // Process reviews and create/update cafes
  reviews.forEach(review => {
    const cafeId = review.cafeId;
    
    if (!cafeMap.has(cafeId)) {
      // Create new cafe from review
      const avgRating = Object.values(review.ratings).reduce((a, b) => a + b, 0) / Object.values(review.ratings).length;
      
      cafeMap.set(cafeId, {
        id: cafeId,
        name: review.cafeName,
        address: review.address || 'Address not available',
        rating: parseFloat((avgRating / 2).toFixed(1)), // Convert 0-10 to 1-5 scale
        coordinates: review.coordinates || [41.0082, 28.9784], // Default Istanbul center if not provided
        amenities: review.ratings,
        imageUrl: getCafeImageUrl(review.cafeName),
        description: `Blockchain verified cafe with ${reviews.filter(r => r.cafeId === cafeId).length} review(s)`,
        isOpen: true,
        reviews: [],
      });
    }

    // Add review to cafe
    const cafe = cafeMap.get(cafeId);
    if (cafe) {
      // Update amenities with average of all reviews
      const cafeReviews = reviews.filter(r => r.cafeId === cafeId);
      cafe.amenities = calculateAverageRatings(cafeReviews);
      
      // Add review to cafe's review list
      if (!cafe.reviews) cafe.reviews = [];
      cafe.reviews.push({
        id: review.timestamp.toString(),
        userName: review.walletAddress.slice(0, 6) + '...' + review.walletAddress.slice(-4),
        rating: Object.values(review.ratings).reduce((a, b) => a + b, 0) / Object.values(review.ratings).length / 2,
        text: review.text,
        date: new Date(review.timestamp).toLocaleDateString(),
      });
    }
  });

  return Array.from(cafeMap.values());
}

/**
 * Get user's latest review from Sui blockchain to get their on-chain total points
 * This is used for discount code validation
 */
export async function getUserLatestReviewPoints(walletAddress: string): Promise<number | null> {
  try {
    // @ts-ignore - Vite environment variables
    const PACKAGE_ID = import.meta.env.VITE_SUI_PACKAGE_ID || '0x0';
    if (PACKAGE_ID === '0x0') {
      console.warn('[Sui] PACKAGE_ID not set, cannot query on-chain points');
      return null;
    }

    // Query events for this wallet's reviews
    // Note: We query all ReviewCreated events and filter by wallet_address in the event data
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::reviews::ReviewCreated`,
      },
      limit: 100, // Get more events to find the latest one for this wallet
      order: 'descending',
    });
    
    // Filter events by wallet_address in the event data
    const walletEvents = events.data.filter(event => {
      const eventData = event.parsedJson as any;
      return eventData.wallet_address === walletAddress;
    });
    
    if (walletEvents.length === 0) {
      console.log(`[Sui] No reviews found for wallet ${walletAddress}`);
      return null;
    }
    
    // Get the latest event for this wallet
    const latestEvent = walletEvents[0];

    const eventData = latestEvent.parsedJson as any;
    
    // total_points is in the event data
    const totalPoints = eventData.total_points ? Number(eventData.total_points) : null;
    
    console.log(`[Sui] Latest review points for ${walletAddress}: ${totalPoints}`);
    return totalPoints;
  } catch (error) {
    console.error('[Sui] Error querying user latest review points:', error);
    return null;
  }
}

/**
 * Calculate average ratings from reviews
 */
export function calculateAverageRatings(reviews: ReviewData[]): Record<string, number> {
  if (reviews.length === 0) {
    return {};
  }

  const totals: Record<string, { sum: number; count: number }> = {};

  reviews.forEach((review) => {
    Object.entries(review.ratings).forEach(([key, value]) => {
      if (!totals[key]) {
        totals[key] = { sum: 0, count: 0 };
      }
      totals[key].sum += value;
      totals[key].count += 1;
    });
  });

  const averages: Record<string, number> = {};
  Object.entries(totals).forEach(([key, { sum, count }]) => {
    averages[key] = parseFloat((sum / count).toFixed(1));
  });

  return averages;
}

