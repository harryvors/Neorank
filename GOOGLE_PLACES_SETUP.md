# Google Places API Setup

İstanbul'daki kafeleri haritada göstermek için Google Places API kullanılıyor.

## Kurulum

### 1. Google Cloud Console'da API Key Oluşturma

1. [Google Cloud Console](https://console.cloud.google.com/)'a gidin
2. Yeni bir proje oluşturun veya mevcut projeyi seçin
3. **APIs & Services > Library** bölümüne gidin
4. **Places API**'yi arayın ve etkinleştirin
5. **APIs & Services > Credentials** bölümüne gidin
6. **Create Credentials > API Key** seçeneğini seçin
7. API key'i kopyalayın

### 2. Environment Variable Ekleme

`.env.local` dosyasına ekleyin:

```env
VITE_GOOGLE_PLACES_API_KEY=your_api_key_here
```

### 3. API Key Kısıtlamaları (Önerilen)

Güvenlik için API key'inizi kısıtlayın:

1. **Application restrictions**: HTTP referrers (web sites)
   - `localhost:*` (development)
   - `your-domain.com/*` (production)

2. **API restrictions**: Sadece **Places API**'yi seçin

## Mock Data (API Key Olmadan)

API key yoksa, sistem otomatik olarak İstanbul'daki popüler kafeler için mock data kullanır:
- Beşiktaş, Kadıköy, Şişli, Beyoğlu, Üsküdar, Bakırköy bölgelerinden örnek kafeler

## Özellikler

- **Otomatik Yükleme**: Sayfa açıldığında İstanbul'daki kafeler otomatik yüklenir
- **Haritada Gösterim**: Tüm kafeler haritada marker olarak görünür
- **On-Chain Değerlendirme**: Marker'a tıklayarak on-chain değerlendirme yapabilirsiniz
- **Google Fotoğrafları**: Kafe fotoğrafları Google Places'ten çekilir (API key varsa)

## Notlar

- Google Places API ücretlidir (ücretsiz kotası var)
- Alternatif olarak Overpass API (OpenStreetMap) kullanılabilir
- Mock data sınırlı sayıda kafe içerir (gerçek API daha fazla sonuç döner)

