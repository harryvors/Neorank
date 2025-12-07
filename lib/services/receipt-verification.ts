/**
 * Receipt Verification Logic
 * 
 * Determines if a receipt is verified and/or suspicious based on:
 * - Hash uniqueness (first use = verified)
 * - Multiple wallet usage (3+ wallets = suspicious)
 * - Receipt age (7+ days old = suspicious)
 */

import { PrismaClient } from '@prisma/client';

export interface ReceiptVerificationResult {
  verifiedByReceipt: boolean;
  isSuspiciousReceipt: boolean;
  reason?: string;
}

/**
 * Check receipt verification status
 * 
 * @param prisma - Prisma client instance
 * @param signatureHash - SHA-256 hash of receipt signature
 * @param receiptDate - Receipt date (optional, for age check)
 * @param walletAddress - Current wallet address (to exclude from duplicate check)
 * @returns Verification result
 */
export async function checkReceiptVerification(
  prisma: PrismaClient | null,
  signatureHash: string,
  receiptDate?: Date | string,
  walletAddress?: string
): Promise<ReceiptVerificationResult> {
  // If Prisma is not available, return unverified
  if (!prisma) {
    console.warn('[Receipt Verification] Prisma not available, returning unverified');
    return {
      verifiedByReceipt: false,
      isSuspiciousReceipt: false,
      reason: 'Database not available',
    };
  }

  try {
    // Find all reviews with this receipt hash
    const existingReviews = await prisma.review.findMany({
      where: {
        receiptSignatureHash: signatureHash,
      },
      select: {
        walletAddress: true,
        createdAt: true,
      },
    });

    const useCount = existingReviews.length;
    const uniqueWallets = new Set(existingReviews.map(r => r.walletAddress));
    const walletCount = uniqueWallets.size;

    console.log('[Receipt Verification] Hash analysis:', {
      useCount,
      walletCount,
      signatureHash: signatureHash.substring(0, 16) + '...',
    });

    let verifiedByReceipt = false;
    let isSuspiciousReceipt = false;
    let reason: string | undefined;

    // First use = verified
    if (useCount === 0) {
      verifiedByReceipt = true;
      reason = 'First use of this receipt';
    }
    // Multiple uses but reasonable (3 or fewer wallets, 3 or fewer uses)
    else if (useCount <= 3 && walletCount <= 3) {
      verifiedByReceipt = true;
      reason = `Used by ${walletCount} wallet(s), ${useCount} time(s)`;
    }
    // Too many uses = suspicious
    else {
      verifiedByReceipt = true; // Still verified, but suspicious
      isSuspiciousReceipt = true;
      reason = `Suspicious: Used by ${walletCount} wallets, ${useCount} times`;
    }

    // Check receipt age (7+ days old = suspicious)
    if (receiptDate) {
      const receiptDateObj = typeof receiptDate === 'string' 
        ? new Date(receiptDate) 
        : receiptDate;
      
      if (!isNaN(receiptDateObj.getTime())) {
        const diffDays = (Date.now() - receiptDateObj.getTime()) / (1000 * 60 * 60 * 24);
        
        if (diffDays > 7) {
          isSuspiciousReceipt = true;
          reason = (reason ? reason + '; ' : '') + `Receipt is ${Math.floor(diffDays)} days old`;
        }
      }
    }

    console.log('[Receipt Verification] Result:', {
      verifiedByReceipt,
      isSuspiciousReceipt,
      reason,
    });

    return {
      verifiedByReceipt,
      isSuspiciousReceipt,
      reason,
    };
  } catch (error) {
    console.error('[Receipt Verification] Error:', error);
    return {
      verifiedByReceipt: false,
      isSuspiciousReceipt: false,
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

