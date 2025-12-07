/**
 * Tier & Reward Service
 * 
 * Handles tier calculation and reward management:
 * - Calculate user tier based on points
 * - Claim rewards
 * - Generate coupons
 * - NFT achievements
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface TierInfo {
  name: TierName;
  minPoints: number;
  maxPoints?: number;
  discountMin: number;
  discountMax: number;
  benefits: string[];
}

export interface RewardClaim {
  rewardId: string;
  walletAddress: string;
  type: 'discount' | 'free_drink' | 'reservation' | 'event' | 'nft';
  value: any;
  costPoints: number;
}

/**
 * Calculate user tier based on total points
 */
export async function calculateTier(totalPoints: number): Promise<TierName> {
  if (totalPoints >= 3000) return 'Platinum';
  if (totalPoints >= 1500) return 'Gold';
  if (totalPoints >= 500) return 'Silver';
  return 'Bronze';
}

/**
 * Get tier information
 */
export async function getTierInfo(tierName: TierName): Promise<TierInfo> {
  const tier = await prisma.tier.findUnique({
    where: { name: tierName },
  });

  if (!tier) {
    // Default tier info if not in DB
    return getDefaultTierInfo(tierName);
  }

  return {
    name: tier.name as TierName,
    minPoints: tier.minPoints,
    maxPoints: tier.maxPoints || undefined,
    discountMin: tier.discountMin,
    discountMax: tier.discountMax,
    benefits: tier.benefits as string[],
  };
}

/**
 * Get default tier info
 */
function getDefaultTierInfo(tierName: TierName): TierInfo {
  const tiers: Record<TierName, TierInfo> = {
    Bronze: {
      name: 'Bronze',
      minPoints: 0,
      maxPoints: 499,
      discountMin: 5,
      discountMax: 10,
      benefits: ['Basic discounts', 'Standard rewards'],
    },
    Silver: {
      name: 'Silver',
      minPoints: 500,
      maxPoints: 1499,
      discountMin: 10,
      discountMax: 15,
      benefits: ['Enhanced discounts', 'Priority support', 'Exclusive rewards'],
    },
    Gold: {
      name: 'Gold',
      minPoints: 1500,
      maxPoints: 2999,
      discountMin: 15,
      discountMax: 20,
      benefits: ['Premium discounts', 'VIP support', 'Early access', 'Special events'],
    },
    Platinum: {
      name: 'Platinum',
      minPoints: 3000,
      discountMin: 20,
      discountMax: 25,
      benefits: [
        'Maximum discounts',
        '24/7 VIP support',
        'Exclusive events',
        'NFT achievements',
        'Token rewards',
      ],
    },
  };

  return tiers[tierName];
}

/**
 * Update user tier if points changed
 */
export async function updateUserTier(walletAddress: string): Promise<TierName> {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const newTier = await calculateTier(user.totalPoints);

  if (newTier !== user.currentTier) {
    await prisma.user.update({
      where: { walletAddress },
      data: { currentTier: newTier },
    });

    // Check for tier achievement NFT
    await checkTierAchievement(walletAddress, newTier);
  }

  return newTier;
}

/**
 * Claim a reward
 */
export async function claimReward(
  walletAddress: string,
  rewardId: string
): Promise<{ success: boolean; reward?: any; error?: string }> {
  const reward = await prisma.reward.findUnique({
    where: { id: rewardId },
  });

  if (!reward) {
    return { success: false, error: 'Reward not found' };
  }

  if (reward.walletAddress !== walletAddress) {
    return { success: false, error: 'Unauthorized' };
  }

  if (reward.status !== 'available') {
    return { success: false, error: 'Reward not available' };
  }

  if (reward.expiresAt && reward.expiresAt < new Date()) {
    return { success: false, error: 'Reward expired' };
  }

  const user = await prisma.user.findUnique({
    where: { walletAddress },
  });

  if (!user || user.totalPoints < reward.costPoints) {
    return { success: false, error: 'Insufficient points' };
  }

  // Deduct points and mark as claimed
  await prisma.$transaction([
    prisma.user.update({
      where: { walletAddress },
      data: {
        totalPoints: {
          decrement: reward.costPoints,
        },
      },
    }),
    prisma.reward.update({
      where: { id: rewardId },
      data: {
        status: 'claimed',
        claimedAt: new Date(),
      },
    }),
  ]);

  // Update tier if points changed
  await updateUserTier(walletAddress);

  return { success: true, reward };
}

/**
 * Generate discount coupon
 */
export async function generateCoupon(
  walletAddress: string,
  discountPercent: number,
  costPoints: number
): Promise<{ success: boolean; rewardId?: string; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const tierInfo = await getTierInfo(user.currentTier as TierName);

  // Validate discount is within tier limits
  if (
    discountPercent < tierInfo.discountMin ||
    discountPercent > tierInfo.discountMax
  ) {
    return {
      success: false,
      error: `Discount must be between ${tierInfo.discountMin}% and ${tierInfo.discountMax}% for ${user.currentTier} tier`,
    };
  }

  if (user.totalPoints < costPoints) {
    return { success: false, error: 'Insufficient points' };
  }

  // Create reward
  const reward = await prisma.reward.create({
    data: {
      walletAddress,
      type: 'discount',
      title: `${discountPercent}% Discount Coupon`,
      description: `Use this coupon to get ${discountPercent}% off your next purchase`,
      value: { discountPercent, code: generateCouponCode() },
      costPoints,
      status: 'available',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return { success: true, rewardId: reward.id };
}

/**
 * Generate coupon code
 */
function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check and mint tier achievement NFT
 */
async function checkTierAchievement(
  walletAddress: string,
  tier: TierName
): Promise<void> {
  // Check if achievement already exists
  const existing = await prisma.achievement.findUnique({
    where: {
      walletAddress_type: {
        walletAddress,
        type: `${tier.toLowerCase()}_tier`,
      },
    },
  });

  if (existing) {
    return; // Already has this achievement
  }

  // Create achievement
  const achievement = await prisma.achievement.create({
    data: {
      walletAddress,
      type: `${tier.toLowerCase()}_tier`,
      title: `${tier} Tier Achiever`,
      description: `Reached ${tier} tier status`,
    },
  });

  // Mint NFT on Sui (mock for now)
  const nftTokenId = await mintAchievementNFT(walletAddress, achievement.id, tier);
  
  if (nftTokenId) {
    await prisma.achievement.update({
      where: { id: achievement.id },
      data: {
        nftTokenId,
        mintedAt: new Date(),
      },
    });
  }
}

/**
 * Check and mint review count achievement NFT
 */
export async function checkReviewCountAchievement(
  walletAddress: string,
  reviewCount: number
): Promise<void> {
  const milestones = [10, 25, 50, 100, 250, 500];

  for (const milestone of milestones) {
    if (reviewCount >= milestone) {
      const type = `${milestone}_reviews`;
      
      const existing = await prisma.achievement.findUnique({
        where: {
          walletAddress_type: {
            walletAddress,
            type,
          },
        },
      });

      if (!existing) {
        const achievement = await prisma.achievement.create({
          data: {
            walletAddress,
            type,
            title: `${milestone} Reviews Milestone`,
            description: `Completed ${milestone} reviews`,
          },
        });

        // Mint NFT
        const nftTokenId = await mintAchievementNFT(
          walletAddress,
          achievement.id,
          `${milestone}_reviews`
        );

        if (nftTokenId) {
          await prisma.achievement.update({
            where: { id: achievement.id },
            data: {
              nftTokenId,
              mintedAt: new Date(),
            },
          });
        }
      }
    }
  }
}

/**
 * Mint achievement NFT on Sui blockchain
 * This is a mock function - replace with real Sui NFT minting
 */
async function mintAchievementNFT(
  walletAddress: string,
  achievementId: string,
  achievementType: string
): Promise<string | null> {
  // TODO: Implement real Sui NFT minting
  // This should:
  // 1. Create a transaction to mint NFT
  // 2. Return NFT token ID
  
  console.log(`[MOCK] Minting NFT for achievement:`, {
    walletAddress,
    achievementId,
    achievementType,
  });

  // Mock NFT token ID
  return `0x${Math.random().toString(16).substring(2, 66)}`;
}

/**
 * Get available rewards for user
 */
export async function getAvailableRewards(walletAddress: string) {
  return prisma.reward.findMany({
    where: {
      walletAddress,
      status: 'available',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

