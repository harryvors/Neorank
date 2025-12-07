# Walrus + Sui Cafe Review POC

Bu proje, Walrus ve Sui blockchain kullanarak kafe değerlendirme uygulamasının Proof of Concept (POC) versiyonudur.

## 🏗️ Mimari

### Genel Akış

1. **Kullanıcı Wallet Bağlar**: Sui wallet (Walrus) bağlanır
2. **Mekan Seçer**: Haritada bir mekan seçer veya detay sayfasına gider
3. **Yorum Yazar**: Rating + comment formunu doldurur
4. **Gönder**:
   - Review verisi Walrus'a yüklenir (HTTP API)
   - Walrus'tan dönen ID/CID Sui transaction'ında on-chain kaydedilir
   - Backend'de index kaydı oluşturulur (PostgreSQL)
5. **Harita Görüntüleme**: Bounding box'a göre mekanlar backend'den çekilir ve haritada gösterilir

### Teknoloji Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Harita**: Leaflet + React-Leaflet
- **Wallet**: @mysten/dapp-kit (Sui wallet integration)
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Blockchain**: Sui (testnet)
- **Storage**: Walrus (mock implementation)

## 📁 Klasör Yapısı

```
├── app/
│   └── api/
│       ├── reviews/
│       │   ├── route.ts              # POST /api/reviews
│       │   └── [walrusId]/
│       │       └── route.ts          # GET /api/reviews/:walrusId
│       └── places/
│           └── route.ts              # GET /api/places
├── lib/
│   ├── prisma.ts                     # Prisma client
│   ├── walrus.ts                     # Walrus client (MOCK)
│   └── sui-transaction.ts            # Sui transaction helper (MOCK)
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── components/                   # React components
├── types.ts                          # TypeScript interfaces
└── sui/                              # Sui Move contracts (optional)
```

## 🚀 Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. PostgreSQL Veritabanı Kurulumu

PostgreSQL veritabanı oluşturun ve `.env.local` dosyasına ekleyin:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cafe_reviews?schema=public"
```

### 3. Prisma Migration

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Environment Variables

`.env.local` dosyası oluşturun:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cafe_reviews?schema=public"

# Google Gemini API (optional, for initial cafe data)
API_KEY="your-gemini-api-key"

# Sui Package ID (after deploying Move contract)
VITE_SUI_PACKAGE_ID="0x0"
```

### 5. Development Server

```bash
npm run dev
```

## 🔧 Mock vs Gerçek Entegrasyonlar

### ✅ Şu An Mock Olan Kısımlar

#### 1. Walrus Client (`lib/walrus.ts`)

**Mevcut Durum**: In-memory mock store kullanıyor

**Gerçek Entegrasyon İçin**:
- `uploadReview()` fonksiyonunu gerçek Walrus HTTP API'sine bağlayın
- `getReview()` fonksiyonunu gerçek Walrus API'sine bağlayın
- Endpoint'leri ve authentication'ı ekleyin

```typescript
// Örnek gerçek implementasyon:
export async function uploadReview(payload: WalrusReviewPayload): Promise<WalrusUploadResponse> {
  const response = await fetch('https://walrus-api.example.com/api/v1/upload', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WALRUS_API_KEY}` 
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { walrusId: data.cid, success: true };
}
```

#### 2. Sui Transaction (`lib/sui-transaction.ts`)

**Mevcut Durum**: Placeholder transaction oluşturuyor

**Gerçek Entegrasyon İçin**:
- Sui Move contract'ını deploy edin
- `submitReviewTransaction()` fonksiyonunu gerçek Move call ile güncelleyin
- `VITE_SUI_PACKAGE_ID` environment variable'ını set edin

```typescript
// Örnek gerçek implementasyon:
const PACKAGE_ID = import.meta.env.VITE_SUI_PACKAGE_ID;
tx.moveCall({
  target: `${PACKAGE_ID}::reviews::submit_review`,
  arguments: [
    tx.pure.vector('u8', Array.from(new TextEncoder().encode(walrusId))),
    tx.pure.vector('u8', Array.from(new TextEncoder().encode(placeId))),
  ],
});
```

### ✅ Gerçek Entegrasyonlar

- ✅ PostgreSQL database (Prisma)
- ✅ Next.js API routes
- ✅ Sui wallet connection (@mysten/dapp-kit)
- ✅ Leaflet map integration
- ✅ Frontend components

## 📊 Database Schema

### PlaceIndex
- `placeId`: Unique place identifier
- `placeName`: Place name
- `lat`, `lng`: Coordinates
- `avgRating`: Average rating (1-5)
- `reviewCount`: Number of reviews
- `lastWalrusId`: Last review's Walrus ID

### ReviewIndex
- `placeId`: Place reference
- `walletAddress`: Reviewer's wallet address
- `walrusId`: Walrus CID/ID (unique)
- `rating`: Review rating (1-5)
- `lat`, `lng`: Review location

## 🔌 API Endpoints

### POST /api/reviews

Review oluşturur:
1. Walrus'a yükler
2. Database'e index kaydı ekler
3. Place index'i günceller

**Request Body**:
```json
{
  "placeId": "cafe-1",
  "placeName": "Coffee Shop",
  "lat": 41.0082,
  "lng": 28.9784,
  "rating": 4,
  "comment": "Great coffee!",
  "walletAddress": "0x..."
}
```

### GET /api/places

Bounding box içindeki mekanları döndürür.

**Query Parameters**:
- `minLat`, `maxLat`, `minLng`, `maxLng`

**Response**: `PlaceIndex[]`

### GET /api/reviews/:walrusId

Walrus'tan review detayını getirir.

**Response**: `ReviewData`

## 🎯 Sonraki Adımlar

1. **Walrus Entegrasyonu**:
   - Gerçek Walrus API endpoint'lerini belirleyin
   - `lib/walrus.ts` dosyasını güncelleyin
   - Authentication ekleyin

2. **Sui Move Contract**:
   - Move contract'ı yazın ve deploy edin
   - `lib/sui-transaction.ts` dosyasını güncelleyin
   - `VITE_SUI_PACKAGE_ID` environment variable'ını set edin

3. **Review Detayları**:
   - Sidebar'da "Yorumları gör" butonuna tıklandığında
   - `/api/reviews/:walrusId` endpoint'ini çağırın
   - Walrus'tan full review detaylarını getirin

4. **Optimizasyonlar**:
   - Bounding box query'lerini cache'leyin
   - Pagination ekleyin
   - Error handling'i iyileştirin

## 📝 Notlar

- Bu bir POC'dir, production için ek güvenlik ve optimizasyonlar gerekir
- Walrus ve Sui entegrasyonları mock'tur, gerçek API'lerle değiştirilmelidir
- Database migration'ları production'da dikkatli yapılmalıdır

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

