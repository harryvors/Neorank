# Sui Move Contract Deploy Talimatları

## ✅ Yapılan İşlemler

1. ✅ Move smart contract oluşturuldu (`sui/reviews/sources/reviews.move`)
2. ✅ Move.toml yapılandırma dosyası oluşturuldu
3. ✅ `lib/sui.ts` gerçek Move contract çağrılarıyla güncellendi
4. ✅ Deploy script'leri hazırlandı (Windows ve Linux/Mac)

## 📋 Deploy Adımları

### 1. Sui CLI Kurulumu

**Windows:**
```powershell
# Rust yüklü olmalı (https://rustup.rs/)
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui
```

**Linux/Mac:**
```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui
```

### 2. Sui Wallet Oluşturma

```bash
sui client new-address ed25519
```

### 3. Testnet Token Alma

```bash
sui client faucet
```

### 4. Contract Deploy

**Windows (PowerShell):**
```powershell
cd sui/reviews
sui move build
sui client publish --gas-budget 100000000 --json
```

**Linux/Mac:**
```bash
cd sui/reviews
sui move build
sui client publish --gas-budget 100000000 --json
```

### 5. Package ID'yi Güncelleme

Deploy çıktısından `packageId`'yi kopyalayın ve:

**Seçenek 1:** `.env.local` dosyası oluşturun:
```
VITE_SUI_PACKAGE_ID=0xYOUR_PACKAGE_ID_HERE
```

**Seçenek 2:** `lib/sui.ts` dosyasındaki `PACKAGE_ID` değişkenini direkt güncelleyin:
```typescript
const PACKAGE_ID = '0xYOUR_PACKAGE_ID_HERE';
```

## 🎯 Sonuç

Deploy tamamlandıktan sonra:
- Review'lar Sui blockchain'de saklanacak
- Her review bir Sui object olarak oluşturulacak
- Review'lar immutable (değiştirilemez) olacak
- Event'ler üzerinden review'lar sorgulanabilir

## 📝 Notlar

- Contract testnet'te deploy edilecek (güvenli test için)
- Her review transaction'ı gas fee gerektirir
- Review'lar wallet sahibine ait olacak (owned objects)
- Event'ler üzerinden cafe ID'ye göre filtreleme yapılabilir

