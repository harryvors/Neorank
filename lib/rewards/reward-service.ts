/**
 * Reward Service
 * Manages rewards, coupons, and redemption
 */

import { Tier, RewardClaim } from '../../types/reputation';
import { getTierConfig } from '../reputation/reputation-service';

/**
 * Calculate discount percentage based on tier
 */
export function calculateDiscount(tier: Tier, baseDiscount?: number): number {
  const config = getTierConfig(tier);
  
  if (baseDiscount !== undefined) {
    // Clamp to tier's discount range
    return Math.max(
      config.discountMin,
      Math.min(config.discountMax, baseDiscount)
    );
  }
  
  // Return tier's average discount
  return (config.discountMin + config.discountMax) / 2;
}

/**
 * Create discount coupon reward
 */
export function createDiscountCoupon(
  walletAddress: string,
  discountPercent: number,
  costPoints: number,
  expiresInDays: number = 30
): RewardClaim {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  return {
    rewardId: `discount_${Date.now()}_${walletAddress.slice(0, 8)}`,
    type: 'discount',
    title: `${discountPercent}% Discount Coupon`,
    value: {
      discountPercent,
      code: generateCouponCode(),
      expiresAt: expiresAt.toISOString(),
    },
    costPoints,
  };
}

/**
 * Create free drink reward
 */
export function createFreeDrinkReward(
  walletAddress: string,
  costPoints: number,
  expiresInDays: number = 60
): RewardClaim {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  return {
    rewardId: `free_drink_${Date.now()}_${walletAddress.slice(0, 8)}`,
    type: 'free_drink',
    title: 'Free Drink Voucher',
    value: {
      code: generateCouponCode(),
      expiresAt: expiresAt.toISOString(),
    },
    costPoints,
  };
}

/**
 * Generate random coupon code
 */
function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if user can claim reward (has enough points)
 */
export function canClaimReward(
  userPoints: number,
  rewardCost: number
): { canClaim: boolean; pointsRemaining: number } {
  return {
    canClaim: userPoints >= rewardCost,
    pointsRemaining: userPoints - rewardCost,
  };
}

/**
 * Calculate reward cost based on type and tier
 */
export function calculateRewardCost(
  rewardType: 'discount' | 'free_drink' | 'reservation' | 'event' | 'nft',
  tier: Tier,
  discountPercent?: number
): number {
  const baseCosts = {
    discount: 100,
    free_drink: 200,
    reservation: 150,
    event: 300,
    nft: 500,
  };

  let cost = baseCosts[rewardType] || 100;

  // Tier-based discounts on reward costs
  const tierMultipliers = {
    Bronze: 1.0,
    Silver: 0.9,
    Gold: 0.8,
    Platinum: 0.7,
  };

  cost = Math.round(cost * tierMultipliers[tier]);

  // Discount coupons cost more for higher discounts
  if (rewardType === 'discount' && discountPercent) {
    cost += Math.round((discountPercent - 10) * 5); // +5 points per % above 10%
  }

  return cost;
}

/**
 * Get available rewards for user tier
 */
export function getAvailableRewards(tier: Tier): Array<{
  type: string;
  title: string;
  description: string;
  costPoints: number;
  available: boolean;
}> {
  const rewards = [
    {
      type: 'discount',
      title: '10% Discount Coupon',
      description: 'Get 10% off at selected venues',
      costPoints: calculateRewardCost('discount', tier, 10),
      available: true,
    },
    {
      type: 'discount',
      title: '15% Discount Coupon',
      description: 'Get 15% off at selected venues',
      costPoints: calculateRewardCost('discount', tier, 15),
      available: tier !== 'Bronze',
    },
    {
      type: 'free_drink',
      title: 'Free Drink',
      description: 'Redeem for a free drink',
      costPoints: calculateRewardCost('free_drink', tier),
      available: true,
    },
    {
      type: 'reservation',
      title: 'Priority Reservation',
      description: 'Book a table with priority',
      costPoints: calculateRewardCost('reservation', tier),
      available: tier === 'Gold' || tier === 'Platinum',
    },
    {
      type: 'event',
      title: 'Exclusive Event Access',
      description: 'Access to special events',
      costPoints: calculateRewardCost('event', tier),
      available: tier === 'Platinum',
    },
  ];

  return rewards;
}

