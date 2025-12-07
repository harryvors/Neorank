import React from 'react';

export type AmenityKey = 
  | 'wifi' 
  | 'outlet' 
  | 'comfort' 
  | 'hygiene' 
  | 'quality' 
  | 'noise' 
  | 'service';

// Frontend Review (for display)
export interface Review {
  id: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  text: string;
  date: string;
  verifiedByReceipt?: boolean;
  isSuspiciousReceipt?: boolean;
  receiptImageUrl?: string;
  isVerifiedVisit?: boolean; // GPS verified visit
  gpsDistance?: number; // Distance in meters
}

// Backend Review (for API)
export interface ReviewData {
  id: string;
  placeId: string;
  placeName: string;
  walletAddress: string;
  rating: number;
  comment: string;
  createdAt: string;
  lat: number;
  lng: number;
  walrusId: string;
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
  transactionDigest: string; // Sui transaction digest (required - must be signed first)
}

export interface CreateReviewResponse {
  success: boolean;
  review: ReviewData;
  walrusId: string;
  transactionDigest?: string;
  pointsEarned?: number; // Puan kazanıldı (örn: 100)
  totalPoints?: number; // Yeni toplam puan
}

export interface Cafe {
  id: string;
  name: string;
  address: string;
  rating: number; // Aggregate 5-star rating
  coordinates: [number, number]; // [lat, lng]
  amenities: Record<AmenityKey, number>; // Score 0-10
  imageUrl: string;
  description: string;
  isOpen: boolean;
  googleMapsUri?: string;
  reviews?: Review[];
  walletAddress?: string; // Wallet address of the user who added this place (for duplicate prevention)
}

export interface AmenityConfig {
  label: string;
  icon: React.ElementType;
  description: string;
}