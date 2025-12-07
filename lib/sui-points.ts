/**
 * Sui Points Helper
 * 
 * This module provides functions to query on-chain user points
 * from Sui blockchain using the review_points Move module.
 */

import { suiClient } from './sui';

// Get PACKAGE_ID from environment
const PACKAGE_ID = import.meta.env.VITE_SUI_PACKAGE_ID || '0x0';

/**
 * Fetch total points for a user from on-chain UserPoints objects
 * 
 * This function:
 * 1. Queries all UserPoints objects owned by the user's address
 * 2. Sums up all the amounts to get total points
 * 
 * @param address - User's wallet address
 * @returns Total points (0 if no points found or error)
 */
export async function fetchUserPoints(address: string): Promise<number> {
  if (PACKAGE_ID === '0x0') {
    console.warn('[Sui Points] PACKAGE_ID not set, returning 0');
    return 0;
  }

  try {
    // Query all UserPoints objects owned by this address
    const objects = await suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${PACKAGE_ID}::review_points::UserPoints`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    // Sum up all amounts
    let totalPoints = 0;
    
    for (const obj of objects.data) {
      if (obj.data && 'content' in obj.data && 'fields' in obj.data.content) {
        const fields = obj.data.content.fields as any;
        const amount = Number(fields.amount || 0);
        totalPoints += amount;
      }
    }

    console.log(`[Sui Points] Fetched ${objects.data.length} UserPoints objects, total: ${totalPoints}`);
    return totalPoints;
  } catch (error) {
    console.error('[Sui Points] Error fetching user points:', error);
    return 0;
  }
}

/**
 * Fetch total points from PointsAwardedEvent events
 * 
 * Alternative method: Query all PointsAwardedEvent events for this address
 * and sum the amounts. This is more efficient for large numbers of transactions.
 * 
 * @param address - User's wallet address
 * @returns Total points from events
 */
export async function fetchUserPointsFromEvents(address: string): Promise<number> {
  if (PACKAGE_ID === '0x0') {
    console.warn('[Sui Points] PACKAGE_ID not set, returning 0');
    return 0;
  }

  try {
    // Query all PointsAwardedEvent events for this address
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::review_points::PointsAwardedEvent`,
      },
      filter: {
        Sender: address,
      },
      limit: 1000, // Get up to 1000 events
      order: 'descending',
    });

    // Sum up all amounts
    let totalPoints = 0;
    
    for (const event of events.data) {
      if (event.parsedJson) {
        const eventData = event.parsedJson as any;
        // Only count events for this specific address
        if (eventData.owner === address) {
          const amount = Number(eventData.amount || 0);
          totalPoints += amount;
        }
      }
    }

    console.log(`[Sui Points] Fetched ${events.data.length} events, total: ${totalPoints}`);
    return totalPoints;
  } catch (error) {
    console.error('[Sui Points] Error fetching points from events:', error);
    return 0;
  }
}

/**
 * Get user points (tries both methods, returns the higher value)
 * 
 * @param address - User's wallet address
 * @returns Total points
 */
export async function getUserPoints(address: string): Promise<number> {
  try {
    // Try both methods and return the higher value (or the first successful one)
    const [fromObjects, fromEvents] = await Promise.all([
      fetchUserPoints(address).catch(() => 0),
      fetchUserPointsFromEvents(address).catch(() => 0),
    ]);

    // Return the higher value (they should be the same, but this handles edge cases)
    return Math.max(fromObjects, fromEvents);
  } catch (error) {
    console.error('[Sui Points] Error in getUserPoints:', error);
    return 0;
  }
}

