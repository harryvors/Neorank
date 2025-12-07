/**
 * Anti-Spam Service
 * Detects and prevents spam reviews
 */

import { SpamDetectionResult, CooldownStatus, DailyLimitStatus } from '../../types/reputation';

const SPAM_CONFIG = {
  COOLDOWN_DAYS: 30,
  MAX_DAILY_REVIEWS: 5,
  MIN_TIME_BETWEEN_REVIEWS: 5 * 60 * 1000, // 5 minutes in milliseconds
  SUSPICIOUS_PATTERN_THRESHOLD: 0.8, // 80% same rating
  MIN_COMMENT_LENGTH: 10,
} as const;

/**
 * Check if user can review a place (cooldown check)
 */
export function checkCooldown(
  lastReviewDate: Date | null | undefined,
  cooldownDays: number = SPAM_CONFIG.COOLDOWN_DAYS
): CooldownStatus {
  if (!lastReviewDate) {
    return {
      canReview: true,
      daysRemaining: 0,
      cooldownDays,
    };
  }

  const now = new Date();
  const daysSinceLastReview = Math.floor(
    (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining = Math.max(0, cooldownDays - daysSinceLastReview);

  return {
    canReview: daysRemaining === 0,
    lastReviewDate,
    daysRemaining,
    cooldownDays,
  };
}

/**
 * Check daily review limit
 */
export function checkDailyLimit(
  todayReviewCount: number,
  maxReviews: number = SPAM_CONFIG.MAX_DAILY_REVIEWS
): DailyLimitStatus {
  const canReview = todayReviewCount < maxReviews;
  const nextReviewIndex = todayReviewCount + 1;
  
  // Calculate multiplier based on review index
  let pointsMultiplier = 1.0;
  if (nextReviewIndex <= 3) {
    pointsMultiplier = 1.0;
  } else if (nextReviewIndex <= 5) {
    pointsMultiplier = 0.5;
  } else {
    pointsMultiplier = 0.0;
  }

  // Calculate reset time (next day at midnight)
  const resetAt = new Date();
  resetAt.setHours(24, 0, 0, 0);

  return {
    canReview,
    reviewCount: todayReviewCount,
    maxReviews,
    pointsMultiplier,
    nextReviewIndex,
    resetAt,
  };
}

/**
 * Check time between reviews (speed limit)
 */
export function checkSpeedLimit(lastReviewTime: Date | null): {
  canReview: boolean;
  timeSinceLastReview: number; // milliseconds
} {
  if (!lastReviewTime) {
    return {
      canReview: true,
      timeSinceLastReview: Infinity,
    };
  }

  const now = new Date();
  const timeSinceLastReview = now.getTime() - lastReviewTime.getTime();

  return {
    canReview: timeSinceLastReview >= SPAM_CONFIG.MIN_TIME_BETWEEN_REVIEWS,
    timeSinceLastReview,
  };
}

/**
 * Detect suspicious patterns in user reviews
 */
export function detectSuspiciousPatterns(reviews: Array<{
  rating: number;
  comment?: string | null;
  createdAt: Date;
}>): SpamDetectionResult {
  const reasons: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  if (reviews.length === 0) {
    return {
      isSuspicious: false,
      reasons: [],
      riskLevel: 'low',
      action: 'allow',
    };
  }

  // Check 1: All same rating (5 stars pattern)
  const ratings = reviews.map(r => r.rating);
  const uniqueRatings = new Set(ratings);
  if (uniqueRatings.size === 1 && ratings[0] === 5) {
    reasons.push('All reviews are 5 stars');
    riskLevel = 'medium';
  }

  // Check 2: Very short or repetitive comments
  const comments = reviews
    .map(r => r.comment?.trim() || '')
    .filter(c => c.length > 0);
  
  if (comments.length > 0) {
    const avgCommentLength = comments.reduce((sum, c) => sum + c.length, 0) / comments.length;
    if (avgCommentLength < SPAM_CONFIG.MIN_COMMENT_LENGTH) {
      reasons.push('Comments are too short');
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
    }

    // Check for repetitive comments
    const uniqueComments = new Set(comments);
    if (uniqueComments.size < comments.length * 0.3) {
      reasons.push('Repetitive comments detected');
      riskLevel = 'high';
    }
  }

  // Check 3: Too many reviews in short time
  if (reviews.length >= 3) {
    const timeSpan = reviews[reviews.length - 1].createdAt.getTime() - reviews[0].createdAt.getTime();
    const hours = timeSpan / (1000 * 60 * 60);
    if (hours < 1 && reviews.length >= 5) {
      reasons.push('Too many reviews in short time');
      riskLevel = 'high';
    }
  }

  // Check 4: Rating distribution (all high or all low)
  const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  if (avgRating >= 4.8 && reviews.length >= 5) {
    reasons.push('Suspiciously high average rating');
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }
  if (avgRating <= 1.2 && reviews.length >= 5) {
    reasons.push('Suspiciously low average rating');
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }

  // Determine action
  let action: 'allow' | 'reduce_points' | 'block' = 'allow';
  if (riskLevel === 'high' || reasons.length >= 3) {
    action = 'block';
  } else if (riskLevel === 'medium' || reasons.length >= 2) {
    action = 'reduce_points';
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
    riskLevel,
    action,
  };
}

/**
 * Validate review before submission
 */
export function validateReviewSubmission(
  cooldownStatus: CooldownStatus,
  dailyLimitStatus: DailyLimitStatus,
  speedLimitStatus: { canReview: boolean; timeSinceLastReview: number },
  spamDetection: SpamDetectionResult
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Cooldown check
  if (!cooldownStatus.canReview) {
    errors.push(
      `You can review this place again in ${cooldownStatus.daysRemaining} days`
    );
  }

  // Daily limit check
  if (!dailyLimitStatus.canReview) {
    errors.push(
      `Daily review limit reached (${dailyLimitStatus.maxReviews} reviews/day)`
    );
  }

  // Speed limit check
  if (!speedLimitStatus.canReview) {
    const minutes = Math.ceil(
      (SPAM_CONFIG.MIN_TIME_BETWEEN_REVIEWS - speedLimitStatus.timeSinceLastReview) / (1000 * 60)
    );
    errors.push(`Please wait ${minutes} minutes between reviews`);
  }

  // Spam detection
  if (spamDetection.action === 'block') {
    errors.push('Review blocked due to suspicious patterns');
  } else if (spamDetection.action === 'reduce_points') {
    warnings.push('Review flagged for review - points may be reduced');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

