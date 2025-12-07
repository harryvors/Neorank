/**
 * Walrus Client - TypeScript Implementation
 * 
 * Implements Walrus HTTP API according to official documentation:
 * https://docs.walrus.space/usage/http-api
 * 
 * Environment variables:
 * - WALRUS_PUBLISHER: Publisher endpoint (default: testnet)
 * - WALRUS_AGGREGATOR: Aggregator endpoint (default: testnet)
 */

// Default testnet endpoints
const DEFAULT_PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
const DEFAULT_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

export interface WalrusUploadResult {
  blobId: string;          // blobId (M4hsZ... gibi)
  objectId?: string;       // blobObject.id (varsa)
  newlyCreated: boolean;   // yeni mi, alreadyCertified mi
  raw: any;                // full JSON response
}

/**
 * Format unknown error to string
 */
function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Get environment variable with fallback
 */
function getEnv(key: string, defaultValue: string): string {
  // Support both Node.js (process.env) and browser (import.meta.env)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  // @ts-ignore - Vite environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key] || defaultValue;
  }
  return defaultValue;
}

/**
 * Walrus Client Class
 */
class WalrusClient {
  private publisherUrl: string;
  private aggregatorUrl: string;
  private epochs: number;
  private deletable: boolean;

  constructor() {
    this.publisherUrl = getEnv('WALRUS_PUBLISHER', DEFAULT_PUBLISHER);
    this.aggregatorUrl = getEnv('WALRUS_AGGREGATOR', DEFAULT_AGGREGATOR);
    this.epochs = parseInt(getEnv('WALRUS_EPOCHS', '1'), 10) || 1;
    this.deletable = getEnv('WALRUS_DELETABLE', 'true') !== 'false';

    console.log('[Walrus] Client initialized');
    console.log(`[Walrus] Publisher: ${this.publisherUrl}`);
    console.log(`[Walrus] Aggregator: ${this.aggregatorUrl}`);
    console.log(`[Walrus] Config: epochs=${this.epochs}, deletable=${this.deletable}`);
  }

  /**
   * Upload review to Walrus
   * 
   * PUT ${PUBLISHER_URL}/v1/blobs?epochs=1&deletable=true
   * Body: JSON string
   */
  async uploadReview(payload: any): Promise<WalrusUploadResult> {
    const startTime = Date.now();

    try {
      // Convert payload to JSON string
      const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const payloadSize = payloadJson.length;

      console.log('[Walrus] Uploading review...');
      console.log('[Walrus] Payload size:', payloadSize, 'bytes');

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('epochs', this.epochs.toString());
      if (this.deletable) {
        queryParams.append('deletable', 'true');
      } else {
        queryParams.append('permanent', 'true');
      }

      // Build full URL
      const uploadUrl = `${this.publisherUrl}/v1/blobs?${queryParams.toString()}`;
      console.log('[Walrus] Upload URL:', uploadUrl);

      // Make PUT request
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadJson,
      });

      const duration = Date.now() - startTime;
      console.log(`[Walrus] Response received in ${duration}ms - Status: ${response.status}`);

      // Read response body for error handling
      const responseText = await response.text();

      // Check if request was successful
      if (!response.ok) {
        console.error('[Walrus] Upload failed:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
        });
        throw new Error(`Walrus upload failed: status ${response.status}, body: ${responseText}`);
      }

      // Parse response JSON
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Walrus API returned non-JSON response: ${responseText}`);
      }

      // Extract blobId and objectId from response
      let blobId: string | null = null;
      let objectId: string | undefined;
      let newlyCreated = false;

      if (responseData.newlyCreated?.blobObject?.blobId) {
        // New blob was created
        blobId = responseData.newlyCreated.blobObject.blobId;
        objectId = responseData.newlyCreated.blobObject.id;
        newlyCreated = true;
        console.log('[Walrus] ✅ New blob created');
        console.log('[Walrus] Blob ID:', blobId.substring(0, 20) + '...');
        if (objectId) {
          console.log('[Walrus] Object ID:', objectId);
        }
      } else if (responseData.alreadyCertified?.blobId) {
        // Blob already exists and is certified
        blobId = responseData.alreadyCertified.blobId;
        newlyCreated = false;
        console.log('[Walrus] ✅ Blob already certified');
        console.log('[Walrus] Blob ID:', blobId.substring(0, 20) + '...');
      } else {
        // Fallback: try to find blobId in other locations
        blobId = responseData.blobId || 
                 responseData.blobObject?.blobId ||
                 responseData.cid || 
                 responseData.id ||
                 null;

        if (blobId) {
          console.warn('[Walrus] ⚠️ Using fallback blobId extraction');
        }
      }

      if (!blobId) {
        console.error('[Walrus] Response missing blobId:', JSON.stringify(responseData, null, 2));
        throw new Error('Walrus API response missing blobId field');
      }

      return {
        blobId: String(blobId),
        objectId,
        newlyCreated,
        raw: responseData,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = formatError(error);
      
      console.error(`[Walrus] ❌ Upload failed after ${duration}ms:`, {
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw with formatted error
      throw new Error(`Walrus upload failed: ${errorMessage}`);
    }
  }

  /**
   * Read blob from Walrus
   * 
   * GET ${AGGREGATOR_URL}/v1/blobs/${blobId}
   */
  async readBlob(blobId: string): Promise<Uint8Array | string> {
    const startTime = Date.now();

    try {
      const readUrl = `${this.aggregatorUrl}/v1/blobs/${blobId}`;
      console.log('[Walrus] Reading blob from:', readUrl);

      const response = await fetch(readUrl, {
        method: 'GET',
      });

      const duration = Date.now() - startTime;
      console.log(`[Walrus] Response received in ${duration}ms - Status: ${response.status}`);

      // Read response body for error handling
      const responseText = await response.text();

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[Walrus] Blob not found:', blobId);
          throw new Error(`Blob not found: ${blobId}`);
        }

        console.error('[Walrus] Read failed:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
        });
        throw new Error(`Walrus read failed: status ${response.status}, body: ${responseText}`);
      }

      console.log('[Walrus] ✅ Blob retrieved successfully');
      console.log('[Walrus] Blob size:', responseText.length, 'bytes');

      // Return as string (can be changed to Uint8Array if needed)
      return responseText;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = formatError(error);
      
      console.error(`[Walrus] ❌ Read failed after ${duration}ms:`, {
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(`Walrus read failed: ${errorMessage}`);
    }
  }
}

// Singleton instance
const walrusClient = new WalrusClient();

/**
 * Upload review to Walrus
 * 
 * @param payload - Review payload (will be JSON.stringify'd if not string)
 * @returns WalrusUploadResult with blobId, objectId, newlyCreated, and raw response
 */
export async function uploadReview(payload: any): Promise<WalrusUploadResult> {
  return walrusClient.uploadReview(payload);
}

/**
 * Read blob from Walrus
 * 
 * @param blobId - Blob ID to read
 * @returns Blob content as string (or Uint8Array if needed)
 */
export async function readBlob(blobId: string): Promise<Uint8Array | string> {
  return walrusClient.readBlob(blobId);
}

// Export formatError for use in other modules
export { formatError };
