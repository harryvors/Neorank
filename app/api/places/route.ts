import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PlaceIndex } from '@/types';

/**
 * GET /api/places?minLat=&maxLat=&minLng=&maxLng=
 * 
 * Returns places within the bounding box for map display
 * 
 * TODO: Add pagination if needed
 * TODO: Add caching for better performance
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minLat = parseFloat(searchParams.get('minLat') || '');
    const maxLat = parseFloat(searchParams.get('maxLat') || '');
    const minLng = parseFloat(searchParams.get('minLng') || '');
    const maxLng = parseFloat(searchParams.get('maxLng') || '');

    // Validation
    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLng) || isNaN(maxLng)) {
      return NextResponse.json(
        { error: 'Missing or invalid bounding box parameters: minLat, maxLat, minLng, maxLng' },
        { status: 400 }
      );
    }

    // Query places within bounding box
    const places = await prisma.placeIndex.findMany({
      where: {
        lat: {
          gte: minLat,
          lte: maxLat,
        },
        lng: {
          gte: minLng,
          lte: maxLng,
        },
      },
      orderBy: {
        reviewCount: 'desc', // Show places with more reviews first
      },
      take: 100, // Limit results
    });

    const response: PlaceIndex[] = places.map(place => ({
      placeId: place.placeId,
      placeName: place.placeName,
      lat: place.lat,
      lng: place.lng,
      avgRating: place.avgRating,
      reviewCount: place.reviewCount,
      lastWalrusId: place.lastWalrusId || undefined,
    }));

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/places error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

