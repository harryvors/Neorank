/**
 * Review Flow Service
 * 
 * Main service that orchestrates the entire review creation process:
 * - Validation checks
 * - Point calculation
 * - Database updates
 * - Reputation updates
 * - Tier updates
 */

import { PrismaClient } from '@prisma/client';
import { calculateDailyPoints, validateGeoLocation, ReviewData, UserStats } from './point-calculation';
import {
  checkCooldown,
  checkDailyLimit,
  checkSpeedLimit,
  detectSuspiciousPatterns,
  updatePlaceCooldown,
  updateDailyLimit,
} from './anti-spam';
import { updateReputation, syncReputationToChain } from './reputation';
import { updateUserTier, checkReviewCountAchievement } from './tier-reward';
import { uploadReview } from '../walrus';
import { submitReviewTransaction } from '../sui-transaction';

const prisma = new PrismaClient();

export interface CreateReviewRequest {
  walletAddress: string;
  placeId: string;
  placeName: string;
  rating: number;
  comment?: string;
  amenities: Record<string, number>;
  coordinates: { lat: number; lng: number };
  address?: string;
  // GPS verification (optional)
  gpsLatitude?: number;
  gpsLongitude?: number;
  // Photo (optional - URL or hash)
  photoUrl?: string;
}

export interface CreateReviewResult {
  success: boolean;
  review?: {
    walrusId: string;
    transactionDigest?: string;
    pointsEarned: number;
    totalPoints: number;
    newTier?: string;
  };
  error?: string;
  warnings?: string[];
}

/**
 * Main function to create a review with full validation
 */
export async function createReviewWithValidation(
  request: CreateReviewRequest,
  signAndExecute: (transaction: any) => Promise<any>
): Promise<CreateReviewResult> {
  const warnings: string[] = [];

  try {
    // Step 1: Anti-spam checks
    const cooldownCheck = await checkCooldown(request.walletAddress, request.placeId);
    if (!cooldownCheck.canReview) {
      return {
        success: false,
        error: `You can review this place again in ${cooldownCheck.daysRemaining} days`,
      };
    }

    const dailyLimitCheck = await checkDailyLimit(request.walletAddress);
    if (!dailyLimitCheck.canReview) {
      return {
        success: false,
        error: 'Daily review limit reached (5 reviews per day)',
      };
    }

    const speedCheck = await checkSpeedLimit(request.walletAddress);
    if (speedCheck.isTooFast) {
      warnings.push('Reviews submitted too quickly may receive reduced points');
    }

    // Step 2: Suspicious pattern detection
    const patternCheck = await detectSuspiciousPatterns(request.walletAddress);
    if (patternCheck.isSuspicious) {
      warnings.push(`Suspicious patterns detected: ${patternCheck.reasons.join(', ')}`);
    }

    // Step 3: GPS validation
    let isVerifiedVisit = false;
    let gpsDistance: number | undefined;

    if (request.gpsLatitude && request.gpsLongitude) {
      const geoValidation = validateGeoLocation(
        request.gpsLatitude,
        request.gpsLongitude,
        request.coordinates.lat,
        request.coordinates.lng,
        150 // 150 meters
      );

      isVerifiedVisit = geoValidation.isValid;
      gpsDistance = geoValidation.distance;

      if (!isVerifiedVisit) {
        warnings.push('GPS location is more than 150m away from place location');
      }
    }

    // Step 4: Get user stats
    const user = await prisma.user.findUnique({
      where: { walletAddress: request.walletAddress },
      include: {
        reviews: {
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        },
      },
    });

    if (!user) {
      // Create user if doesn't exist
      await prisma.user.create({
        data: {
          walletAddress: request.walletAddress,
          totalPoints: 0,
          currentTier: 'Bronze',
          reputationScore: 50,
          consistencyScore: 50,
        },
      });
    }

    const userStats: UserStats = {
      totalReviews: user?.reviews.length || 0,
      consistencyScore: user?.consistencyScore || 50,
      dailyReviewCount: dailyLimitCheck.nextReviewIndex,
      streakDays: user?.streakDays || 0,
    };

    // Step 5: Calculate points
    const reviewData: ReviewData = {
      comment: request.comment,
      commentLength: request.comment?.length || 0,
      hasPhoto: !!request.photoUrl,
      amenities: request.amenities,
      isVerifiedVisit,
      gpsDistance,
      rating: request.rating,
    };

    const pointResult = calculateDailyPoints(reviewData, userStats);

    // Step 6: Sign Sui transaction
    console.log('Signing Sui transaction...');
    const transactionDigest = await submitReviewTransaction(
      {
        placeId: request.placeId,
        placeName: request.placeName,
        walletAddress: request.walletAddress,
        rating: request.rating,
        comment: request.comment || '',
        coordinates: [request.coordinates.lat, request.coordinates.lng],
        address: request.address,
        timestamp: Date.now(),
      },
      signAndExecute
    );

    // Step 7: Upload to Walrus
    console.log('Uploading review to Walrus...');
    const walrusResponse = await uploadReview({
      placeId: request.placeId,
      placeName: request.placeName,
      walletAddress: request.walletAddress,
      rating: request.rating,
      comment: request.comment || '',
      amenities: request.amenities,
      coordinates: [request.coordinates.lat, request.coordinates.lng],
      address: request.address,
      timestamp: Date.now(),
      transactionDigest,
      isVerifiedVisit,
      gpsDistance,
      photoUrl: request.photoUrl,
    });

    // Step 8: Save to database
    const review = await prisma.review.create({
      data: {
        walletAddress: request.walletAddress,
        walrusId: walrusResponse.walrusId,
        placeId: request.placeId,
        placeName: request.placeName,
        rating: request.rating,
        comment: request.comment,
        commentLength: request.comment?.length || 0,
        hasPhoto: !!request.photoUrl,
        amenities: request.amenities,
        coordinates: request.coordinates,
        address: request.address,
        isVerifiedVisit,
        gpsLatitude: request.gpsLatitude,
        gpsLongitude: request.gpsLongitude,
        gpsDistance,
        transactionDigest,
      },
    });

    // Step 9: Save review score
    await prisma.reviewScore.create({
      data: {
        walletAddress: request.walletAddress,
        walrusId: walrusResponse.walrusId,
        basePoints: pointResult.basePoints,
        commentBonus: pointResult.commentBonus,
        photoBonus: pointResult.photoBonus,
        amenityBonus: pointResult.amenityBonus,
        consistencyBonus: pointResult.consistencyBonus,
        verifiedBonus: pointResult.verifiedBonus,
        totalPoints: pointResult.totalPoints,
        qualityScore: pointResult.qualityScore,
        consistencyScore: pointResult.consistencyScore,
        dailyLimitIndex: dailyLimitCheck.nextReviewIndex,
        pointsMultiplier: pointResult.dailyLimitMultiplier,
      },
    });

    // Step 10: Update user points and tier
    await prisma.user.update({
      where: { walletAddress: request.walletAddress },
      data: {
        totalPoints: {
          increment: pointResult.totalPoints,
        },
        lastReviewDate: new Date(),
      },
    });

    // Update daily limit
    await updateDailyLimit(request.walletAddress, pointResult.totalPoints);

    // Update place cooldown
    await updatePlaceCooldown(request.walletAddress, request.placeId);

    // Update tier
    const newTier = await updateUserTier(request.walletAddress);

    // Update reputation
    await updateReputation(request.walletAddress);

    // Check achievements
    const updatedUser = await prisma.user.findUnique({
      where: { walletAddress: request.walletAddress },
      include: {
        reviews: true,
      },
    });

    if (updatedUser) {
      await checkReviewCountAchievement(request.walletAddress, updatedUser.reviews.length);
    }

    // Step 11: Update ReviewIndex
    await prisma.reviewIndex.create({
      data: {
        placeId: request.placeId,
        placeName: request.placeName,
        walletAddress: request.walletAddress,
        walrusId: walrusResponse.walrusId,
        rating: request.rating,
        lat: request.coordinates.lat,
        lng: request.coordinates.lng,
      },
    });

    // Step 12: Update PlaceIndex
    await updatePlaceIndex(request.placeId, request.placeName, request.rating);

    const finalUser = await prisma.user.findUnique({
      where: { walletAddress: request.walletAddress },
    });

    return {
      success: true,
      review: {
        walrusId: walrusResponse.walrusId,
        transactionDigest,
        pointsEarned: pointResult.totalPoints,
        totalPoints: finalUser?.totalPoints || 0,
        newTier: newTier !== user?.currentTier ? newTier : undefined,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: any) {
    console.error('Error creating review:', error);
    return {
      success: false,
      error: error.message || 'Failed to create review',
    };
  }
}

/**
 * Update PlaceIndex with new review
 */
async function updatePlaceIndex(placeId: string, placeName: string, rating: number) {
  const placeReviews = await prisma.reviewIndex.findMany({
    where: { placeId },
  });

  const avgRating =
    placeReviews.reduce((sum, r) => sum + r.rating, 0) / placeReviews.length;

  await prisma.placeIndex.upsert({
    where: { placeId },
    update: {
      avgRating,
      reviewCount: placeReviews.length,
      updatedAt: new Date(),
    },
    create: {
      placeId,
      placeName,
      lat: 0, // Will be updated from first review
      lng: 0,
      avgRating,
      reviewCount: 1,
    },
  });
}

