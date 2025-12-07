/**
 * Sui Client for Node.js Backend (ES Module)
 * 
 * This is a Node.js-compatible version of lib/sui.ts
 * Used by server.mjs for on-chain point verification
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Sui client instance
const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'), // Using testnet for development
});

/**
 * Get user's latest review from Sui blockchain to get their on-chain total points
 * This is used for discount code validation
 */
export async function getUserLatestReviewPoints(walletAddress) {
  try {
    const PACKAGE_ID = process.env.VITE_SUI_PACKAGE_ID || '0x0';
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
      const eventData = event.parsedJson;
      return eventData.wallet_address === walletAddress;
    });
    
    if (walletEvents.length === 0) {
      console.log(`[Sui] No reviews found for wallet ${walletAddress}`);
      return null;
    }
    
    // Get the latest event for this wallet
    const latestEvent = walletEvents[0];
    const eventData = latestEvent.parsedJson;
    
    // total_points is in the event data
    const totalPoints = eventData.total_points ? Number(eventData.total_points) : null;
    
    console.log(`[Sui] Latest review points for ${walletAddress}: ${totalPoints}`);
    return totalPoints;
  } catch (error) {
    console.error('[Sui] Error querying user latest review points:', error);
    return null;
  }
}

