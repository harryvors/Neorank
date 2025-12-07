/**
 * Consistency Score Service
 * 
 * Calculates how consistent a user's ratings are with the community average
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calculate consistency score for a user
 * Compares user's ratings with place averages
 */
export async function calculateConsistencyScore(
  walletAddress: string
): Promise<number> {
  const userReviews = await prisma.review.findMany({
    where: { walletAddress },
    take: 50, // Last 50 reviews
    include: {
      // We need place averages - this will require a join or separate query
    },
  });

  if (userReviews.length === 0) {
    return 50; // Default score
  }

  // Get place averages for each reviewed place
  const placeIds = [...new Set(userReviews.map(r => r.placeId))];
  
  const placeAverages = await prisma.reviewIndex.groupBy({
    by: ['placeId'],
    where: {
      placeId: { in: placeIds },
    },
    _avg: {
      rating: true,
    },
    _count: {
      rating: true,
    },
  });

  const placeAvgMap = new Map(
    placeAverages.map(p => [p.placeId, p._avg.rating || 0])
  );

  // Calculate differences
  let totalDifference = 0;
  let validComparisons = 0;

  for (const review of userReviews) {
    const placeAvg = placeAvgMap.get(review.placeId);
    if (placeAvg && placeAvg > 0) {
      const difference = Math.abs(review.rating - placeAvg);
      totalDifference += difference;
      validComparisons++;
    }
  }

  if (validComparisons === 0) {
    return 50; // Default
  }

  const avgDifference = totalDifference / validComparisons;

  // Convert difference to score (0-100)
  // Lower difference = higher score
  // Max difference is 4 (1 vs 5), so we normalize
  const maxDifference = 4;
  const normalizedDifference = Math.min(1, avgDifference / maxDifference);
  const consistencyScore = (1 - normalizedDifference) * 100;

  return Math.round(consistencyScore);
}

/**
 * Calculate consistency score for a single review
 * Used when a new review is submitted
 */
export async function calculateReviewConsistency(
  walletAddress: string,
  placeId: string,
  rating: number
): Promise<number> {
  // Get place average
  const placeReviews = await prisma.reviewIndex.findMany({
    where: { placeId },
  });

  if (placeReviews.length === 0) {
    return 50; // No comparison available
  }

  const avgRating = placeReviews.reduce((sum, r) => sum + r.rating, 0) / placeReviews.length;
  const difference = Math.abs(rating - avgRating);

  // Convert to score
  const maxDifference = 4;
  const normalizedDifference = Math.min(1, difference / maxDifference);
  const consistencyScore = (1 - normalizedDifference) * 100;

  return Math.round(consistencyScore);
}

