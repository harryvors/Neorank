/**
 * POST /api/reviews/create
 * 
 * Create a new review with full validation and point calculation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createReviewWithValidation, CreateReviewRequest } from '../../../../lib/services/review-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['walletAddress', 'placeId', 'placeName', 'rating', 'amenities', 'coordinates'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Note: In a real implementation, you would get signAndExecute from the client
    // For now, we'll need to handle this differently - the client should sign first
    // and send the transaction digest
    
    // This is a simplified version - in production, the client should:
    // 1. Sign the transaction on the frontend
    // 2. Send the signed transaction digest to this endpoint
    
    const reviewRequest: CreateReviewRequest = {
      walletAddress: body.walletAddress,
      placeId: body.placeId,
      placeName: body.placeName,
      rating: body.rating,
      comment: body.comment,
      amenities: body.amenities,
      coordinates: body.coordinates,
      address: body.address,
      gpsLatitude: body.gpsLatitude,
      gpsLongitude: body.gpsLongitude,
      photoUrl: body.photoUrl,
    };

    // Mock signAndExecute function - in production, this should come from the client
    const mockSignAndExecute = async (transaction: any) => {
      // This should be replaced with actual wallet signing on the client side
      console.log('[MOCK] Signing transaction:', transaction);
      return { digest: `0x${Math.random().toString(16).substring(2, 66)}` };
    };

    const result = await createReviewWithValidation(reviewRequest, mockSignAndExecute);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/reviews/create:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

