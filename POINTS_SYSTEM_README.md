# 🎯 Points & Reputation System Documentation

Bu dokümantasyon, kafe değerlendirme uygulaması için geliştirilen **puanlama, anti-spam ve blockchain reputation** sisteminin tam açıklamasını içerir.

## 📋 İçindekiler

1. [Sistem Mimarisi](#sistem-mimarisi)
2. [Database Schema](#database-schema)
3. [Servisler](#servisler)
4. [API Endpoints](#api-endpoints)
5. [Kullanım Örnekleri](#kullanım-örnekleri)
6. [Blockchain Entegrasyonu](#blockchain-entegrasyonu)

---

## 🏗️ Sistem Mimarisi

### Modüler Yapı

```
lib/services/
├── point-calculation.ts    # Puan hesaplama
├── anti-spam.ts            # Spam önleme
├── reputation.ts           # Reputation hesaplama
├── consistency.ts          # Tutarlılık skoru
├── tier-reward.ts          # Tier ve ödül yönetimi
└── review-flow.ts          # Ana review akışı
```

### Veri Akışı

```
1. Kullanıcı Review Gönderir
   ↓
2. Anti-Spam Kontrolleri (cooldown, daily limit, speed limit)
   ↓
3. GPS Doğrulama (opsiyonel)
   ↓
4. Puan Hesaplama (base + bonuses)
   ↓
5. Sui Transaction (wallet sign)
   ↓
6. Walrus Upload (review data)
   ↓
7. Database Update (review, points, tier)
   ↓
8. Reputation Update
   ↓
9. Achievement Check (NFT minting)
```

---

## 🗄️ Database Schema

### Ana Modeller

#### `User`
- `walletAddress` (unique)
- `totalPoints`
- `currentTier` (Bronze/Silver/Gold/Platinum)
- `reputationScore` (0-100)
- `consistencyScore` (0-100)
- `streakDays`

#### `Review`
- `walletAddress` + `walrusId` (composite key)
- Review detayları (rating, comment, amenities)
- GPS verification data
- `transactionDigest` (Sui on-chain proof)

#### `ReviewScore`
- Her review için hesaplanan puanlar
- Base points + bonuses
- Quality ve consistency scores

#### `DailyLimit`
- Günlük review sayısı takibi
- Günlük toplam puan

#### `PlaceCooldown`
- Aynı mekana tekrar review cooldown (30 gün)

#### `UserReputation`
- On-chain reputation sync
- `onChainReputation` (Sui object ID)

#### `Tier`
- Tier tanımları (min/max points, discounts)

#### `Reward`
- Kullanılabilir ödüller
- Claim status

#### `Achievement`
- NFT achievements
- `nftTokenId` (Sui NFT)

#### `ReviewFlag`
- Spam/şüpheli review raporları

---

## 🔧 Servisler

### 1. Point Calculation Service

**Dosya:** `lib/services/point-calculation.ts`

#### Fonksiyonlar:

```typescript
calculateDailyPoints(review: ReviewData, userStats: UserStats): PointCalculationResult
```

**Puan Hesaplama:**
- Base: 50 puan
- Comment bonus: 100+ karakter = +20
- Photo bonus: +30
- Amenity bonus: Tümü dolu = +10
- Consistency bonus: Yüksek tutarlılık = +15
- Verified visit: GPS doğrulama = +25

**Günlük Limit Multiplier:**
- İlk 3 review: 1.0x
- 4-5. review: 0.5x
- 6+ review: 0.0x (puan yok)

```typescript
validateGeoLocation(userLat, userLng, placeLat, placeLng, maxDistance = 150m)
```

---

### 2. Anti-Spam Service

**Dosya:** `lib/services/anti-spam.ts`

#### Fonksiyonlar:

```typescript
checkCooldown(walletAddress, placeId): CooldownCheckResult
```
- Minimum 30 gün cooldown aynı mekan için

```typescript
checkDailyLimit(walletAddress): DailyLimitCheckResult
```
- Maksimum 5 review/gün

```typescript
checkSpeedLimit(walletAddress): { isTooFast, lastReviewTime }
```
- 5 dakikada 1'den fazla review = şüpheli

```typescript
detectSuspiciousPatterns(walletAddress): SuspiciousPatternResult
```
- Hep 5 yıldız verme
- Çok kısa yorumlar
- Tekrarlayan pattern'ler

---

### 3. Reputation Service

**Dosya:** `lib/services/reputation.ts`

#### Fonksiyonlar:

```typescript
computeReputation(walletAddress): ReputationData
```

**Reputation Hesaplama (0-100):**
- Base: 50
- Review count bonus: +20 (max)
- Verified ratio: +15 (max)
- Consistency: +10 (max)
- Helpful votes: +5 (max)
- Flags penalty: -20 (max)

```typescript
updateReputationOnChain(walletAddress, reputationScore, consistencyScore)
```
- Sui blockchain'e reputation sync

---

### 4. Consistency Service

**Dosya:** `lib/services/consistency.ts`

#### Fonksiyonlar:

```typescript
calculateConsistencyScore(walletAddress): Promise<number>
```
- Kullanıcının puanlarının topluluk ortalamasıyla uyumu
- 0-100 skor

---

### 5. Tier & Reward Service

**Dosya:** `lib/services/tier-reward.ts`

#### Tier Sistemi:

| Tier | Min Points | Max Points | Discount |
|------|------------|------------|----------|
| Bronze | 0 | 499 | 5-10% |
| Silver | 500 | 1499 | 10-15% |
| Gold | 1500 | 2999 | 15-20% |
| Platinum | 3000+ | - | 20-25% |

#### Fonksiyonlar:

```typescript
calculateTier(totalPoints): TierName
updateUserTier(walletAddress): TierName
claimReward(walletAddress, rewardId)
generateCoupon(walletAddress, discountPercent, costPoints)
checkTierAchievement(walletAddress, tier)
checkReviewCountAchievement(walletAddress, reviewCount)
```

**Achievement Milestones:**
- 10, 25, 50, 100, 250, 500 reviews
- Tier achievements (Silver, Gold, Platinum)

---

### 6. Review Flow Service

**Dosya:** `lib/services/review-flow.ts`

#### Ana Fonksiyon:

```typescript
createReviewWithValidation(request: CreateReviewRequest, signAndExecute): CreateReviewResult
```

**Akış:**
1. Anti-spam kontrolleri
2. GPS doğrulama
3. Puan hesaplama
4. Sui transaction (wallet sign)
5. Walrus upload
6. Database update
7. Tier update
8. Reputation update
9. Achievement check

---

## 🌐 API Endpoints

### POST `/api/reviews/create`

Yeni review oluştur.

**Request:**
```json
{
  "walletAddress": "0x...",
  "placeId": "place-123",
  "placeName": "Cafe Name",
  "rating": 4.5,
  "comment": "Great coffee!",
  "amenities": {
    "wifi": 8,
    "outlet": 9,
    "comfort": 7,
    "hygiene": 9,
    "quality": 10,
    "noise": 5,
    "service": 8
  },
  "coordinates": { "lat": 41.0082, "lng": 28.9784 },
  "address": "Istanbul, Turkey",
  "gpsLatitude": 41.0082,
  "gpsLongitude": 28.9784,
  "photoUrl": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "review": {
    "walrusId": "bafybei...",
    "transactionDigest": "0x...",
    "pointsEarned": 95,
    "totalPoints": 500,
    "newTier": "Silver"
  },
  "warnings": []
}
```

---

### POST `/api/reviews/check-validity`

Review yapılabilir mi kontrol et.

**Request:**
```json
{
  "walletAddress": "0x...",
  "placeId": "place-123"
}
```

**Response:**
```json
{
  "success": true,
  "canReview": true,
  "checks": {
    "cooldown": { "canReview": true, "daysRemaining": 0 },
    "dailyLimit": { "canReview": true, "reviewsToday": 2, "maxReviews": 5 },
    "speedLimit": { "isTooFast": false },
    "suspiciousPatterns": { "isSuspicious": false, "riskScore": 10 }
  }
}
```

---

### GET `/api/user/reputation?walletAddress=0x...&syncToChain=true`

Kullanıcı reputation bilgisi.

**Response:**
```json
{
  "success": true,
  "reputation": {
    "reputationScore": 75,
    "consistencyScore": 82,
    "totalReviews": 42,
    "verifiedReviews": 35,
    "helpfulVotes": 12,
    "flagsReceived": 0
  },
  "syncResult": {
    "success": true,
    "transactionDigest": "0x..."
  }
}
```

---

### GET `/api/user/tier?walletAddress=0x...`

Kullanıcı tier bilgisi.

**Response:**
```json
{
  "success": true,
  "tier": {
    "name": "Silver",
    "info": {
      "minPoints": 500,
      "maxPoints": 1499,
      "discountMin": 10,
      "discountMax": 15,
      "benefits": [...]
    },
    "totalPoints": 750,
    "pointsToNextTier": 750
  }
}
```

---

### POST `/api/rewards/claim`

Ödül talep et.

**Request:**
```json
{
  "walletAddress": "0x...",
  "rewardId": "reward-123"
}
```

---

### GET `/api/rewards?walletAddress=0x...`

Kullanılabilir ödülleri listele.

---

## 💡 Kullanım Örnekleri

### Frontend'den Review Gönderme

```typescript
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { createReviewWithValidation } from '@/lib/services/review-flow';

const { mutate: signAndExecute } = useSignAndExecuteTransaction();

const handleSubmitReview = async () => {
  const result = await createReviewWithValidation(
    {
      walletAddress: currentAccount.address,
      placeId: selectedCafe.id,
      placeName: selectedCafe.name,
      rating: 4.5,
      comment: "Great place!",
      amenities: { wifi: 8, outlet: 9, ... },
      coordinates: [41.0082, 28.9784],
      gpsLatitude: 41.0082,
      gpsLongitude: 28.9784,
    },
    signAndExecute
  );

  if (result.success) {
    console.log('Points earned:', result.review.pointsEarned);
    console.log('New tier:', result.review.newTier);
  }
};
```

---

## ⛓️ Blockchain Entegrasyonu

### Sui Transaction

Her review için:
1. Kullanıcı wallet ile transaction imzalar
2. Review data on-chain kaydedilir
3. `transactionDigest` Walrus'a eklenir

### Reputation On-Chain

- `UserReputation` modelinde `onChainReputation` field'ı
- `syncReputationToChain()` fonksiyonu ile sync
- Sui object ID olarak saklanır

### NFT Achievements

- Tier achievements (Silver, Gold, Platinum)
- Review count milestones (10, 25, 50, 100, ...)
- `mintAchievementNFT()` fonksiyonu (mock - gerçek implementasyon gerekli)

---

## 🚀 Gelecek Geliştirmeler

1. **Real Walrus API Integration**
   - `lib/walrus.ts` içindeki mock fonksiyonları gerçek API çağrılarıyla değiştir

2. **Real Sui Move Contract**
   - `lib/sui-transaction.ts` içindeki mock transaction'ları gerçek Move contract çağrılarıyla değiştir

3. **Helpful Votes System**
   - Kullanıcılar review'leri "faydalı" olarak işaretleyebilir
   - `HelpfulVote` modeli ekle

4. **Weekly Bonus System**
   - 7 gün streak bonus
   - 20+ reviews/week bonus

5. **Token Rewards**
   - Native token ile ödüllendirme
   - Staking mekanizması

---

## 📝 Notlar

- Tüm servisler modüler ve test edilebilir yapıda
- Mock fonksiyonlar gerçek implementasyon için hazır
- Database schema Prisma ile yönetiliyor
- TypeScript strict mode ile yazıldı

---

## 🔒 Güvenlik

- Cooldown mekanizması spam'ı önler
- Günlük limitler abuse'i engeller
- Pattern detection şüpheli aktiviteleri tespit eder
- GPS doğrulama gerçek ziyaretleri doğrular
- Blockchain immutability review geçmişini korur

---

**Son Güncelleme:** 2024

