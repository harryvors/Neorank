/**
 * POST /api/rewards/claim
 * 
 * Claim a reward
 */

import { NextRequest, NextResponse } from 'next/server';
import { claimReward } from '../../../../lib/services/tier-reward';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, rewardId } = body;

    if (!walletAddress || !rewardId) {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress or rewardId' },
        { status: 400 }
      );
    }

    const result = await claimReward(walletAddress, rewardId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/rewards/claim:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rewards
 * 
 * Get available rewards for a user
 */

import { getAvailableRewards } from '../../../../lib/services/tier-reward';

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

    const rewards = await getAvailableRewards(walletAddress);

    return NextResponse.json({
      success: true,
      rewards,
    });
  } catch (error: any) {
    console.error('Error in GET /api/rewards:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

