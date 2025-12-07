# Sui On-Chain Points System

Bu dokümantasyon, review uygulamasındaki on-chain puan sisteminin nasıl çalıştığını açıklar.

## 🎯 Genel Bakış

Her başarılı review transaction'ı sonrası:
- Kullanıcı **100 puan** kazanır
- Bu puan **on-chain (Sui)** üzerinde tutulur
- Walrus blob'unda `pointsAwarded: 100` metadata olarak yer alır
- Frontend'de kullanıcıya "+100 puan kazandınız" popup'ı gösterilir
- Profile ve Points Shop ekranları on-chain puanları kullanır

## 📁 Dosya Yapısı

### Sui Move Module
- `sui/reviews/sources/review_points.move` - On-chain puan yönetimi Move modülü

### TypeScript Helpers
- `lib/sui-points.ts` - On-chain puan okuma helper'ları
- `lib/sui-points-transaction.ts` - Puan ödülü transaction helper'ı
- `lib/sui-transaction.ts` - Review transaction helper'ı (güncellendi)

### Frontend Components
- `prisma/components/Sidebar.tsx` - Review submit flow (güncellendi)
- `prisma/components/AddLocationModal.tsx` - Yeni mekan ekleme flow (güncellendi)
- `prisma/components/UserProfileModal.tsx` - Profile ekranı (on-chain puanları kullanır)
- `prisma/components/ShopModal.tsx` - Points Shop (on-chain puanları kullanır)
- `prisma/components/PointsEarnedModal.tsx` - "+100 puan kazandınız" popup'ı

### Backend
- `server.mjs` - Walrus payload'a `pointsAwarded: 100` ekler

## 🔄 Review Submit Flow

### 1. Frontend: Review Transaction
```typescript
// lib/sui-transaction.ts
const transactionDigest = await submitReviewTransaction(
  reviewData,
  signAndExecute
);
```

### 2. Frontend: Backend'e Gönder
```typescript
// Backend Walrus'a upload eder ve pointsAwarded: 100 ekler
const response = await fetch('/api/reviews', {
  method: 'POST',
  body: formData,
});
const result = await response.json();
const { walrusId } = result;
```

### 3. Frontend: Points Award Transaction
```typescript
// lib/sui-points-transaction.ts
const pointsTxDigest = await awardPointsTransaction(
  100, // amount
  walrusId, // blob ID (optional)
  signAndExecute
);
```

### 4. Frontend: On-Chain Points Fetch
```typescript
// lib/sui-points.ts
const totalPoints = await getUserPoints(walletAddress);
```

### 5. Frontend: Points Modal Göster
```typescript
setPointsEarned(100);
setNewTotalPoints(totalPoints);
setShowPointsEarned(true);
```

## 📊 Move Module API

### `award_points_for_review`
```move
public entry fun award_points_for_review(
    recipient: &signer,
    amount: u64,
    ctx: &mut TxContext
)
```

### `award_points_with_blob`
```move
public entry fun award_points_with_blob(
    recipient: &signer,
    amount: u64,
    blob_id: vector<u8>,
    ctx: &mut TxContext
)
```

### Events
```move
struct PointsAwardedEvent {
    owner: address,
    amount: u64,
    timestamp: u64,
    blob_id: vector<u8>,
}
```

## 🔍 On-Chain Points Okuma

### Method 1: UserPoints Objects
```typescript
// lib/sui-points.ts
const points = await fetchUserPoints(address);
// Tüm UserPoints objelerini query eder ve toplamını hesaplar
```

### Method 2: PointsAwardedEvent Events
```typescript
// lib/sui-points.ts
const points = await fetchUserPointsFromEvents(address);
// Tüm PointsAwardedEvent event'lerini query eder ve toplamını hesaplar
```

### Recommended: getUserPoints
```typescript
// Her iki method'u da dener ve yüksek değeri döndürür
const totalPoints = await getUserPoints(address);
```

## 🚀 Deployment

### 1. Move Module'ü Deploy Et
```bash
cd sui/reviews
sui client publish --gas-budget 100000000
```

### 2. Package ID'yi Güncelle
```bash
# .env.local veya .env dosyasına ekle:
VITE_SUI_PACKAGE_ID=0x...
```

### 3. Test Et
```typescript
// Frontend'de review submit et
// Points modal'ın göründüğünü kontrol et
// Profile'da on-chain puanların göründüğünü kontrol et
```

## 📝 Notlar

- Her review için ayrı bir UserPoints objesi oluşturulur
- Frontend tüm UserPoints objelerini query edip toplamını hesaplar
- Alternatif olarak PointsAwardedEvent event'leri de query edilebilir
- Walrus blob'unda `pointsAwarded: 100` metadata olarak saklanır
- Profile ve Shop ekranları on-chain puanları öncelikli olarak kullanır (backend fallback)

## 🐛 Troubleshooting

### Puanlar görünmüyor
1. PACKAGE_ID doğru mu kontrol et
2. Move module deploy edildi mi kontrol et
3. Browser console'da hata var mı kontrol et
4. Sui testnet'e bağlı mı kontrol et

### Transaction başarısız
1. Wallet bağlı mı kontrol et
2. Gas fee yeterli mi kontrol et
3. Move module doğru mu kontrol et

