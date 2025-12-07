# Fiş Fotoğrafı + OCR + Hash Tabanlı Verification Sistemi

## 📋 Genel Bakış

Bu sistem, kullanıcıların mekanlara yaptığı değerlendirmeleri fiş fotoğraflarıyla doğrulamak için tasarlanmıştır. OCR ile fişten kritik bilgiler çıkarılır, hash tabanlı imza oluşturulur ve duplicate/spam kontrolü yapılır.

## 🏗️ Mimari

### 1. Prisma Model Güncellemeleri

`Review` modeline eklenen alanlar:
- `verifiedByReceipt`: Boolean - Fiş ile doğrulandı mı?
- `receiptImageUrl`: String? - Fiş fotoğrafı URL'i
- `receiptSignature`: String? - Canonical signature ("date|amountKurus|last4")
- `receiptSignatureHash`: String? - SHA-256 hash
- `receiptDate`: DateTime? - Fiş tarihi
- `receiptAmountKurus`: Int? - Toplam tutar (kuruş)
- `receiptLast4`: String? - Fiş numarası son 4 hane
- `receiptOcrText`: String? - OCR'dan çıkan raw text
- `isSuspiciousReceipt`: Boolean - Şüpheli fiş flag'i

### 2. Backend Servisleri

#### `lib/services/receipt-ocr.ts`
- OCR ile fişten metin çıkarır
- Tarih, tutar ve fiş numarası parse eder
- Mock mode desteği (development için)

#### `lib/services/receipt-signature.ts`
- Canonical signature oluşturur: `"YYYY-MM-DD|amountKurus|last4"`
- SHA-256 hash üretir

#### `lib/services/receipt-verification.ts`
- Hash uniqueness kontrolü
- Multiple wallet usage detection
- Receipt age validation (7+ days = suspicious)

### 3. API Endpoint

**POST /api/reviews** (multipart/form-data)

**Request:**
- `placeId`: string (required)
- `placeName`: string (required)
- `lat`: number (required)
- `lng`: number (required)
- `rating`: number (required, 1-5)
- `comment`: string (optional)
- `walletAddress`: string (required)
- `transactionDigest`: string (required)
- `receiptImage`: File (required, image/*)

**Response:**
```json
{
  "success": true,
  "review": { ... },
  "walrusId": "...",
  "transactionDigest": "...",
  "receiptVerification": {
    "verifiedByReceipt": true,
    "isSuspiciousReceipt": false,
    "reason": "First use of this receipt"
  },
  "receiptImageUrl": "/uploads/receipt-..."
}
```

### 4. Frontend Güncellemeleri

#### `prisma/components/Sidebar.tsx`
- File input eklendi (zorunlu)
- FormData ile multipart/form-data gönderimi
- Receipt preview gösterimi
- Verified/Suspicious badge'leri

## 🔧 Kurulum

### 1. Dependencies

```bash
npm install multer @types/multer tesseract.js
```

### 2. Environment Variables

```env
# OCR Configuration (optional)
RECEIPT_OCR_MOCK=true  # Set to false for real OCR
TESSERACT_ENABLED=false  # Set to true to enable Tesseract
```

### 3. Database Migration

```bash
npx prisma migrate dev --name add_receipt_verification
npx prisma generate
```

### 4. Uploads Directory

`public/uploads/` klasörü otomatik oluşturulur (server.mjs tarafından).

## 🚀 Kullanım

### Frontend'den Review Gönderme

```typescript
const formData = new FormData();
formData.append('placeId', cafe.id);
formData.append('placeName', cafe.name);
formData.append('lat', String(cafe.coordinates[0]));
formData.append('lng', String(cafe.coordinates[1]));
formData.append('rating', String(rating));
formData.append('comment', comment);
formData.append('walletAddress', walletAddress);
formData.append('transactionDigest', transactionDigest);
formData.append('receiptImage', receiptImageFile); // Required

const response = await fetch('/api/reviews', {
  method: 'POST',
  body: formData,
});
```

### Verification Logic

1. **First Use**: Hash ilk kez görülüyorsa → `verifiedByReceipt = true`
2. **Multiple Uses**: 3'ten fazla wallet veya 3'ten fazla kullanım → `isSuspiciousReceipt = true`
3. **Old Receipt**: 7+ gün eski fiş → `isSuspiciousReceipt = true`

## 🎨 UI Badges

- **Verified by Receipt**: Yeşil badge (verifiedByReceipt = true && isSuspiciousReceipt = false)
- **Suspicious**: Sarı badge (isSuspiciousReceipt = true)

## 📝 Notlar

- Şu an OCR mock mode'da çalışıyor (gerçek OCR için Tesseract entegrasyonu gerekli)
- Receipt services TypeScript'te yazıldı, server.mjs'te inline mock kullanılıyor
- Gerçek OCR entegrasyonu için `lib/services/receipt-ocr.mjs` oluşturulabilir

## 🔮 Gelecek İyileştirmeler

1. Gerçek Tesseract OCR entegrasyonu
2. EXIF metadata doğrulaması
3. Image quality validation
4. Receipt template matching
5. Multi-language OCR support

