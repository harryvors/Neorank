/**
 * Anti-Spam Service
 * 
 * Handles spam detection and prevention:
 * - Cooldown checks
 * - Daily limits
 * - Pattern detection
 * - Speed limits
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CooldownCheckResult {
  canReview: boolean;
  daysRemaining: number;
  lastReviewDate?: Date;
}

export interface DailyLimitCheckResult {
  canReview: boolean;
  reviewsToday: number;
  maxReviews: number;
  nextReviewIndex: number; // 1-5
}

export interface SuspiciousPatternResult {
  isSuspicious: boolean;
  reasons: string[];
  riskScore: number; // 0-100
}

/**
 * Check if user can review a place (cooldown check)
 * Minimum 30 days between reviews for the same place
 */
export async function checkCooldown(
  walletAddress: string,
  placeId: string
): Promise<CooldownCheckResult> {
  const cooldown = await prisma.placeCooldown.findUnique({
    where: {
      walletAddress_placeId: {
        walletAddress,
        placeId,
      },
    },
  });

  if (!cooldown) {
    return {
      canReview: true,
      daysRemaining: 0,
    };
  }

  const now = new Date();
  const daysSinceLastReview = Math.floor(
    (now.getTime() - cooldown.lastReviewAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining = Math.max(0, 30 - daysSinceLastReview);

  return {
    canReview: daysRemaining === 0,
    daysRemaining,
    lastReviewDate: cooldown.lastReviewAt,
  };
}

/**
 * Check daily review limit
 * Max 5 reviews per day
 */
export async function checkDailyLimit(
  walletAddress: string
): Promise<DailyLimitCheckResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyLimit = await prisma.dailyLimit.findUnique({
    where: {
      walletAddress_date: {
        walletAddress,
        date: today,
      },
    },
  });

  const reviewsToday = dailyLimit?.reviewCount || 0;
  const maxReviews = 2; // Günde maksimum 2 review
  const canReview = reviewsToday < maxReviews;
  const nextReviewIndex = reviewsToday + 1;

  return {
    canReview,
    reviewsToday,
    maxReviews,
    nextReviewIndex,
  };
}

/**
 * Check speed limit
 * More than 1 review in 5 minutes is suspicious
 */
export async function checkSpeedLimit(
  walletAddress: string
): Promise<{ isTooFast: boolean; lastReviewTime?: Date }> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentReview = await prisma.review.findFirst({
    where: {
      walletAddress,
      createdAt: {
        gte: fiveMinutesAgo,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return {
    isTooFast: !!recentReview,
    lastReviewTime: recentReview?.createdAt,
  };
}

/**
 * Detect suspicious patterns in user reviews
 */
export async function detectSuspiciousPatterns(
  walletAddress: string
): Promise<SuspiciousPatternResult> {
  const userReviews = await prisma.review.findMany({
    where: {
      walletAddress,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20, // Check last 20 reviews
  });

  if (userReviews.length === 0) {
    return {
      isSuspicious: false,
      reasons: [],
      riskScore: 0,
    };
  }

  const reasons: string[] = [];
  let riskScore = 0;

  // Pattern 1: Always 5 stars
  const allFiveStars = userReviews.every(r => r.rating === 5);
  if (allFiveStars && userReviews.length >= 5) {
    reasons.push('Always gives 5-star ratings');
    riskScore += 30;
  }

  // Pattern 2: Very short comments
  const shortComments = userReviews.filter(
    r => r.commentLength < 20 && r.commentLength > 0
  ).length;
  if (shortComments / userReviews.length > 0.7) {
    reasons.push('Mostly very short comments');
    riskScore += 20;
  }

  // Pattern 3: No photos
  const noPhotos = userReviews.filter(r => !r.hasPhoto).length;
  if (noPhotos / userReviews.length > 0.9) {
    reasons.push('Rarely includes photos');
    riskScore += 10;
  }

  // Pattern 4: Same comment pattern
  const uniqueComments = new Set(
    userReviews
      .filter(r => r.comment)
      .map(r => r.comment?.toLowerCase().trim())
  );
  if (uniqueComments.size < userReviews.length * 0.3 && userReviews.length >= 5) {
    reasons.push('Repeated comment patterns');
    riskScore += 25;
  }

  // Pattern 5: Very fast reviews (already checked in speed limit)
  const speedCheck = await checkSpeedLimit(walletAddress);
  if (speedCheck.isTooFast) {
    reasons.push('Reviews submitted too quickly');
    riskScore += 15;
  }

  return {
    isSuspicious: riskScore >= 30,
    reasons,
    riskScore: Math.min(100, riskScore),
  };
}

/**
 * Update place cooldown after review
 */
export async function updatePlaceCooldown(
  walletAddress: string,
  placeId: string
): Promise<void> {
  await prisma.placeCooldown.upsert({
    where: {
      walletAddress_placeId: {
        walletAddress,
        placeId,
      },
    },
    update: {
      lastReviewAt: new Date(),
    },
    create: {
      walletAddress,
      placeId,
      lastReviewAt: new Date(),
    },
  });
}

/**
 * Update daily limit after review
 */
export async function updateDailyLimit(
  walletAddress: string,
  pointsEarned: number
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailyLimit.upsert({
    where: {
      walletAddress_date: {
        walletAddress,
        date: today,
      },
    },
    update: {
      reviewCount: {
        increment: 1,
      },
      totalPoints: {
        increment: pointsEarned,
      },
    },
    create: {
      walletAddress,
      date: today,
      reviewCount: 1,
      totalPoints: pointsEarned,
    },
  });
}

