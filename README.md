<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1IcRxXcwAKyV5rPxPq9PvUupMmXhZbKT6

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables in `.env.local`:
   ```bash
   # Database (PostgreSQL)
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

   # Sui Blockchain
   VITE_SUI_PACKAGE_ID=your-package-id-here

   # Walrus Storage (Testnet - default, no auth required)
   WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
   WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

   # Optional Walrus Configuration
   WALRUS_EPOCHS=1
   WALRUS_DELETABLE=true

   # Google Places API (for cafe search)
   VITE_GOOGLE_PLACES_API_KEY=your-google-places-api-key

   # Gemini API (for initial cafe data)
   GEMINI_API_KEY=your-gemini-api-key
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

   Or run both frontend and backend:
   ```bash
   npm run dev:all
   ```

## Testing Walrus Client

Test the Walrus client independently:

```bash
node test-walrus.mjs
```

This will:
1. Upload a test payload to Walrus
2. Retrieve the blob using the returned blobId
3. Verify the content matches the original payload
