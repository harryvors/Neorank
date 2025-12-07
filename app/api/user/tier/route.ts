/**
 * GET /api/user/tier
 * 
 * Get user tier information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTierInfo } from '../../../../lib/services/tier-reward';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress parameter' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const tierInfo = await getTierInfo(user.currentTier as any);

    return NextResponse.json({
      success: true,
      tier: {
        name: user.currentTier,
        info: tierInfo,
        totalPoints: user.totalPoints,
        pointsToNextTier: calculatePointsToNextTier(user.totalPoints, tierInfo),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/user/tier:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculatePointsToNextTier(currentPoints: number, currentTier: any): number | null {
  const tierThresholds = {
    Bronze: 500,
    Silver: 1500,
    Gold: 3000,
    Platinum: null, // No next tier
  };

  const nextThreshold = tierThresholds[currentTier.name as keyof typeof tierThresholds];
  if (nextThreshold === null) return null;

  return Math.max(0, nextThreshold - currentPoints);
}

