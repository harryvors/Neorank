# Sui Move Contract - Reviews Module

Bu Move contract, cafe review'larını Sui blockchain'de saklamak için kullanılır.

## Kurulum

1. **Sui CLI'yi yükleyin:**
   ```bash
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui
   ```

2. **Sui wallet oluşturun (eğer yoksa):**
   ```bash
   sui client new-address ed25519
   ```

3. **Testnet'ten faucet token alın:**
   ```bash
   sui client faucet
   ```

## Deploy

### Windows (PowerShell):
```powershell
cd sui/reviews
sui move build
sui client publish --gas-budget 100000000 --json
```

### Linux/Mac:
```bash
cd sui/reviews
sui move build
sui client publish --gas-budget 100000000 --json
```

Deploy işlemi tamamlandıktan sonra çıktıdaki `packageId`'yi kopyalayın.

## Package ID'yi Güncelleme

Deploy işleminden sonra aldığınız Package ID'yi şu dosyalarda güncelleyin:

1. **lib/sui.ts** - `PACKAGE_ID` değişkenini güncelleyin
2. Veya `.env.local` dosyası oluşturup ekleyin:
   ```
   VITE_SUI_PACKAGE_ID=0xYOUR_PACKAGE_ID_HERE
   ```

## Contract Fonksiyonları

### `create_review`
Yeni bir review oluşturur ve blockchain'e kaydeder.

**Parametreler:**
- `cafe_id`: Cafe ID (byte vector)
- `cafe_name`: Cafe adı (byte vector)
- `ratings`: Rating'ler JSON olarak serialize edilmiş (byte vector)
- `text`: Review metni (byte vector)

**Event:**
- `ReviewCreated`: Review oluşturulduğunda emit edilir

## Kullanım

Frontend'den review gönderildiğinde, `lib/sui.ts` içindeki `createReviewTransaction` fonksiyonu otomatik olarak bu Move contract'ı çağırır.

