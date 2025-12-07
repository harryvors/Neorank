/**
 * Reputation Service
 * 
 * Handles user reputation calculation and on-chain storage:
 * - Compute reputation score
 * - Update consistency score
 * - Sync to Sui blockchain
 */

import { PrismaClient } from '@prisma/client';
import { calculateConsistencyScore } from './consistency';

const prisma = new PrismaClient();

export interface ReputationData {
  reputationScore: number; // 0-100
  consistencyScore: number; // 0-100
  totalReviews: number;
  verifiedReviews: number;
  helpfulVotes: number;
  flagsReceived: number;
}

/**
 * Compute user reputation based on all factors
 */
export async function computeReputation(
  walletAddress: string
): Promise<ReputationData> {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
    include: {
      reviews: {
        take: 100, // Last 100 reviews
      },
      flags: {
        where: {
          status: 'reviewed',
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const totalReviews = user.reviews.length;
  const verifiedReviews = user.reviews.filter(r => r.isVerifiedVisit).length;
  
  // Get helpful votes (from review flags - positive ones)
  // For now, we'll use a placeholder - you can add a HelpfulVote model later
  const helpfulVotes = 0; // TODO: Implement helpful votes system
  
  const flagsReceived = user.flags.length;

  // Calculate consistency score
  const consistencyScore = await calculateConsistencyScore(walletAddress);

  // Calculate reputation score (0-100)
  const reputationScore = calculateReputationScore({
    totalReviews,
    verifiedReviews,
    consistencyScore,
    helpfulVotes,
    flagsReceived,
  });

  return {
    reputationScore,
    consistencyScore,
    totalReviews,
    verifiedReviews,
    helpfulVotes,
    flagsReceived,
  };
}

/**
 * Calculate reputation score (0-100)
 */
function calculateReputationScore(data: {
  totalReviews: number;
  verifiedReviews: number;
  consistencyScore: number;
  helpfulVotes: number;
  flagsReceived: number;
}): number {
  let score = 50; // Base score

  // Review count bonus (max +20)
  if (data.totalReviews >= 100) score += 20;
  else if (data.totalReviews >= 50) score += 15;
  else if (data.totalReviews >= 20) score += 10;
  else if (data.totalReviews >= 10) score += 5;

  // Verified review ratio (max +15)
  const verifiedRatio = data.totalReviews > 0 
    ? data.verifiedReviews / data.totalReviews 
    : 0;
  score += verifiedRatio * 15;

  // Consistency score (max +10)
  score += (data.consistencyScore / 100) * 10;

  // Helpful votes (max +5)
  if (data.helpfulVotes >= 50) score += 5;
  else if (data.helpfulVotes >= 20) score += 3;
  else if (data.helpfulVotes >= 10) score += 1;

  // Flags penalty (max -20)
  const flagPenalty = Math.min(20, data.flagsReceived * 2);
  score -= flagPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Update user reputation in database
 */
export async function updateReputation(
  walletAddress: string
): Promise<ReputationData> {
  const reputationData = await computeReputation(walletAddress);

  // Update User model
  await prisma.user.update({
    where: { walletAddress },
    data: {
      reputationScore: reputationData.reputationScore,
      consistencyScore: reputationData.consistencyScore,
    },
  });

  // Update UserReputation model
  await prisma.userReputation.upsert({
    where: { walletAddress },
    update: {
      reputationScore: reputationData.reputationScore,
      consistencyScore: reputationData.consistencyScore,
      totalReviews: reputationData.totalReviews,
      verifiedReviews: reputationData.verifiedReviews,
      helpfulVotes: reputationData.helpfulVotes,
      flagsReceived: reputationData.flagsReceived,
    },
    create: {
      walletAddress,
      reputationScore: reputationData.reputationScore,
      consistencyScore: reputationData.consistencyScore,
      totalReviews: reputationData.totalReviews,
      verifiedReviews: reputationData.verifiedReviews,
      helpfulVotes: reputationData.helpfulVotes,
      flagsReceived: reputationData.flagsReceived,
    },
  });

  return reputationData;
}

/**
 * Update reputation on Sui blockchain
 * This is a mock function - replace with real Sui integration
 */
export async function updateReputationOnChain(
  walletAddress: string,
  reputationScore: number,
  consistencyScore: number
): Promise<string | null> {
  // TODO: Implement real Sui transaction
  // This should:
  // 1. Create a transaction to update reputation object on-chain
  // 2. Return transaction digest
  
  console.log(`[MOCK] Updating reputation on-chain for ${walletAddress}:`, {
    reputationScore,
    consistencyScore,
  });

  // Mock transaction digest
  return `0x${Math.random().toString(16).substring(2, 66)}`;
}

/**
 * Sync reputation to blockchain
 */
export async function syncReputationToChain(
  walletAddress: string
): Promise<{ success: boolean; transactionDigest?: string }> {
  const reputation = await prisma.userReputation.findUnique({
    where: { walletAddress },
  });

  if (!reputation) {
    throw new Error('Reputation not found');
  }

  // Update on-chain
  const transactionDigest = await updateReputationOnChain(
    walletAddress,
    reputation.reputationScore,
    reputation.consistencyScore
  );

  // Update last synced timestamp
  if (transactionDigest) {
    await prisma.userReputation.update({
      where: { walletAddress },
      data: {
        onChainReputation: transactionDigest,
        lastSyncedAt: new Date(),
      },
    });
  }

  return {
    success: !!transactionDigest,
    transactionDigest: transactionDigest || undefined,
  };
}

