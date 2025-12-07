/**
 * POST /api/reviews/check-validity
 * 
 * Check if a user can review a place (cooldown, daily limit, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkCooldown, checkDailyLimit, checkSpeedLimit, detectSuspiciousPatterns } from '../../../../lib/services/anti-spam';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, placeId } = body;

    if (!walletAddress || !placeId) {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress or placeId' },
        { status: 400 }
      );
    }

    // Run all checks
    const [cooldownCheck, dailyLimitCheck, speedCheck, patternCheck] = await Promise.all([
      checkCooldown(walletAddress, placeId),
      checkDailyLimit(walletAddress),
      checkSpeedLimit(walletAddress),
      detectSuspiciousPatterns(walletAddress),
    ]);

    const canReview = 
      cooldownCheck.canReview && 
      dailyLimitCheck.canReview && 
      !speedCheck.isTooFast;

    return NextResponse.json({
      success: true,
      canReview,
      checks: {
        cooldown: {
          canReview: cooldownCheck.canReview,
          daysRemaining: cooldownCheck.daysRemaining,
        },
        dailyLimit: {
          canReview: dailyLimitCheck.canReview,
          reviewsToday: dailyLimitCheck.reviewsToday,
          maxReviews: dailyLimitCheck.maxReviews,
          nextReviewIndex: dailyLimitCheck.nextReviewIndex,
        },
        speedLimit: {
          isTooFast: speedCheck.isTooFast,
          lastReviewTime: speedCheck.lastReviewTime,
        },
        suspiciousPatterns: {
          isSuspicious: patternCheck.isSuspicious,
          riskScore: patternCheck.riskScore,
          reasons: patternCheck.reasons,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/reviews/check-validity:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

