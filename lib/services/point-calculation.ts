/**
 * Point Calculation Service
 * 
 * Handles all point calculation logic for reviews:
 * - Base points
 * - Quality bonuses
 * - Consistency scoring
 * - Geo validation
 */

export interface ReviewData {
  comment?: string;
  commentLength: number;
  hasPhoto: boolean;
  amenities: Record<string, number>;
  isVerifiedVisit: boolean;
  gpsDistance?: number; // meters
  rating: number;
}

export interface UserStats {
  totalReviews: number;
  consistencyScore: number;
  dailyReviewCount: number; // Today's review count (1-5)
  streakDays: number;
}

export interface PointCalculationResult {
  basePoints: number;
  commentBonus: number;
  photoBonus: number;
  amenityBonus: number;
  consistencyBonus: number;
  verifiedBonus: number;
  dailyLimitMultiplier: number;
  totalPoints: number;
  qualityScore: number;
  consistencyScore: number;
}

/**
 * Calculate daily points for a review
 */
export function calculateDailyPoints(
  review: ReviewData,
  userStats: UserStats
): PointCalculationResult {
  // Base points
  const basePoints = 50;

  // Quality bonuses
  const commentBonus = calculateCommentBonus(review.commentLength);
  const photoBonus = review.hasPhoto ? 30 : 0;
  const amenityBonus = calculateAmenityBonus(review.amenities);
  const consistencyBonus = calculateConsistencyBonus(userStats.consistencyScore);
  const verifiedBonus = review.isVerifiedVisit ? 25 : 0;

  // Daily limit multiplier
  const dailyLimitMultiplier = getDailyLimitMultiplier(userStats.dailyReviewCount);

  // Calculate totals
  const totalBonuses = commentBonus + photoBonus + amenityBonus + consistencyBonus + verifiedBonus;
  const totalPoints = Math.round((basePoints + totalBonuses) * dailyLimitMultiplier);

  // Quality score (0-100)
  const qualityScore = calculateQualityScore(review, userStats);

  // Consistency score update
  const consistencyScore = userStats.consistencyScore;

  return {
    basePoints,
    commentBonus,
    photoBonus,
    amenityBonus,
    consistencyBonus,
    verifiedBonus,
    dailyLimitMultiplier,
    totalPoints,
    qualityScore,
    consistencyScore,
  };
}

/**
 * Calculate comment bonus based on length
 */
function calculateCommentBonus(commentLength: number): number {
  if (commentLength >= 100) return 20;
  if (commentLength >= 50) return 10;
  if (commentLength >= 20) return 5;
  return 0;
}

/**
 * Calculate amenity bonus
 * +10 if all amenities are filled (7 amenities)
 */
function calculateAmenityBonus(amenities: Record<string, number>): number {
  const amenityKeys = ['wifi', 'outlet', 'comfort', 'hygiene', 'quality', 'noise', 'service'];
  const filledCount = amenityKeys.filter(key => amenities[key] !== undefined && amenities[key] > 0).length;
  
  if (filledCount === amenityKeys.length) return 10;
  if (filledCount >= 5) return 5;
  return 0;
}

/**
 * Calculate consistency bonus
 * Higher consistency = more bonus
 */
function calculateConsistencyScore(consistencyScore: number): number {
  if (consistencyScore >= 80) return 15;
  if (consistencyScore >= 60) return 10;
  if (consistencyScore >= 40) return 5;
  return 0;
}

/**
 * Get daily limit multiplier
 * First 3 reviews: 1.0, 4-5: 0.5, 6+: 0.0
 */
function getDailyLimitMultiplier(dailyReviewCount: number): number {
  if (dailyReviewCount <= 3) return 1.0;
  if (dailyReviewCount <= 5) return 0.5;
  return 0.0;
}

/**
 * Calculate overall quality score (0-100)
 */
function calculateQualityScore(review: ReviewData, userStats: UserStats): number {
  let score = 0;

  // Comment quality (0-30 points)
  if (review.commentLength >= 100) score += 30;
  else if (review.commentLength >= 50) score += 20;
  else if (review.commentLength >= 20) score += 10;

  // Photo (0-20 points)
  if (review.hasPhoto) score += 20;

  // Amenities (0-20 points)
  const amenityKeys = ['wifi', 'outlet', 'comfort', 'hygiene', 'quality', 'noise', 'service'];
  const filledCount = amenityKeys.filter(key => review.amenities[key] !== undefined).length;
  score += (filledCount / amenityKeys.length) * 20;

  // Verified visit (0-15 points)
  if (review.isVerifiedVisit) score += 15;

  // Consistency (0-15 points)
  score += (userStats.consistencyScore / 100) * 15;

  return Math.min(100, Math.round(score));
}

/**
 * Calculate consistency bonus (for point calculation)
 */
function calculateConsistencyBonus(consistencyScore: number): number {
  if (consistencyScore >= 80) return 15;
  if (consistencyScore >= 60) return 10;
  if (consistencyScore >= 40) return 5;
  return 0;
}

/**
 * Validate GPS coordinates
 * Returns true if user is within 150 meters of the place
 */
export function validateGeoLocation(
  userLat: number,
  userLng: number,
  placeLat: number,
  placeLng: number,
  maxDistanceMeters: number = 150
): { isValid: boolean; distance: number } {
  const distance = calculateDistance(userLat, userLng, placeLat, placeLng);
  return {
    isValid: distance <= maxDistanceMeters,
    distance,
  };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate weekly bonus points
 */
export function calculateWeeklyBonus(streakDays: number, weeklyReviewCount: number): number {
  let bonus = 0;

  // 7 day streak bonus
  if (streakDays >= 7) bonus += 100;

  // 20+ reviews per week bonus
  if (weeklyReviewCount >= 20) bonus += 50;

  return bonus;
}

