# Walrus API Entegrasyonu

Bu dokümantasyon, Walrus API'sine gerçek HTTP request'ler yapmak için nasıl yapılandırılacağını açıklar.

## Özellikler

- ✅ **Mock Mode**: Development için mock implementation (varsayılan)
- ✅ **Real API Mode**: Gerçek Walrus API'sine HTTP request'ler
- ✅ **Otomatik Mod Seçimi**: Environment variable'lara göre otomatik seçim
- ✅ **Detaylı Logging**: Tüm API çağrıları için detaylı loglar
- ✅ **Error Handling**: Kapsamlı hata yönetimi

## Kurulum

### 1. Environment Variables

`.env` dosyanıza (veya `server.mjs` çalıştırdığınız yerde) şu değişkenleri ekleyin:

```bash
# Walrus HTTP API Configuration (Official Walrus API)
# Testnet (Public - No authentication required)
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space

# Mainnet (Public aggregators available, publishers require authentication)
# WALRUS_PUBLISHER_URL=https://your-publisher-url.com
# WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space

# Optional Configuration
WALRUS_EPOCHS=1  # Number of storage epochs (default: 1)
WALRUS_DELETABLE=true  # true = deletable blob, false = permanent (default: true for v1.33+)
WALRUS_MOCK_MODE=false  # true = mock mode, false = real API
```

### 2. Mod Seçimi

**Mock Mode (Varsayılan):**
- `WALRUS_PUBLISHER_URL` set edilmemişse
- veya `WALRUS_MOCK_MODE=true` ise

**Real API Mode:**
- `WALRUS_PUBLISHER_URL` set edilmişse
- ve `WALRUS_MOCK_MODE=false` veya set edilmemişse

### 3. Public Testnet Endpoints

Walrus Testnet'te public publisher ve aggregator'lar mevcut (authentication gerekmez):

**Publisher (Upload için):**
- `https://publisher.walrus-testnet.walrus.space`

**Aggregator (Read için):**
- `https://aggregator.walrus-testnet.walrus.space`

Bu endpoint'ler 10 MiB'a kadar dosya upload'ına izin verir. Daha büyük dosyalar için kendi publisher'ınızı çalıştırmanız gerekir.

### 4. API Endpoints

Walrus HTTP API'si iki farklı endpoint kullanır:

**Publisher (Upload):**
- Endpoint: `PUT $PUBLISHER/v1/blobs`
- Query Parameters:
  - `epochs`: Blob'un kaç epoch saklanacağı (default: 1)
  - `deletable=true`: Deletable blob (v1.33+ default)
  - `permanent=true`: Permanent blob
  - `send_object_to`: Blob object'in gönderileceği Sui address

**Aggregator (Read):**
- Endpoint: `GET $AGGREGATOR/v1/blobs/<blob-id>`
- Alternative: `GET $AGGREGATOR/v1/blobs/by-object-id/<object-id>`

## Kullanım

### Backend'te Kullanım

`server.mjs` içinde zaten kullanılıyor:

```javascript
import { uploadReview } from './lib/walrus.mjs';

// Review upload
const walrusResponse = await uploadReview({
  placeId: 'place-123',
  placeName: 'Coffee Shop',
  walletAddress: '0x123...',
  rating: 4.5,
  comment: 'Great coffee!',
  coordinates: [41.0422, 29.0081],
  timestamp: Date.now(),
  transactionDigest: '0xabc...'
});
```

### Response Formatı

Walrus API'si şu response formatlarını döner:

**Yeni Blob Oluşturulduğunda:**
```json
{
  "newlyCreated": {
    "blobObject": {
      "id": "0xe91eee8c5b6f35b9a250cfc29e30f0d9e5463a21fd8d1ddb0fc22d44db4eac50",
      "blobId": "M4hsZGQ1oCktdzegB6HnI6Mi28S2nqOPHxK-W7_4BUk",
      "registeredEpoch": 34,
      "size": 17,
      "deletable": false
    },
    "cost": 132300
  }
}
```

**Blob Zaten Mevcut Olduğunda:**
```json
{
  "alreadyCertified": {
    "blobId": "M4hsZGQ1oCktdzegB6HnI6Mi28S2nqOPHxK-W7_4BUk",
    "event": {
      "txDigest": "4XQHFa9S324wTzYHF3vsBSwpUZuLpmwTHYMFv9nsttSs"
    }
  }
}
```

Kod otomatik olarak `newlyCreated.blobObject.blobId` veya `alreadyCertified.blobId` field'larını kullanır.

## API Response Formatları

### Başarılı Response Örnekleri

**Format 1:**
```json
{
  "cid": "bafybeiabc123...",
  "success": true
}
```

**Format 2:**
```json
{
  "id": "walrus-id-123",
  "hash": "0xabc123..."
}
```

**Format 3:**
```json
{
  "walrusId": "bafybei...",
  "contentHash": "0x123..."
}
```

### Hata Response Örnekleri

**400 Bad Request:**
```json
{
  "error": "Invalid payload",
  "message": "Missing required field: placeId"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

## Test Etme

### 1. Mock Mode ile Test

```bash
# .env dosyasında WALRUS_PUBLISHER_URL'yi kaldırın veya
WALRUS_MOCK_MODE=true
```

Server'ı başlatın:
```bash
node server.mjs
```

Console'da şunu göreceksiniz:
```
[Walrus] Using MOCK mode - no real API calls will be made
```

### 2. Real API ile Test (Testnet)

```bash
# .env dosyasına ekleyin:
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
WALRUS_EPOCHS=1
WALRUS_DELETABLE=true
WALRUS_MOCK_MODE=false
```

Server'ı başlatın:
```bash
node server.mjs
```

Console'da şunu göreceksiniz:
```
[Walrus] Using REAL API mode
[Walrus] Publisher: https://publisher.walrus-testnet.walrus.space
[Walrus] Aggregator: https://aggregator.walrus-testnet.walrus.space
[Walrus] Config: epochs=1, deletable=true
```

### 3. Test Script ile Test

```bash
node test-review-api.mjs
```

## Debugging

### Log Seviyeleri

Tüm Walrus API çağrıları detaylı loglar üretir:

```
[Walrus] Uploading review to API...
[Walrus] Payload size: 1234 bytes
[Walrus] API response received in 234ms - Status: 200
[Walrus] ✅ Review uploaded successfully - walrusId: bafybeiabc123...
```

### Hata Durumları

```
[Walrus] ❌ Upload failed after 5000ms: Failed to connect to Walrus API
[Walrus] API error response: {"error": "Invalid payload"}
```

### Network Hataları

Eğer `fetch` hatası alırsanız:
- API URL'in doğru olduğundan emin olun
- Network bağlantınızı kontrol edin
- CORS ayarlarını kontrol edin (eğer browser'dan çağrılıyorsa)

## Özelleştirme

### Custom Headers

Eğer Walrus API'niz özel header'lar gerektiriyorsa, `_uploadReviewReal` fonksiyonunu güncelleyin:

```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-Custom-Header': 'value',
  'X-Request-ID': generateRequestId(),
};
```

### Timeout Ayarları

`fetch` API'sine timeout eklemek için:

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye

const response = await fetch(this.apiUrl, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
  signal: controller.signal,
});

clearTimeout(timeoutId);
```

### Retry Logic

Hata durumunda retry eklemek için:

```javascript
async _uploadReviewReal(payload, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // ... fetch code ...
      return result;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## Sorun Giderme

### "Using MOCK mode" mesajı görüyorum ama real API kullanmak istiyorum

- `.env` dosyasında `WALRUS_PUBLISHER_URL` set edildiğinden emin olun
- `WALRUS_MOCK_MODE=false` olduğundan emin olun
- Server'ı yeniden başlatın

### "Failed to connect to Walrus API" hatası

- Publisher URL'in doğru olduğundan emin olun
- Network bağlantınızı kontrol edin
- Firewall/proxy ayarlarını kontrol edin
- Testnet endpoint'lerini kullanıyorsanız, public endpoint'lerin çalıştığından emin olun

### "Walrus API response missing blobId" hatası

- Walrus API response formatını kontrol edin
- Response'u console'da log'layın (detaylı loglar göreceksiniz)
- `newlyCreated.blobObject.blobId` veya `alreadyCertified.blobId` field'larının response'da olduğundan emin olun

### 413 Payload Too Large hatası

- Public publisher'lar genellikle 10 MiB limit'e sahiptir
- Daha büyük dosyalar için kendi publisher'ınızı çalıştırmanız gerekir
- Veya CLI kullanarak upload yapabilirsiniz

## İletişim

Walrus API dokümantasyonu için: [Walrus API Docs](https://docs.walrus.example.com)

