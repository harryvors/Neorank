/**
 * POST /api/reviews/validate
 * Validate review before submission (anti-spam checks)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import {
  checkCooldown,
  checkDailyLimit,
  checkSpeedLimit,
  detectSuspiciousPatterns,
  validateReviewSubmission,
} from '../../../../lib/scoring/anti-spam';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, placeId, coordinates } = body;

    if (!walletAddress || !placeId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress,
          totalPoints: 0,
          currentTier: 'Bronze',
          reputationScore: 50.0,
          consistencyScore: 50.0,
        },
      });
    }

    // Get user's recent reviews for this place
    const lastPlaceReview = await prisma.review.findFirst({
      where: {
        walletAddress,
        placeId,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get today's reviews
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReviews = await prisma.review.findMany({
      where: {
        walletAddress,
        createdAt: { gte: today },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get daily limit
    const dailyLimit = await prisma.dailyLimit.findUnique({
      where: {
        walletAddress_date: {
          walletAddress,
          date: today,
        },
      },
    });

    // Check cooldown
    const cooldownStatus = checkCooldown(
      lastPlaceReview?.createdAt || null,
      30
    );

    // Check daily limit
    const dailyLimitStatus = checkDailyLimit(
      dailyLimit?.reviewCount || 0,
      5
    );

    // Check speed limit
    const lastReview = todayReviews[0];
    const speedLimitStatus = checkSpeedLimit(
      lastReview?.createdAt || null
    );

    // Get user's recent reviews for pattern detection
    const recentReviews = await prisma.review.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        rating: true,
        comment: true,
        createdAt: true,
      },
    });

    // Detect suspicious patterns
    const spamDetection = detectSuspiciousPatterns(recentReviews);

    // Validate submission
    const validation = validateReviewSubmission(
      cooldownStatus,
      dailyLimitStatus,
      speedLimitStatus,
      spamDetection
    );

    return NextResponse.json({
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      cooldownStatus,
      dailyLimitStatus,
      speedLimitStatus,
      spamDetection,
    });
  } catch (error) {
    console.error('Error validating review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

