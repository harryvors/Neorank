/**
 * Point Calculation Service
 * Calculates points for reviews based on quality metrics
 */

import { ReviewQualityMetrics, ConsistencyMetrics, ReviewScoreCalculation } from '../../types/reputation';

const POINT_CONFIG = {
  BASE_POINTS: 50,
  COMMENT_BONUS: 20, // 100+ characters
  PHOTO_BONUS: 30,
  AMENITY_BONUS: 10, // All amenities filled
  CONSISTENCY_BONUS: 15, // High consistency score
  VERIFIED_BONUS: 25, // GPS verified visit
  MIN_COMMENT_LENGTH: 100,
  MAX_DAILY_POINTS: 300,
} as const;

/**
 * Calculate base points and quality bonuses
 */
export function calculateBasePoints(metrics: ReviewQualityMetrics): {
  basePoints: number;
  commentBonus: number;
  photoBonus: number;
  amenityBonus: number;
  verifiedBonus: number;
} {
  let basePoints = POINT_CONFIG.BASE_POINTS;
  let commentBonus = 0;
  let photoBonus = 0;
  let amenityBonus = 0;
  let verifiedBonus = 0;

  // Comment bonus
  if (metrics.commentLength >= POINT_CONFIG.MIN_COMMENT_LENGTH) {
    commentBonus = POINT_CONFIG.COMMENT_BONUS;
  }

  // Photo bonus
  if (metrics.hasPhoto) {
    photoBonus = POINT_CONFIG.PHOTO_BONUS;
  }

  // Amenity bonus (all filled)
  if (metrics.amenitiesFilled === metrics.totalAmenities && metrics.totalAmenities > 0) {
    amenityBonus = POINT_CONFIG.AMENITY_BONUS;
  }

  // Verified visit bonus
  if (metrics.isVerifiedVisit && metrics.gpsDistance !== undefined && metrics.gpsDistance <= 150) {
    verifiedBonus = POINT_CONFIG.VERIFIED_BONUS;
  }

  return {
    basePoints,
    commentBonus,
    photoBonus,
    amenityBonus,
    verifiedBonus,
  };
}

/**
 * Calculate consistency score (0-100)
 * Based on how close user's rating is to place average
 */
export function calculateConsistencyScore(metrics: ConsistencyMetrics): number {
  const { userRating, placeAverageRating } = metrics;
  
  // Calculate deviation (0-4 scale, converted to 0-100)
  const deviation = Math.abs(userRating - placeAverageRating);
  
  // Consistency score: 100 - (deviation * 25)
  // Perfect match (0 deviation) = 100
  // 1 star difference = 75
  // 2 star difference = 50
  // 3 star difference = 25
  // 4+ star difference = 0
  const consistencyScore = Math.max(0, Math.min(100, 100 - (deviation * 25)));
  
  return Math.round(consistencyScore * 100) / 100;
}

/**
 * Calculate consistency bonus points
 */
export function calculateConsistencyBonus(consistencyScore: number): number {
  // Only give bonus if consistency is high (>= 75)
  if (consistencyScore >= 75) {
    return POINT_CONFIG.CONSISTENCY_BONUS;
  }
  return 0;
}

/**
 * Calculate quality score (0-100)
 * Based on review completeness and verification
 */
export function calculateQualityScore(metrics: ReviewQualityMetrics): number {
  let score = 0;
  const maxScore = 100;

  // Comment quality (0-30 points)
  if (metrics.commentLength > 0) {
    score += Math.min(30, (metrics.commentLength / 10)); // Up to 30 points for 100+ chars
  }

  // Photo (0-25 points)
  if (metrics.hasPhoto) {
    score += 25;
  }

  // Amenities (0-20 points)
  if (metrics.totalAmenities > 0) {
    score += (metrics.amenitiesFilled / metrics.totalAmenities) * 20;
  }

  // Verification (0-25 points)
  if (metrics.isVerifiedVisit) {
    score += 25;
  }

  return Math.min(maxScore, Math.round(score));
}

/**
 * Apply daily limit multiplier
 * First 3 reviews: 1.0x, 4-5: 0.5x, 6+: 0.0x
 */
export function applyDailyLimitMultiplier(
  totalPoints: number,
  dailyLimitIndex: number
): { points: number; multiplier: number } {
  let multiplier = 1.0;

  if (dailyLimitIndex <= 3) {
    multiplier = 1.0;
  } else if (dailyLimitIndex <= 5) {
    multiplier = 0.5;
  } else {
    multiplier = 0.0;
  }

  const finalPoints = Math.round(totalPoints * multiplier);
  return {
    points: finalPoints,
    multiplier,
  };
}

/**
 * Main function: Calculate complete review score
 */
export function calculateReviewScore(
  qualityMetrics: ReviewQualityMetrics,
  consistencyMetrics: ConsistencyMetrics,
  dailyLimitIndex: number
): ReviewScoreCalculation {
  // Calculate base points and bonuses
  const {
    basePoints,
    commentBonus,
    photoBonus,
    amenityBonus,
    verifiedBonus,
  } = calculateBasePoints(qualityMetrics);

  // Calculate consistency
  const consistencyScore = calculateConsistencyScore(consistencyMetrics);
  const consistencyBonus = calculateConsistencyBonus(consistencyScore);

  // Calculate quality score
  const qualityScore = calculateQualityScore(qualityMetrics);

  // Total before daily limit
  const totalBeforeLimit = basePoints + commentBonus + photoBonus + amenityBonus + consistencyBonus + verifiedBonus;

  // Apply daily limit multiplier
  const { points: finalPoints, multiplier } = applyDailyLimitMultiplier(totalBeforeLimit, dailyLimitIndex);

  return {
    basePoints,
    commentBonus,
    photoBonus,
    amenityBonus,
    consistencyBonus,
    verifiedBonus,
    totalPoints: finalPoints,
    qualityScore,
    consistencyScore,
    dailyLimitIndex,
    pointsMultiplier: multiplier,
  };
}

/**
 * Calculate weekly bonus points
 */
export function calculateWeeklyBonus(
  streakDays: number,
  weeklyReviewCount: number
): number {
  let bonus = 0;

  // 7 day streak bonus
  if (streakDays >= 7) {
    bonus += 100;
  }

  // 20+ reviews per week bonus
  if (weeklyReviewCount >= 20) {
    bonus += 50;
  }

  return bonus;
}

