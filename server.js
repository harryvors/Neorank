/**
 * Express API Server
 * 
 * Simple Express server to handle API routes
 * Run this alongside Vite dev server
 * 
 * Usage: node server.js
 */

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Import walrus with error handling
let uploadReview;
try {
  const walrusModule = await import('./lib/walrus.js');
  uploadReview = walrusModule.uploadReview;
  console.log('✅ Walrus module loaded successfully');
} catch (error) {
  console.warn('⚠️ Could not import walrus module, using mock:', error.message);
  // Mock fallback
  uploadReview = async (payload) => {
    console.log('[MOCK] Uploading to Walrus:', payload.placeId);
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      walrusId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      success: true,
    };
  };
}

const app = express();
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
const PORT = 3001;

app.use(cors());
app.use(express.json());

// POST /api/reviews
app.post('/api/reviews', async (req, res) => {
  try {
    const { placeId, placeName, lat, lng, rating, comment, walletAddress, transactionDigest } = req.body;

    // Validation
    if (!placeId || !placeName || !walletAddress || !rating || lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: placeId, placeName, walletAddress, rating, lat, lng'
      });
    }

    if (!transactionDigest) {
      return res.status(400).json({
        error: 'Missing transactionDigest. Review must be signed on-chain first.'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Upload to Walrus
    const walrusResponse = await uploadReview({
      placeId,
      placeName,
      walletAddress,
      rating,
      comment: comment || '',
      coordinates: [lat, lng],
      timestamp: Date.now(),
      transactionDigest,
    });

    if (!walrusResponse.success) {
      return res.status(500).json({ error: 'Failed to upload to Walrus' });
    }

    const walrusId = walrusResponse.walrusId;

    // Store review index
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

    // Update or create place index
    const existingPlace = await prisma.placeIndex.findUnique({
      where: { placeId },
    });

    if (existingPlace) {
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

    res.status(201).json({
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
      transactionDigest,
    });
  } catch (error) {
    console.error('POST /api/reviews error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: error.message || 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(PORT, async () => {
  console.log(`API Server running on http://localhost:${PORT}`);
  
  // Test database connection
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('Make sure DATABASE_URL is set in .env file');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
