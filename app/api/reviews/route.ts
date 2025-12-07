import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadReview } from '@/lib/walrus';
import { CreateReviewRequest, CreateReviewResponse } from '@/types';

/**
 * POST /api/reviews
 * 
 * Creates a new review:
 * 1. Receives review data with Sui transaction digest (already signed by user)
 * 2. Uploads review data + transaction digest to Walrus
 * 3. Stores review index in database
 * 4. Updates place index (avgRating, reviewCount)
 * 
 * Note: Sui transaction signing happens on the frontend before this call
 */
export async function POST(request: Request) {
  try {
    const body: CreateReviewRequest = await request.json();
    const { placeId, placeName, lat, lng, rating, comment, walletAddress, transactionDigest } = body;

    // Validation
    if (!placeId || !placeName || !walletAddress || !rating || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: placeId, placeName, walletAddress, rating, lat, lng' },
        { status: 400 }
      );
    }

    if (!transactionDigest) {
      return NextResponse.json(
        { error: 'Missing transactionDigest. Review must be signed on-chain first.' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // 1. Upload review to Walrus (with transaction digest)
    // TODO: Replace with real Walrus API call
    const walrusResponse = await uploadReview({
      placeId,
      placeName,
      walletAddress,
      rating,
      comment: comment || '',
      coordinates: [lat, lng],
      timestamp: Date.now(),
      transactionDigest, // Include Sui transaction digest
    });

    if (!walrusResponse.success) {
      return NextResponse.json({ error: 'Failed to upload to Walrus' }, { status: 500 });
    }

    const walrusId = walrusResponse.walrusId;

    // 2. Store review index in database
    const reviewIndex = await prisma.reviewIndex.create({
      data: {
        placeId,
        placeName,
        walletAddress,
        walrusId,
        rating,
        lat,
        lng,
      },
    });

    // 3. Update or create place index
    const existingPlace = await prisma.placeIndex.findUnique({
      where: { placeId },
    });

    if (existingPlace) {
      // Update existing place
      const newReviewCount = existingPlace.reviewCount + 1;
      const newAvgRating = ((existingPlace.avgRating * existingPlace.reviewCount) + rating) / newReviewCount;

      await prisma.placeIndex.update({
        where: { placeId },
        data: {
          avgRating: parseFloat(newAvgRating.toFixed(2)),
          reviewCount: newReviewCount,
          lastWalrusId: walrusId,
        },
      });
    } else {
      // Create new place index
      await prisma.placeIndex.create({
        data: {
          placeId,
          placeName,
          lat,
          lng,
          avgRating: rating,
          reviewCount: 1,
          lastWalrusId: walrusId,
        },
      });
    }

    const response: CreateReviewResponse = {
      success: true,
      review: {
        id: reviewIndex.id,
        placeId,
        placeName,
        walletAddress,
        rating,
        comment: comment || '',
        createdAt: reviewIndex.createdAt.toISOString(),
        lat,
        lng,
        walrusId,
      },
      walrusId,
      transactionDigest, // Return the transaction digest
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/reviews error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
