# Walrus Client - TypeScript Implementation

TypeScript implementation of Walrus HTTP API client with proper error handling and type safety.

## Files

- `lib/walrus.ts` - TypeScript implementation (for frontend/TypeScript projects)
- `lib/walrus.mjs` - ES Module implementation (for Node.js/Express backend)

## Environment Variables

```bash
# Required
WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

# Optional
WALRUS_EPOCHS=1          # Number of storage epochs (default: 1)
WALRUS_DELETABLE=true    # true = deletable blob, false = permanent (default: true)
```

## Usage

### TypeScript (Frontend)

```typescript
import { uploadReview, readBlob, WalrusUploadResult } from './lib/walrus';

// Upload review
const result: WalrusUploadResult = await uploadReview({
  placeId: 'place-123',
  placeName: 'Coffee Shop',
  rating: 4.5,
  // ... other fields
});

console.log('Blob ID:', result.blobId);
console.log('Object ID:', result.objectId);
console.log('Newly created:', result.newlyCreated);

// Read blob
const blobContent = await readBlob(result.blobId);
const parsed = JSON.parse(blobContent as string);
```

### Node.js (Backend)

```javascript
import { uploadReview, readBlob } from './lib/walrus.mjs';

// Upload review
const result = await uploadReview({
  placeId: 'place-123',
  placeName: 'Coffee Shop',
  rating: 4.5,
});

console.log('Blob ID:', result.walrusId || result.blobId);

// Read blob
const blobContent = await readBlob(result.walrusId || result.blobId);
```

## API

### `uploadReview(payload: any): Promise<WalrusUploadResult>`

Uploads a payload to Walrus and returns blob information.

**Parameters:**
- `payload`: Any data (object, string, etc.). If object, will be JSON.stringify'd.

**Returns:**
```typescript
interface WalrusUploadResult {
  blobId: string;          // blobId (M4hsZ... gibi)
  objectId?: string;      // blobObject.id (Sui object ID, if available)
  newlyCreated: boolean;  // true if new blob, false if alreadyCertified
  raw: any;               // Full JSON response from Walrus API
}
```

**Example:**
```typescript
const result = await uploadReview({ foo: 'bar' });
// result.blobId = "M4hsZGQ1oCktdzegB6HnI6Mi28S2nqOPHxK-W7_4BUk"
// result.objectId = "0xe91eee8c5b6f35b9a250cfc29e30f0d9e5463a21fd8d1ddb0fc22d44db4eac50"
// result.newlyCreated = true
```

### `readBlob(blobId: string): Promise<Uint8Array | string>`

Reads a blob from Walrus by blobId.

**Parameters:**
- `blobId`: The blob ID returned from `uploadReview`

**Returns:**
- `string` or `Uint8Array`: The blob content (currently returns as string)

**Example:**
```typescript
const content = await readBlob('M4hsZGQ1oCktdzegB6HnI6Mi28S2nqOPHxK-W7_4BUk');
const parsed = JSON.parse(content as string);
```

## Error Handling

All errors are properly formatted and logged:

```typescript
try {
  const result = await uploadReview(payload);
} catch (error) {
  // Error message is formatted and includes status/body from Walrus API
  console.error(error.message);
  // Example: "Walrus upload failed: status 500, body: {...}"
}
```

## Testing

Run the test script:

```bash
node test-walrus.mjs
```

This will:
1. Upload a test payload to Walrus
2. Retrieve the blob using the returned blobId
3. Verify the content matches the original payload

## Response Formats

### New Blob Created

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

### Blob Already Certified

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

## Integration with Sui Transactions

The `blobId` and `objectId` returned from `uploadReview` can be used in Sui transactions:

```typescript
const walrusResult = await uploadReview(reviewPayload);

// Use blobId in Sui transaction
const tx = await signAndExecuteTransaction({
  // ... transaction data
  walrusId: walrusResult.blobId,
  walrusObjectId: walrusResult.objectId,
});
```

## Backend Error Handling

In Express/Node.js backend, errors are properly formatted:

```javascript
try {
  const result = await uploadReview(payload);
} catch (error) {
  // Error is automatically formatted
  res.status(500).json({
    error: 'WalrusUploadFailed',
    message: formatError(error),
  });
}
```

