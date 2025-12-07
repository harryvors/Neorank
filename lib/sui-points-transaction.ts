/**
 * Sui Points Transaction Helper
 * 
 * This module handles on-chain Sui transactions for awarding points
 * after a successful review submission.
 */

import { Transaction } from '@mysten/sui/transactions';

// Type for the signAndExecute mutation function from dapp-kit
export type SignAndExecuteFn = (
  params: { transaction: Transaction; options?: any },
  callbacks?: { onSuccess?: (result: any) => void; onError?: (error: any) => void }
) => void;

/**
 * Award points transaction to Sui blockchain
 * 
 * This function creates a transaction that awards points to the user
 * for submitting a review. It can optionally include the Walrus blob ID.
 * 
 * @param amount - Amount of points to award (default: 100)
 * @param walrusBlobId - Optional: Walrus blob ID to include in the event
 * @param signAndExecute - Sign and execute function from dapp-kit
 * @returns Transaction digest
 */
export async function awardPointsTransaction(
  amount: number = 100,
  walrusBlobId?: string,
  signAndExecute?: SignAndExecuteFn
): Promise<string> {
  if (!signAndExecute) {
    throw new Error('signAndExecute function is required');
  }

  return new Promise((resolve, reject) => {
    const tx = new Transaction();

    // Real Move contract call implementation
    const PACKAGE_ID = import.meta.env.VITE_SUI_PACKAGE_ID || '0x0';
    
    if (PACKAGE_ID !== '0x0') {
      if (walrusBlobId) {
        // Award points with blob ID
        const blobIdBytes = new TextEncoder().encode(walrusBlobId);
        tx.moveCall({
          target: `${PACKAGE_ID}::review_points::award_points_with_blob`,
          arguments: [
            tx.pure.u64(BigInt(amount)),
            tx.pure.vector('u8', Array.from(blobIdBytes)),
          ],
        });
        console.log(`[Sui Points] Awarding ${amount} points with blob ID: ${walrusBlobId.substring(0, 20)}...`);
      } else {
        // Award points without blob ID
        tx.moveCall({
          target: `${PACKAGE_ID}::review_points::award_points_for_review`,
          arguments: [
            tx.pure.u64(BigInt(amount)),
          ],
        });
        console.log(`[Sui Points] Awarding ${amount} points for review`);
      }
    } else {
      // Mock transaction if PACKAGE_ID is not set
      console.log('[MOCK] Creating points award transaction (PACKAGE_ID not set):', {
        amount,
        walrusBlobId,
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
          console.log('[Sui Points] Points award transaction successful:', result.digest);
          resolve(result.digest);
        },
        onError: (error: any) => {
          console.error('[Sui Points] Points award transaction failed:', error);
          reject(error);
        },
      }
    );
  });
}

