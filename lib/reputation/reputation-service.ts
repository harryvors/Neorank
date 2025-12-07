/**
 * Reputation Service
 * Manages user reputation scores and on-chain synchronization
 */

import { UserStats, Tier } from '../../types/reputation';

const REPUTATION_CONFIG = {
  INITIAL_REPUTATION: 50.0,
  INITIAL_CONSISTENCY: 50.0,
  MAX_REPUTATION: 100.0,
  MIN_REPUTATION: 0.0,
  REPUTATION_DECAY_RATE: 0.1, // Per inactive month
} as const;

/**
 * Calculate reputation score based on review history
 */
export function calculateReputationScore(
  stats: {
    totalReviews: number;
    verifiedReviews: number;
    helpfulVotes: number;
    flagsReceived: number;
    averageQualityScore: number;
    averageConsistencyScore: number;
  }
): number {
  let reputation = REPUTATION_CONFIG.INITIAL_REPUTATION;

  // Base reputation from quality (0-40 points)
  reputation += (stats.averageQualityScore / 100) * 40;

  // Consistency bonus (0-30 points)
  reputation += (stats.averageConsistencyScore / 100) * 30;

  // Verified reviews bonus (0-15 points)
  const verifiedRatio = stats.totalReviews > 0 
    ? stats.verifiedReviews / stats.totalReviews 
    : 0;
  reputation += verifiedRatio * 15;

  // Helpful votes bonus (0-10 points)
  const helpfulRatio = stats.totalReviews > 0
    ? Math.min(1, stats.helpfulVotes / stats.totalReviews)
    : 0;
  reputation += helpfulRatio * 10;

  // Flags penalty (-0 to -15 points)
  const flagRatio = stats.totalReviews > 0
    ? Math.min(1, stats.flagsReceived / stats.totalReviews)
    : 0;
  reputation -= flagRatio * 15;

  // Review count bonus (0-5 points for active users)
  if (stats.totalReviews >= 50) {
    reputation += 5;
  } else if (stats.totalReviews >= 20) {
    reputation += 3;
  } else if (stats.totalReviews >= 10) {
    reputation += 1;
  }

  return Math.max(
    REPUTATION_CONFIG.MIN_REPUTATION,
    Math.min(REPUTATION_CONFIG.MAX_REPUTATION, Math.round(reputation * 100) / 100)
  );
}

/**
 * Update consistency score based on new review
 */
export function updateConsistencyScore(
  currentConsistency: number,
  newConsistencyScore: number,
  totalReviews: number
): number {
  // Weighted average: existing score * (n-1)/n + new score * 1/n
  const weight = totalReviews > 0 ? 1 / totalReviews : 1;
  const updated = currentConsistency * (1 - weight) + newConsistencyScore * weight;
  
  return Math.round(updated * 100) / 100;
}

/**
 * Calculate tier based on total points
 */
export function calculateTier(totalPoints: number): Tier {
  if (totalPoints >= 3000) {
    return 'Platinum';
  } else if (totalPoints >= 1500) {
    return 'Gold';
  } else if (totalPoints >= 500) {
    return 'Silver';
  } else {
    return 'Bronze';
  }
}

/**
 * Get tier configuration
 */
export function getTierConfig(tier: Tier) {
  const configs = {
    Bronze: {
      name: 'Bronze' as Tier,
      minPoints: 0,
      maxPoints: 499,
      discountMin: 5,
      discountMax: 10,
      benefits: [
        '5-10% discount on selected venues',
        'Basic reward access',
      ],
    },
    Silver: {
      name: 'Silver' as Tier,
      minPoints: 500,
      maxPoints: 1499,
      discountMin: 10,
      discountMax: 15,
      benefits: [
        '10-15% discount on selected venues',
        'Priority customer support',
        'Access to exclusive rewards',
      ],
    },
    Gold: {
      name: 'Gold' as Tier,
      minPoints: 1500,
      maxPoints: 2999,
      discountMin: 15,
      discountMax: 20,
      benefits: [
        '15-20% discount on selected venues',
        'Priority reservations',
        'Exclusive event access',
        'NFT achievement badges',
      ],
    },
    Platinum: {
      name: 'Platinum' as Tier,
      minPoints: 3000,
      maxPoints: undefined,
      discountMin: 20,
      discountMax: 25,
      benefits: [
        '20-25% discount on selected venues',
        'VIP reservations',
        'Exclusive events',
        'Premium NFT achievements',
        'Early access to new features',
      ],
    },
  };

  return configs[tier];
}

/**
 * Calculate streak days
 */
export function calculateStreakDays(
  lastReviewDate: Date | null | undefined,
  previousStreakDays: number
): number {
  if (!lastReviewDate) {
    return 0;
  }

  const now = new Date();
  const daysSinceLastReview = Math.floor(
    (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If reviewed today or yesterday, continue streak
  if (daysSinceLastReview <= 1) {
    return previousStreakDays + 1;
  } else {
    // Streak broken
    return 0;
  }
}

/**
 * Check if user should receive weekly bonus
 */
export function checkWeeklyBonusEligibility(
  streakDays: number,
  weeklyReviewCount: number
): {
  eligible: boolean;
  streakBonus: number;
  weeklyBonus: number;
} {
  const streakBonus = streakDays >= 7 ? 100 : 0;
  const weeklyBonus = weeklyReviewCount >= 20 ? 50 : 0;

  return {
    eligible: streakBonus > 0 || weeklyBonus > 0,
    streakBonus,
    weeklyBonus,
  };
}

