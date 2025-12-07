/**
 * Express API Server
 * 
 * Simple Express server to handle API routes
 * Run this alongside Vite dev server
 * 
 * Usage: node server.mjs
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sui client for blockchain queries (backend)
const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
});

// Get PACKAGE_ID from environment or use default
const PACKAGE_ID = process.env.VITE_SUI_PACKAGE_ID || process.env.SUI_PACKAGE_ID || '0x0';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Import walrus with error handling
let uploadReview;
let formatError;
try {
  // Try .mjs first (ES module)
  try {
    const walrusModule = await import('./lib/walrus.mjs');
    uploadReview = walrusModule.uploadReview;
    formatError = walrusModule.formatError || ((e) => e instanceof Error ? e.message : String(e));
    console.log('✅ Walrus module loaded successfully (.mjs)');
  } catch (mjsError) {
    // Fallback to .js
    try {
      const walrusModule = await import('./lib/walrus.js');
      uploadReview = walrusModule.uploadReview;
      formatError = walrusModule.formatError || ((e) => e instanceof Error ? e.message : String(e));
      console.log('✅ Walrus module loaded successfully (.js)');
    } catch (jsError) {
      throw new Error(`Failed to import walrus: ${mjsError.message}, ${jsError.message}`);
    }
  }
} catch (error) {
  console.warn('⚠️ Could not import walrus module, using inline mock:', error.message);
  // Inline mock fallback - this is fine, Walrus is mocked anyway
  formatError = (e) => e instanceof Error ? e.message : String(e);
  uploadReview = async (payload) => {
    console.log('[MOCK] Uploading to Walrus:', payload.placeId);
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      blobId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      success: true,
    };
  };
}

const app = express();

// Initialize Prisma with error handling
let prisma;
try {
  // Try to import and initialize Prisma
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  console.log('✅ Prisma client initialized');
} catch (error) {
  console.warn('⚠️ Prisma client not available:', error.message);
  console.warn('⚠️ Server will continue in mock mode (no database operations)');
  console.warn('⚠️ To enable database:');
  console.warn('   1. Run: npx prisma generate');
  console.warn('   2. Set DATABASE_URL in .env');
  console.warn('   3. Restart server');
  prisma = null;
}

const PORT = 3001;

app.use(cors());
app.use(express.json());
// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Receipt processing functions (inline implementation for now)
async function extractReceiptDataFromImage(imagePath) {
  // Mock implementation - replace with real OCR later
  await new Promise(resolve => setTimeout(resolve, 500));
  const today = new Date();
  return {
    rawText: `FİŞ\nTarih: ${today.toLocaleDateString('tr-TR')}\nToplam: ${(Math.random() * 50 + 20).toFixed(2)} TL\nFiş No: ${Math.floor(Math.random() * 1000000)}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
    date: today.toISOString().split('T')[0],
    amountKurus: Math.floor(Math.random() * 50000) + 2000,
    last4Digits: Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
  };
}

function buildReceiptSignature(fields) {
  const { date, amountKurus, last4Digits } = fields;
  if (!date || amountKurus === undefined || !last4Digits) return null;
  const sig = `${date}|${amountKurus}|${last4Digits}`;
  return {
    signatureInput: sig,
    signatureHash: crypto.createHash('sha256').update(sig).digest('hex'),
  };
}

async function checkReceiptVerification(prisma, hash, date, wallet) {
  if (!prisma) return { verifiedByReceipt: false, isSuspiciousReceipt: false };
  try {
    const existing = await prisma.review.findMany({
      where: { receiptSignatureHash: hash },
      select: { walletAddress: true },
    });
    const useCount = existing.length;
    const walletCount = new Set(existing.map(r => r.walletAddress)).size;
    let verified = useCount === 0 || (useCount <= 3 && walletCount <= 3);
    let suspicious = useCount > 3 || walletCount > 3;
    if (date) {
      const diffDays = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) suspicious = true;
    }
    return { verifiedByReceipt: verified, isSuspiciousReceipt: suspicious };
  } catch (e) {
    return { verifiedByReceipt: false, isSuspiciousReceipt: false };
  }
}

// POST /api/reviews/check-daily-limit - Check if user can submit review today
app.post('/api/reviews/check-daily-limit', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: 'Missing walletAddress',
      });
    }

    if (!prisma) {
      // If Prisma not available, allow review (graceful degradation)
      return res.json({
        canReview: true,
        reviewsToday: 0,
        maxReviews: 2,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyLimit = await prisma.dailyLimit.findUnique({
      where: {
        walletAddress_date: {
          walletAddress: String(walletAddress),
          date: today,
        },
      },
    });

    const reviewsToday = dailyLimit?.reviewCount || 0;
    const maxReviews = 2;
    const canReview = reviewsToday < maxReviews;

    return res.json({
      canReview,
      reviewsToday,
      maxReviews,
    });
  } catch (error) {
    console.error('Error checking daily limit:', error);
    // On error, allow review (graceful degradation)
    return res.json({
      canReview: true,
      reviewsToday: 0,
      maxReviews: 2,
    });
  }
});

// POST /api/reviews (multipart/form-data with receipt image)
app.post('/api/reviews', upload.single('receiptImage'), async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log(`\n[${requestId}] ========== NEW REVIEW REQUEST ==========`);
  
  try {
    // Step 1: Parse and validate request (multipart form data)
    console.log(`[${requestId}] Step 1: Parsing multipart form data...`);
    
    // Check for receipt image (required)
    if (!req.file) {
      console.error(`[${requestId}] Validation failed - missing receiptImage`);
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Receipt image is required',
        missingFields: ['receiptImage']
      });
    }

    const receiptImagePath = req.file.path;
    const receiptImageUrl = `/uploads/${req.file.filename}`;
    console.log(`[${requestId}] Receipt image uploaded:`, {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: receiptImageUrl
    });

    // Parse form fields
    const { placeId, placeName, lat, lng, rating, comment, walletAddress, transactionDigest, gpsLatitude, gpsLongitude, gpsDistance } = req.body;

    // Log sanitized request data (no PII)
    console.log(`[${requestId}] Request data:`, {
      placeId: placeId?.substring(0, 20),
      placeName: placeName?.substring(0, 30),
      rating,
      lat,
      lng,
      walletAddress: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null,
      transactionDigest: transactionDigest ? `${transactionDigest.slice(0, 10)}...` : null,
      hasComment: !!comment,
      commentLength: comment?.length || 0,
      hasGps: !!(gpsLatitude && gpsLongitude),
    });

    // Step 2: Validate required fields
    console.log(`[${requestId}] Step 2: Validating required fields...`);
    const missingFields = [];
    if (!placeId) missingFields.push('placeId');
    if (!placeName) missingFields.push('placeName');
    if (!walletAddress) missingFields.push('walletAddress');
    if (rating === undefined || rating === null) missingFields.push('rating');
    if (lat === undefined || lat === null) missingFields.push('lat');
    if (lng === undefined || lng === null) missingFields.push('lng');

    if (missingFields.length > 0) {
      console.error(`[${requestId}] Validation failed - missing fields:`, missingFields);
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Missing required fields',
        missingFields
      });
    }

    if (!transactionDigest) {
      console.error(`[${requestId}] Validation failed - missing transactionDigest`);
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Missing transactionDigest. Review must be signed on-chain first.'
      });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      console.error(`[${requestId}] Validation failed - invalid rating:`, rating);
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Rating must be a number between 1 and 5',
        received: rating
      });
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.error(`[${requestId}] Validation failed - invalid coordinates:`, { lat, lng });
      return res.status(400).json({
        error: 'ValidationError',
        message: 'lat and lng must be numbers',
        received: { lat, lng }
      });
    }

    console.log(`[${requestId}] ✅ Validation passed`);

    // Step 2.5: GPS Verification (ZORUNLU - 150 metre içinde olmalı)
    console.log(`[${requestId}] Step 2.5: Checking GPS verification...`);
    const gpsLat = gpsLatitude ? Number(gpsLatitude) : null;
    const gpsLng = gpsLongitude ? Number(gpsLongitude) : null;
    const placeLat = Number(lat);
    const placeLng = Number(lng);
    
    if (!gpsLat || !gpsLng) {
      console.error(`[${requestId}] GPS verification failed - no GPS coordinates provided`);
      return res.status(400).json({
        error: 'GPSVerificationRequired',
        message: 'Konum bilgisi zorunludur! Değerlendirme yapabilmek için konum izni vermeniz gerekiyor.',
      });
    }
    
    // Calculate distance using Haversine formula
    function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
      const R = 6371000; // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    
    const distance = calculateDistanceMeters(gpsLat, gpsLng, placeLat, placeLng);
    const maxDistance = 150; // 150 metre
    
    if (distance > maxDistance) {
      console.error(`[${requestId}] GPS verification failed - too far: ${Math.round(distance)}m (max: ${maxDistance}m)`);
      return res.status(403).json({
        error: 'GPSVerificationFailed',
        message: `Değerlendirme reddedildi! Mekanın ${Math.round(distance)} metre uzağındasınız. Değerlendirme yapabilmek için mekanın ${maxDistance} metre içinde olmanız gerekiyor.`,
        distance: Math.round(distance),
        maxDistance,
      });
    }
    
    console.log(`[${requestId}] ✅ GPS verification passed: ${Math.round(distance)}m from place`);

    // Step 2.6: Check daily review limit
    console.log(`[${requestId}] Step 2.5: Checking daily review limit...`);
    try {
      if (prisma) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dailyLimit = await prisma.dailyLimit.findUnique({
          where: {
            walletAddress_date: {
              walletAddress: String(walletAddress),
              date: today,
            },
          },
        });

        const reviewsToday = dailyLimit?.reviewCount || 0;
        const maxReviews = 2; // Günde maksimum 2 review
        
        if (reviewsToday >= maxReviews) {
          console.error(`[${requestId}] Daily limit reached: ${reviewsToday}/${maxReviews}`);
          return res.status(429).json({
            error: 'DailyLimitExceeded',
            message: `Günlük değerlendirme limitine ulaştınız! Günde maksimum ${maxReviews} değerlendirme yapabilirsiniz.`,
            reviewsToday,
            maxReviews,
          });
        }
        
        console.log(`[${requestId}] Daily limit check passed: ${reviewsToday + 1}/${maxReviews}`);
      }
    } catch (limitError) {
      console.warn(`[${requestId}] ⚠️ Daily limit check failed:`, limitError.message);
      // Continue anyway (graceful degradation)
    }

    // Step 3: Process receipt image (OCR + verification)
    console.log(`[${requestId}] Step 3: Processing receipt image...`);
    let receiptData = null;
    let receiptSignature = null;
    let receiptVerification = null;

    if (req.file) {
      try {
        console.log(`[${requestId}] Running OCR on receipt image...`);
        receiptData = await extractReceiptDataFromImage(req.file.path);
        console.log(`[${requestId}] OCR completed:`, {
          hasDate: !!receiptData.date,
          hasAmount: receiptData.amountKurus !== undefined,
          hasLast4: !!receiptData.last4Digits,
        });

        if (receiptData.date && receiptData.amountKurus !== undefined && receiptData.last4Digits) {
          receiptSignature = buildReceiptSignature(receiptData);
          console.log(`[${requestId}] Receipt signature created`);

          if (receiptSignature) {
            const receiptDate = receiptData.date ? new Date(receiptData.date) : undefined;
            receiptVerification = await checkReceiptVerification(
              prisma,
              receiptSignature.signatureHash,
              receiptDate,
              walletAddress
            );
            console.log(`[${requestId}] Receipt verification:`, receiptVerification);
          }
        }
      } catch (ocrError) {
        console.warn(`[${requestId}] ⚠️ Receipt processing failed:`, ocrError.message);
      }
    }

    // Step 4: Prepare Walrus payload
    console.log(`[${requestId}] Step 4: Preparing Walrus payload...`);
    const walrusPayload = {
      placeId: String(placeId),
      placeName: String(placeName),
      walletAddress: String(walletAddress),
      rating: Number(rating),
      comment: String(comment || ''),
      coordinates: [Number(lat), Number(lng)],
      timestamp: Date.now(),
      transactionDigest: String(transactionDigest),
      pointsAwarded: 100, // Each successful review awards 100 points
    };

    // Validate payload structure
    if (!walrusPayload.placeId || !walrusPayload.placeName || !walrusPayload.walletAddress) {
      console.error(`[${requestId}] Invalid Walrus payload structure:`, walrusPayload);
      return res.status(500).json({
        error: 'InternalError',
        message: 'Failed to prepare Walrus payload',
        details: 'Payload validation failed'
      });
    }

    console.log(`[${requestId}] Walrus payload prepared (size: ${JSON.stringify(walrusPayload).length} bytes)`);

    // Step 5: Upload to Walrus
    console.log(`[${requestId}] Step 5: Uploading to Walrus...`);
    let walrusResponse;
    try {
      if (!uploadReview) {
        throw new Error('uploadReview function not available');
      }
      
      walrusResponse = await uploadReview(walrusPayload);
      console.log(`[${requestId}] Walrus response received:`, {
        success: walrusResponse?.success,
        hasWalrusId: !!walrusResponse?.walrusId,
        hasBlobId: !!walrusResponse?.blobId,
        walrusId: walrusResponse?.walrusId?.substring(0, 20) || walrusResponse?.blobId?.substring(0, 20),
        objectId: walrusResponse?.objectId,
        fullResponse: walrusResponse
      });
    } catch (walrusError) {
      const errorMessage = formatError ? formatError(walrusError) : (walrusError?.message || String(walrusError));
      
      console.error(`[${requestId}] ❌ Walrus upload failed:`, {
        error: errorMessage,
        errorType: walrusError instanceof Error ? walrusError.constructor.name : typeof walrusError,
        stack: walrusError instanceof Error ? walrusError.stack : undefined,
        fullError: walrusError,
        payload: walrusPayload,
      });
      
      return res.status(500).json({
        error: 'WalrusUploadFailed',
        message: formatError ? formatError(walrusError) : 'Failed to upload review to Walrus',
        details: errorMessage,
      });
    }

    // Support both old format (walrusId) and new format (blobId)
    const walrusId = walrusResponse?.walrusId || walrusResponse?.blobId;
    
    if (!walrusResponse) {
      console.error(`[${requestId}] ❌ Walrus upload returned null/undefined response`);
      return res.status(502).json({
        error: 'WalrusUploadFailed',
        message: 'Walrus upload returned no response',
        details: 'uploadReview returned null or undefined'
      });
    }

    if (!walrusResponse.success && walrusResponse.success !== undefined) {
      console.error(`[${requestId}] ❌ Walrus upload returned failure:`, walrusResponse);
      return res.status(502).json({
        error: 'WalrusUploadFailed',
        message: 'Walrus upload was not successful',
        details: walrusResponse ? JSON.stringify(walrusResponse) : 'No response from Walrus'
      });
    }

    if (!walrusId) {
      console.error(`[${requestId}] ❌ Walrus response missing blobId/walrusId:`, walrusResponse);
      return res.status(502).json({
        error: 'WalrusUploadFailed',
        message: 'Walrus upload succeeded but no blobId/walrusId returned',
        details: JSON.stringify(walrusResponse)
      });
    }
    console.log(`[${requestId}] ✅ Walrus upload successful - walrusId: ${walrusId.substring(0, 20)}...`);

    // Step 6: Store in database
    console.log(`[${requestId}] Step 6: Storing review index in database...`);
    let reviewIndex;
    try {
      if (!prisma) {
        throw new Error('Prisma client not initialized');
      }

      console.log(`[${requestId}] Creating review index...`);
      reviewIndex = await prisma.reviewIndex.create({
        data: {
          placeId: String(placeId),
          placeName: String(placeName),
          walletAddress: String(walletAddress),
          walrusId: String(walrusId),
          rating: Number(rating),
          lat: Number(lat),
          lng: Number(lng),
        },
      });
      console.log(`[${requestId}] ✅ Review index created: ${reviewIndex.id}`);

      // Also create/update Review model with receipt verification data and GPS verification
      if (receiptVerification && receiptSignature && receiptData) {
        console.log(`[${requestId}] Creating/updating Review with receipt data...`);
        try {
          const receiptDate = receiptData.date ? new Date(receiptData.date) : null;
          
          // GPS verification already checked above - if we reach here, it's verified
          const gpsLat = gpsLatitude ? Number(gpsLatitude) : null;
          const gpsLng = gpsLongitude ? Number(gpsLongitude) : null;
          const distance = gpsDistance ? Number(gpsDistance) : calculateDistanceMeters(gpsLat, gpsLng, Number(lat), Number(lng));
          const isVerifiedVisit = true; // If we reach here, GPS verification already passed
          
          await prisma.review.upsert({
            where: {
              walletAddress_walrusId: {
                walletAddress: String(walletAddress),
                walrusId: String(walrusId),
              }
            },
            create: {
              walletAddress: String(walletAddress),
              walrusId: String(walrusId),
              placeId: String(placeId),
              placeName: String(placeName),
              rating: Number(rating),
              comment: String(comment || ''),
              commentLength: (comment || '').length,
              hasPhoto: true, // Receipt image counts as photo
              amenities: {}, // Can be added later
              coordinates: { lat: Number(lat), lng: Number(lng) },
              address: String(placeName),
              // GPS Verification
              isVerifiedVisit: isVerifiedVisit,
              gpsLatitude: gpsLat,
              gpsLongitude: gpsLng,
              gpsDistance: distance,
              // Receipt Verification
              verifiedByReceipt: receiptVerification.verifiedByReceipt,
              receiptImageUrl: receiptImageUrl,
              receiptSignature: receiptSignature.signatureInput,
              receiptSignatureHash: receiptSignature.signatureHash,
              receiptDate: receiptDate,
              receiptAmountKurus: receiptData.amountKurus || null,
              receiptLast4: receiptData.last4Digits || null,
              receiptOcrText: receiptData.rawText || null,
              isSuspiciousReceipt: receiptVerification.isSuspiciousReceipt,
              transactionDigest: String(transactionDigest),
            },
            update: {
              // GPS Verification
              isVerifiedVisit: isVerifiedVisit,
              gpsLatitude: gpsLat,
              gpsLongitude: gpsLng,
              gpsDistance: distance,
              // Receipt Verification
              verifiedByReceipt: receiptVerification.verifiedByReceipt,
              receiptImageUrl: receiptImageUrl,
              receiptSignature: receiptSignature.signatureInput,
              receiptSignatureHash: receiptSignature.signatureHash,
              receiptDate: receiptDate,
              receiptAmountKurus: receiptData.amountKurus || null,
              receiptLast4: receiptData.last4Digits || null,
              receiptOcrText: receiptData.rawText || null,
              isSuspiciousReceipt: receiptVerification.isSuspiciousReceipt,
              hasPhoto: true,
            }
          });
          console.log(`[${requestId}] ✅ Review model updated with receipt + GPS data (verified: ${isVerifiedVisit})`);
        } catch (reviewError) {
          console.warn(`[${requestId}] ⚠️ Failed to update Review model:`, reviewError.message);
          // Non-blocking, continue
        }
      }

      // Step 7: Update or create place index
      console.log(`[${requestId}] Step 7: Updating place index...`);
      const existingPlace = await prisma.placeIndex.findUnique({
        where: { placeId: String(placeId) },
      });

      if (existingPlace) {
        console.log(`[${requestId}] Place exists, updating...`);
        const newReviewCount = existingPlace.reviewCount + 1;
        const newAvgRating = ((existingPlace.avgRating * existingPlace.reviewCount) + rating) / newReviewCount;

        await prisma.placeIndex.update({
          where: { placeId: String(placeId) },
          data: {
            avgRating: parseFloat(newAvgRating.toFixed(2)),
            reviewCount: newReviewCount,
            lastWalrusId: String(walrusId),
          },
        });
        console.log(`[${requestId}] ✅ Place index updated (avgRating: ${newAvgRating.toFixed(2)}, count: ${newReviewCount})`);
      } else {
        console.log(`[${requestId}] Place does not exist, creating...`);
        await prisma.placeIndex.create({
          data: {
            placeId: String(placeId),
            placeName: String(placeName),
            lat: Number(lat),
            lng: Number(lng),
            avgRating: Number(rating),
            reviewCount: 1,
            lastWalrusId: String(walrusId),
          },
        });
        console.log(`[${requestId}] ✅ Place index created`);
      }

      // Update daily limit counter and add 100 points for successful review
      // Her başarılı eklemede 100 puan ekle
      const pointsToAdd = 100;
      console.log(`[${requestId}] Step 8: Adding ${pointsToAdd} points to user ${walletAddress}...`);
      
      try {
        if (!prisma) {
          console.warn(`[${requestId}] ⚠️ Prisma not available, cannot add points`);
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Update daily limit with points
          await prisma.dailyLimit.upsert({
            where: {
              walletAddress_date: {
                walletAddress: String(walletAddress),
                date: today,
              },
            },
            update: {
              reviewCount: {
                increment: 1,
              },
              totalPoints: {
                increment: pointsToAdd,
              },
            },
            create: {
              walletAddress: String(walletAddress),
              date: today,
              reviewCount: 1,
              totalPoints: pointsToAdd,
            },
          });
          console.log(`[${requestId}] ✅ Daily limit updated, added ${pointsToAdd} points`);
          
          // User model'ine de puan ekle (wallet address'e göre)
          const updatedUser = await prisma.user.upsert({
            where: {
              walletAddress: String(walletAddress),
            },
            update: {
              totalPoints: {
                increment: pointsToAdd,
              },
            },
            create: {
              walletAddress: String(walletAddress),
              totalPoints: pointsToAdd,
              currentTier: 'Bronze',
              reputationScore: 50.0,
              consistencyScore: 50.0,
            },
          });
          console.log(`[${requestId}] ✅ User points updated: ${updatedUser.totalPoints} total points (added +${pointsToAdd})`);
        }
      } catch (pointsError) {
        console.error(`[${requestId}] ❌ Failed to add points:`, pointsError);
        console.error(`[${requestId}] Points error name:`, pointsError.name);
        console.error(`[${requestId}] Points error message:`, pointsError.message);
        console.error(`[${requestId}] Points error stack:`, pointsError.stack);
        // Continue even if points fail (non-blocking, but log the error)
      }
    } catch (dbError) {
      console.error(`[${requestId}] ❌ Database operation failed:`, dbError);
      console.error(`[${requestId}] DB error name:`, dbError.name);
      console.error(`[${requestId}] DB error message:`, dbError.message);
      console.error(`[${requestId}] DB error stack:`, dbError.stack);
      
      // Create mock review index for response (graceful degradation)
      reviewIndex = {
        id: `mock-${Date.now()}`,
        createdAt: new Date(),
      };
      console.warn(`[${requestId}] ⚠️ Using mock review index due to DB failure`);
    }

    // Step 9: Get updated user points for response
    let userTotalPoints = 0;
    try {
      if (prisma) {
        const user = await prisma.user.findUnique({
          where: { walletAddress: String(walletAddress) },
          select: { totalPoints: true },
        });
        userTotalPoints = user?.totalPoints || 0;
      }
    } catch (pointsQueryError) {
      console.warn(`[${requestId}] ⚠️ Failed to query user points for response:`, pointsQueryError.message);
    }

    // Step 10: Prepare success response
    console.log(`[${requestId}] Step 10: Preparing success response...`);
    const response = {
      success: true,
      review: {
        id: reviewIndex.id,
        placeId: String(placeId),
        placeName: String(placeName),
        walletAddress: String(walletAddress),
        rating: Number(rating),
        comment: String(comment || ''),
        createdAt: reviewIndex.createdAt.toISOString(),
        lat: Number(lat),
        lng: Number(lng),
        walrusId: String(walrusId),
      },
      walrusId: String(walrusId),
      transactionDigest: String(transactionDigest),
      pointsEarned: pointsToAdd,
      totalPoints: userTotalPoints,
      receiptVerification: receiptVerification ? {
        verifiedByReceipt: receiptVerification.verifiedByReceipt,
        isSuspiciousReceipt: receiptVerification.isSuspiciousReceipt,
        reason: receiptVerification.reason,
      } : null,
      receiptImageUrl: receiptImageUrl || null,
    };

    console.log(`[${requestId}] ✅ Request completed successfully`);
    console.log(`[${requestId}] ==========================================\n`);

    return res.status(201).json(response);
  } catch (error) {
    const errorMessage = formatError ? formatError(error) : (error?.message || String(error));
    
    console.error(`[${requestId}] ❌❌❌ UNEXPECTED ERROR ❌❌❌`);
    console.error(`[${requestId}] Error name:`, error?.name || typeof error);
    console.error(`[${requestId}] Error message:`, errorMessage);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    console.error(`[${requestId}] ==========================================\n`);

    return res.status(500).json({
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      details: errorMessage,
    });
  }
});

// POST /api/places - Create a new place
app.post('/api/places', async (req, res) => {
  try {
    const { name, lat, lng, city, district, address, walrusBlobId, suiTxDigest, walletAddress } = req.body;

    if (!name || lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: name, lat, lng',
      });
    }

    if (!prisma) {
      // Mock response if Prisma not available
      return res.json({
        id: `mock-${Date.now()}`,
        name,
        lat,
        lng,
        city,
        district,
        address,
        walrusBlobId,
        suiTxDigest,
        walletAddress,
        createdAt: new Date().toISOString(),
      });
    }

    const place = await prisma.place.create({
      data: {
        name: String(name),
        lat: Number(lat),
        lng: Number(lng),
        city: city ? String(city) : null,
        district: district ? String(district) : null,
        address: address ? String(address) : null,
        walrusBlobId: walrusBlobId ? String(walrusBlobId) : null,
        suiTxDigest: suiTxDigest ? String(suiTxDigest) : null,
        walletAddress: walletAddress ? String(walletAddress) : null,
      },
    });

    return res.json(place);
  } catch (error) {
    console.error('POST /api/places error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: error.message || 'Failed to create place',
    });
  }
});

// GET /api/places - Get all places (with optional bounding box filter)
app.get('/api/places', async (req, res) => {
  try {
    const { minLat, maxLat, minLng, maxLng } = req.query;

    if (!prisma) {
      // Mock response if Prisma not available
      return res.json([]);
    }

    const where = {};
    if (minLat && maxLat && minLng && maxLng) {
      where.lat = {
        gte: parseFloat(minLat),
        lte: parseFloat(maxLat),
      };
      where.lng = {
        gte: parseFloat(minLng),
        lte: parseFloat(maxLng),
      };
    }

    const places = await prisma.place.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(places);
  } catch (error) {
    console.error('GET /api/places error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: error.message || 'Failed to fetch places',
    });
  }
});

// GET /api/user/points - Get user points by wallet address
app.get('/api/user/points', async (req, res) => {
  const requestId = `[GET /api/user/points ${Date.now()}]`;
  console.log(`${requestId} Request received`);
  
  try {
    const { walletAddress } = req.query;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: 'MissingParameter',
        message: 'walletAddress query parameter is required',
      });
    }
    
    if (!prisma) {
      console.warn(`${requestId} ⚠️ Prisma not available, returning mock data`);
      return res.json({
        walletAddress: String(walletAddress),
        totalPoints: 0,
        currentTier: 'Bronze',
      });
    }
    
    // Get or create user
    const user = await prisma.user.upsert({
      where: {
        walletAddress: String(walletAddress),
      },
      update: {},
      create: {
        walletAddress: String(walletAddress),
        totalPoints: 0,
        currentTier: 'Bronze',
        reputationScore: 50.0,
        consistencyScore: 50.0,
      },
    });
    
    console.log(`${requestId} ✅ User points retrieved: ${user.totalPoints} points`);
    
    return res.json({
      walletAddress: user.walletAddress,
      totalPoints: user.totalPoints,
      currentTier: user.currentTier,
      reputationScore: user.reputationScore,
      consistencyScore: user.consistencyScore,
    });
  } catch (error) {
    console.error(`${requestId} ❌ Error:`, error);
    return res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch user points',
      details: error.message,
    });
  }
});

// POST /api/rewards/redeem - Redeem a reward
app.post('/api/rewards/redeem', async (req, res) => {
    const requestId = `[POST /api/rewards/redeem ${Date.now()}]`;
    console.log(`${requestId} Request received`);
    
    try {
      const { walletAddress, rewardId } = req.body;
      
      if (!walletAddress || !rewardId) {
        return res.status(400).json({
          error: 'MissingParameter',
          message: 'walletAddress and rewardId are required',
        });
      }
      
      if (!prisma) {
        return res.status(503).json({
          error: 'ServiceUnavailable',
          message: 'Database not available',
        });
      }
      
      // Get user
      const user = await prisma.user.findUnique({
        where: { walletAddress: String(walletAddress) },
      });
      
      if (!user) {
        return res.status(404).json({
          error: 'UserNotFound',
          message: 'User not found',
        });
      }
      
      // Find reward item
      const rewardItem = SHOP_ITEMS.find(item => item.id === rewardId);
      if (!rewardItem) {
        return res.status(404).json({
          error: 'RewardNotFound',
          message: 'Reward item not found',
        });
      }
      
      // Check if user has enough points
      if (user.totalPoints < rewardItem.cost) {
        return res.status(403).json({
          error: 'InsufficientPoints',
          message: `You need ${rewardItem.cost} points, but you only have ${user.totalPoints} points`,
        });
      }
      
      // Deduct points and create reward
      const updatedUser = await prisma.user.update({
        where: { walletAddress: String(walletAddress) },
        data: {
          totalPoints: {
            decrement: rewardItem.cost,
          },
        },
      });
      
      // Create reward record
      await prisma.reward.create({
        data: {
          walletAddress: String(walletAddress),
          rewardType: rewardItem.name,
          pointsCost: rewardItem.cost,
          description: rewardItem.description,
          isRedeemed: false,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
      
      console.log(`${requestId} ✅ Reward redeemed: ${rewardItem.name} for ${rewardItem.cost} points`);
      
      return res.json({
        success: true,
        reward: {
          id: rewardId,
          name: rewardItem.name,
          description: rewardItem.description,
        },
        remainingPoints: updatedUser.totalPoints,
      });
    } catch (error) {
      console.error(`${requestId} ❌ Error:`, error);
      return res.status(500).json({
        error: 'InternalError',
        message: 'Failed to redeem reward',
        details: error.message,
      });
    }
  });

  // GET /api/user/points - Get user points by wallet address
  app.get('/api/user/points', async (req, res) => {
    const requestId = `[GET /api/user/points ${Date.now()}]`;
    console.log(`${requestId} Request received`);
    
    try {
      const { walletAddress } = req.query;
      
      if (!walletAddress) {
        return res.status(400).json({
          error: 'MissingParameter',
          message: 'walletAddress query parameter is required',
        });
      }
      
      if (!prisma) {
        console.warn(`${requestId} ⚠️ Prisma not available, returning mock data`);
        return res.json({
          walletAddress: String(walletAddress),
          totalPoints: 0,
          currentTier: 'Bronze',
        });
      }
      
      // Get or create user
      const user = await prisma.user.upsert({
        where: {
          walletAddress: String(walletAddress),
        },
        update: {},
        create: {
          walletAddress: String(walletAddress),
          totalPoints: 0,
          currentTier: 'Bronze',
          reputationScore: 50.0,
          consistencyScore: 50.0,
        },
      });
      
      console.log(`${requestId} ✅ User points retrieved: ${user.totalPoints} points`);
      
      return res.json({
        walletAddress: user.walletAddress,
        totalPoints: user.totalPoints,
        currentTier: user.currentTier,
        reputationScore: user.reputationScore,
        consistencyScore: user.consistencyScore,
      });
    } catch (error) {
      console.error(`${requestId} ❌ Error:`, error);
      return res.status(500).json({
        error: 'InternalError',
        message: 'Failed to fetch user points',
        details: error.message,
      });
    }
  });

  // POST /api/rewards/redeem - Redeem a reward
  // İndirim kodu kullanımında blockchain'deki puan bilgisi kullanılır
  app.post('/api/rewards/redeem', async (req, res) => {
    const requestId = `[POST /api/rewards/redeem ${Date.now()}]`;
    console.log(`${requestId} Request received`);
    
    try {
      const { walletAddress, rewardId, useBlockchainPoints } = req.body;
      
      if (!walletAddress || !rewardId) {
        return res.status(400).json({
          error: 'MissingParameter',
          message: 'walletAddress and rewardId are required',
        });
      }
      
      if (!prisma) {
        return res.status(503).json({
          error: 'ServiceUnavailable',
          message: 'Database not available',
        });
      }
      
      // Reward items (matching constants.tsx)
      const SHOP_ITEMS = [
        { id: 'nft1', name: 'Starbucks Free Coffee', cost: 500, description: 'Starbucks\'tan 1 bedava kahve hakkı. Anlaşmalı şubelerde geçerlidir.' },
        { id: 'nft2', name: 'Kahve Dünyası Premium Set', cost: 1000, description: 'Kahve Dünyası\'ndan 1 kahve + 1 pasta hakkı. Anlaşmalı şubelerde geçerlidir.' },
        { id: 'nft3', name: 'Gloria Jeans VIP Package', cost: 1200, description: 'Gloria Jeans\'tan 2 kahve + 1 atıştırmalık hakkı. Anlaşmalı şubelerde geçerlidir.' },
      ];
      
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { walletAddress: String(walletAddress) },
      });
      
      if (!user) {
        return res.status(404).json({
          error: 'UserNotFound',
          message: 'User not found',
        });
      }
      
      // Find reward item
      const rewardItem = SHOP_ITEMS.find(item => item.id === rewardId);
      if (!rewardItem) {
        return res.status(404).json({
          error: 'RewardNotFound',
          message: 'Reward item not found',
        });
      }
      
      // Get points from blockchain if requested (for discount code validation)
      // Blockchain'deki puan bilgisi, her review transaction'ında saklanır
      let availablePoints = user.totalPoints;
      let pointsSource = 'database';
      
      if (useBlockchainPoints && PACKAGE_ID !== '0x0') {
        try {
          console.log(`${requestId} Querying blockchain for points from wallet: ${walletAddress}`);
          
          // Query latest review event for this wallet to get on-chain points
          const events = await suiClient.queryEvents({
            query: {
              MoveEventType: `${PACKAGE_ID}::reviews::ReviewCreated`,
            },
            filter: {
              Sender: String(walletAddress),
            },
            limit: 1,
            order: 'descending',
          });
          
          if (events.data.length > 0) {
            const latestEvent = events.data[0];
            const eventData = latestEvent.parsedJson || {};
            if (eventData.total_points !== undefined) {
              availablePoints = Number(eventData.total_points);
              pointsSource = 'blockchain';
              console.log(`${requestId} ✅ Using blockchain points: ${availablePoints} (from latest review transaction)`);
            } else {
              console.log(`${requestId} ⚠️ Latest review event found but no total_points field`);
            }
          } else {
            console.log(`${requestId} ⚠️ No review events found for wallet, using database points`);
          }
        } catch (blockchainError) {
          console.warn(`${requestId} ⚠️ Failed to fetch blockchain points, using database:`, blockchainError.message);
          // Fallback to database points
        }
      }
      
      // Check if user has enough points
      if (availablePoints < rewardItem.cost) {
        return res.status(403).json({
          error: 'InsufficientPoints',
          message: `You need ${rewardItem.cost} points, but you only have ${availablePoints} points (source: ${pointsSource})`,
          availablePoints,
          requiredPoints: rewardItem.cost,
          pointsSource,
        });
      }
      
      // Deduct points and create reward
      const updatedUser = await prisma.user.update({
        where: { walletAddress: String(walletAddress) },
        data: {
          totalPoints: {
            decrement: rewardItem.cost,
          },
        },
      });
      
      // Create reward record
      await prisma.reward.create({
        data: {
          walletAddress: String(walletAddress),
          rewardType: rewardItem.name,
          pointsCost: rewardItem.cost,
          description: rewardItem.description,
          isRedeemed: false,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
      
      console.log(`${requestId} ✅ Reward redeemed: ${rewardItem.name} for ${rewardItem.cost} points`);
      
      return res.json({
        success: true,
        reward: {
          id: rewardId,
          name: rewardItem.name,
          description: rewardItem.description,
        },
        remainingPoints: updatedUser.totalPoints,
      });
    } catch (error) {
      console.error(`${requestId} ❌ Error:`, error);
      return res.status(500).json({
        error: 'InternalError',
        message: 'Failed to redeem reward',
        details: error.message,
      });
    }
  });

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Express API server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`💾 Database: ${prisma ? '✅ Connected' : '⚠️ Not available (mock mode)'}`);
  console.log(`🌊 Walrus: ${uploadReview ? '✅ Available' : '⚠️ Mock mode'}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   POST /api/reviews/check-daily-limit - Check daily review limit`);
  console.log(`   POST /api/reviews - Create review (multipart/form-data)`);
  console.log(`   POST /api/places - Create place`);
  console.log(`   GET  /api/places - Get places (optional: ?minLat=&maxLat=&minLng=&maxLng=)`);
  console.log(`   GET  /api/user/points - Get user points (?walletAddress=)`);
  console.log(`   POST /api/rewards/redeem - Redeem reward`);
  console.log(`\n`);
});
