/**
 * Shared TypeScript interfaces for the application
 */

export interface Review {
  id: string;
  placeId: string;
  placeName: string;
  walletAddress: string;
  rating: number;
  comment: string;
  createdAt: string; // ISO string
  lat: number;
  lng: number;
  walrusId: string; // Walrus CID/ID
}

export interface PlaceIndex {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  avgRating: number;
  reviewCount: number;
  lastWalrusId?: string;
}

export interface CreateReviewRequest {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  rating: number;
  comment: string;
  walletAddress: string;
}

export interface CreateReviewResponse {
  success: boolean;
  review: Review;
  walrusId: string;
  transactionDigest?: string; // Sui transaction digest
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

