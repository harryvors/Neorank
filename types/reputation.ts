/**
 * Reputation System Types
 */

export interface ReviewQualityMetrics {
  commentLength: number;
  hasPhoto: boolean;
  amenitiesFilled: number;
  totalAmenities: number;
  isVerifiedVisit: boolean;
  gpsDistance?: number; // meters
}

export interface ConsistencyMetrics {
  userRating: number;
  placeAverageRating: number;
  deviation: number;
  consistencyScore: number; // 0-100
}

export interface ReviewScoreCalculation {
  basePoints: number;
  commentBonus: number;
  photoBonus: number;
  amenityBonus: number;
  consistencyBonus: number;
  verifiedBonus: number;
  totalPoints: number;
  qualityScore: number; // 0-100
  consistencyScore: number; // 0-100
  dailyLimitIndex: number; // 1-5
  pointsMultiplier: number; // 1.0, 0.5, 0.0
}

export interface UserStats {
  walletAddress: string;
  totalPoints: number;
  currentTier: Tier;
  reputationScore: number; // 0-100
  consistencyScore: number; // 0-100
  streakDays: number;
  lastReviewDate?: Date;
  todayReviewCount: number;
  todayTotalPoints: number;
}

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface TierConfig {
  name: Tier;
  minPoints: number;
  maxPoints?: number;
  discountMin: number;
  discountMax: number;
  benefits: string[];
}

export interface DailyLimitStatus {
  canReview: boolean;
  reviewCount: number;
  maxReviews: number;
  pointsMultiplier: number;
  nextReviewIndex: number; // 1-5
  resetAt: Date; // Next day reset time
}

export interface CooldownStatus {
  canReview: boolean;
  lastReviewDate?: Date;
  daysRemaining: number;
  cooldownDays: number; // 30
}

export interface SpamDetectionResult {
  isSuspicious: boolean;
  reasons: string[];
  riskLevel: 'low' | 'medium' | 'high';
  action: 'allow' | 'reduce_points' | 'block';
}

export interface RewardClaim {
  rewardId: string;
  type: 'discount' | 'free_drink' | 'reservation' | 'event' | 'nft';
  title: string;
  value: any;
  costPoints: number;
}

export interface AchievementData {
  type: string;
  title: string;
  description: string;
  nftTokenId?: string;
}

