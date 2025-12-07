# API Test Documentation

Bu dokümantasyon, `/api/reviews` endpoint'ini test etmek için kullanabileceğiniz yöntemleri açıklar.

## Önkoşullar

1. API server'ın çalışıyor olması gerekiyor:
   ```bash
   node server.mjs
   ```
   Server `http://localhost:3001` adresinde çalışmalı.

2. Frontend dev server'ın çalışıyor olması (opsiyonel):
   ```bash
   npm run dev
   ```
   Frontend `http://localhost:3002` adresinde çalışmalı.

## Test Yöntemleri

### 1. Node.js Test Script (Önerilen)

En kolay yöntem, hazırladığımız test script'ini kullanmak:

```bash
node test-review-api.mjs
```

Bu script:
- Dummy test verisi ile request gönderir
- Response'u parse eder ve detaylı log çıktısı verir
- Hata durumlarını açıklayıcı şekilde gösterir

### 2. cURL Komutu

Manuel test için cURL kullanabilirsiniz:

```bash
curl -X POST http://localhost:3001/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "placeId": "test-place-123",
    "placeName": "Test Coffee Shop",
    "lat": 41.0422,
    "lng": 29.0081,
    "rating": 4.5,
    "comment": "Test review",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "transactionDigest": "test-tx-digest-123"
  }'
```

### 3. Bash Script

`test-review-api.sh` script'ini kullanabilirsiniz (Linux/Mac):

```bash
chmod +x test-review-api.sh
./test-review-api.sh
```

### 4. REST Client (VS Code Extension)

VS Code'da REST Client extension'ını kullanarak `test-api.http` dosyası oluşturabilirsiniz:

```http
### Test Review Creation
POST http://localhost:3001/api/reviews
Content-Type: application/json

{
  "placeId": "test-place-123",
  "placeName": "Test Coffee Shop",
  "lat": 41.0422,
  "lng": 29.0081,
  "rating": 4.5,
  "comment": "Test review",
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "transactionDigest": "test-tx-digest-123"
}
```

## Beklenen Response

### Başarılı Response (201 Created)

```json
{
  "success": true,
  "review": {
    "id": "clx...",
    "placeId": "test-place-123",
    "placeName": "Test Coffee Shop",
    "walletAddress": "0x1234...",
    "rating": 4.5,
    "comment": "Test review",
    "createdAt": "2024-01-01T12:00:00.000Z",
    "lat": 41.0422,
    "lng": 29.0081,
    "walrusId": "bafybei..."
  },
  "walrusId": "bafybei...",
  "transactionDigest": "test-tx-digest-123"
}
```

### Hata Response'ları

#### 400 Bad Request - Validation Error

```json
{
  "error": "ValidationError",
  "message": "Missing required fields",
  "missingFields": ["placeId", "walletAddress"]
}
```

#### 400 Bad Request - Missing Transaction Digest

```json
{
  "error": "ValidationError",
  "message": "Missing transactionDigest. Review must be signed on-chain first."
}
```

#### 502 Bad Gateway - Walrus Upload Failed

```json
{
  "error": "WalrusUploadFailed",
  "message": "Failed to upload review to Walrus",
  "details": "Error message from Walrus"
}
```

#### 500 Internal Server Error

```json
{
  "error": "InternalServerError",
  "message": "An unexpected error occurred",
  "details": "Error stack trace (only in development)",
  "requestId": "req-1234567890-abc"
}
```

## Debug İpuçları

1. **Server loglarını kontrol edin**: `server.mjs` çalışırken console'da detaylı loglar göreceksiniz. Her request için bir `requestId` ile başlar.

2. **Frontend console'unu kontrol edin**: Browser DevTools'da Network tab'ında request/response'ları görebilirsiniz.

3. **Database bağlantısını kontrol edin**: Eğer Prisma client başlatılamazsa, server mock data ile çalışmaya devam eder ama database'e yazmaz.

4. **Walrus client'ı kontrol edin**: `lib/walrus.mjs` dosyasında mock implementation var. Gerçek Walrus API'sine geçerken bu dosyayı güncellemeniz gerekecek.

## Adım Adım Debug Süreci

1. **İlk test**: `node test-review-api.mjs` ile basit bir test yapın
2. **Walrus upload'u test edin**: Server loglarında "Step 4: Uploading to Walrus..." mesajını kontrol edin
3. **Database işlemini test edin**: Server loglarında "Step 5: Storing review index..." mesajını kontrol edin
4. **Frontend'ten test edin**: Gerçek kullanıcı akışını test edin

## Sorun Giderme

### "ECONNREFUSED" Hatası

API server çalışmıyor. `node server.mjs` komutunu çalıştırın.

### "Prisma client not initialized" Uyarısı

Database bağlantısı yok. `.env` dosyasında `DATABASE_URL` değişkenini kontrol edin.

### "Walrus upload failed" Hatası

`lib/walrus.mjs` dosyasındaki mock implementation'da bir sorun var. Dosyayı kontrol edin.

### Frontend'te "HTTP 500" Hatası

Server console'unda detaylı error log'ları olacak. `requestId` ile log'ları takip edebilirsiniz.

