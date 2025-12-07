import { NextResponse } from 'next/server';
import { getReview } from '@/lib/walrus';
import { Review } from '@/types';

/**
 * GET /api/reviews/:walrusId
 * 
 * Fetches review details from Walrus by ID/CID
 * 
 * TODO: Replace with real Walrus API call
 */
export async function GET(
  request: Request,
  { params }: { params: { walrusId: string } }
) {
  try {
    const { walrusId } = params;

    if (!walrusId) {
      return NextResponse.json({ error: 'walrusId is required' }, { status: 400 });
    }

    // Fetch from Walrus
    // TODO: Replace with real Walrus API call
    const walrusReview = await getReview(walrusId);

    if (!walrusReview) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const review: Review = {
      id: walrusId,
      placeId: walrusReview.data.placeId,
      placeName: walrusReview.data.placeName,
      walletAddress: walrusReview.data.walletAddress,
      rating: walrusReview.data.rating,
      comment: walrusReview.data.comment,
      createdAt: walrusReview.data.createdAt,
      lat: walrusReview.data.lat,
      lng: walrusReview.data.lng,
      walrusId,
    };

    return NextResponse.json(review);
  } catch (error: any) {
    console.error('GET /api/reviews/:walrusId error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

