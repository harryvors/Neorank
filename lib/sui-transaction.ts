/**
 * Sui Transaction Helper
 * 
 * This module handles on-chain Sui transactions for storing Walrus IDs
 * 
 * TODO: Replace with real Sui Move contract calls
 * The walrusId should be stored on-chain in a Sui object
 */

import { Transaction } from '@mysten/sui/transactions';

// Type for the signAndExecute mutation function from dapp-kit
export type SignAndExecuteFn = (
  params: { transaction: Transaction; options?: any },
  callbacks?: { onSuccess?: (result: any) => void; onError?: (error: any) => void }
) => void;

/**
 * Review data structure for Sui transaction
 */
export interface ReviewTransactionData {
  placeId: string;
  placeName: string;
  walletAddress: string;
  rating: number;
  comment: string;
  coordinates: [number, number]; // [lat, lng]
  address?: string;
  timestamp: number;
  totalPoints: number; // Mevcut toplam puan (on-chain'de saklanacak)
}

/**
 * Submit review transaction to Sui blockchain
 * 
 * This function:
 * 1. Creates a Sui transaction with review data
 * 2. User signs the transaction (wallet popup)
 * 3. Returns the transaction digest
 * 
 * The review data is stored on-chain, and the transaction digest
 * will be used to link with Walrus storage.
 * 
 * TODO: Implement real Move contract call
 * Example Move function signature:
 * ```move
 * public entry fun submit_review(
 *   place_id: vector<u8>,
 *   place_name: vector<u8>,
 *   rating: u8,
 *   comment: vector<u8>,
 *   lat: u64,
 *   lng: u64,
 *   timestamp: u64,
 *   ctx: &mut TxContext
 * )
 * ```
 * 
 * @param reviewData - The review data to store on-chain
 * @param signAndExecute - Sign and execute function from dapp-kit
 * @returns Transaction digest
 */
export async function submitReviewTransaction(
  reviewData: ReviewTransactionData,
  signAndExecute: SignAndExecuteFn
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tx = new Transaction();

    // Real Move contract call implementation
    const PACKAGE_ID = import.meta.env.VITE_SUI_PACKAGE_ID || '0x0';
    
    if (PACKAGE_ID !== '0x0') {
      // Convert strings to byte vectors
      const placeIdBytes = new TextEncoder().encode(reviewData.placeId);
      const placeNameBytes = new TextEncoder().encode(reviewData.placeName);
      const commentBytes = new TextEncoder().encode(reviewData.comment);
      
      // Call the Move function to create a review with total_points
      // Note: Points award is done in a separate transaction after Walrus upload
      tx.moveCall({
        target: `${PACKAGE_ID}::reviews::create_review`,
        arguments: [
          tx.pure.vector('u8', Array.from(placeIdBytes)),
          tx.pure.vector('u8', Array.from(placeNameBytes)),
          tx.pure.vector('u8', []), // ratings (empty for now, can be added later)
          tx.pure.vector('u8', Array.from(commentBytes)),
          tx.pure.u64(BigInt(reviewData.totalPoints)), // Mevcut toplam puan (on-chain'de saklanır)
        ],
      });
      
      console.log(`[Sui] Creating review transaction with totalPoints: ${reviewData.totalPoints}`);
    } else {
      // Mock transaction if PACKAGE_ID is not set
      console.log('[MOCK] Creating Sui transaction with review data (PACKAGE_ID not set):', {
        ...reviewData,
        totalPoints: reviewData.totalPoints,
        pointsAwarded: 100,
      });
    }

    signAndExecute(
      {
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      },
      {
        onSuccess: (result: any) => {
          console.log('[MOCK] Sui transaction successful:', result.digest);
          resolve(result.digest);
        },
        onError: (error: any) => {
          console.error('[MOCK] Sui transaction failed:', error);
          reject(error);
        },
      }
    );
  });
}

