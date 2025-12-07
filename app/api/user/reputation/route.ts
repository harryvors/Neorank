/**
 * GET /api/user/reputation
 * 
 * Get user reputation data
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeReputation, syncReputationToChain } from '../../../../lib/services/reputation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const syncToChain = searchParams.get('syncToChain') === 'true';

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress parameter' },
        { status: 400 }
      );
    }

    const reputation = await computeReputation(walletAddress);

    let syncResult = null;
    if (syncToChain) {
      syncResult = await syncReputationToChain(walletAddress);
    }

    return NextResponse.json({
      success: true,
      reputation,
      syncResult,
    });
  } catch (error: any) {
    console.error('Error in GET /api/user/reputation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

