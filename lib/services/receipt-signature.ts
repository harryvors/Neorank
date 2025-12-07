/**
 * Receipt Signature & Hash Service
 * 
 * Creates canonical signatures from receipt data and generates SHA-256 hashes
 * for duplicate detection and verification
 */

import * as crypto from 'crypto';

export interface ReceiptSignatureResult {
  signatureInput: string;  // Canonical string: "date|amountKurus|last4"
  signatureHash: string;   // SHA-256 hash of signatureInput
}

/**
 * Build receipt signature from parsed fields
 * 
 * @param fields - Parsed receipt fields
 * @returns Signature result or null if required fields are missing
 */
export function buildReceiptSignature(
  fields: { date?: string; amountKurus?: number; last4Digits?: string }
): ReceiptSignatureResult | null {
  const { date, amountKurus, last4Digits } = fields;

  // All 3 fields are required for verification
  if (!date || amountKurus === undefined || !last4Digits) {
    console.warn('[Receipt Signature] Missing required fields:', {
      hasDate: !!date,
      hasAmount: amountKurus !== undefined,
      hasLast4: !!last4Digits,
    });
    return null;
  }

  // Normalize date to YYYY-MM-DD format
  let normalizedDate = date;
  try {
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      normalizedDate = dateObj.toISOString().split('T')[0];
    }
  } catch (e) {
    // If date parsing fails, use as-is
  }

  // Normalize amount to integer (kuruş)
  const normalizedAmount = Math.floor(amountKurus);

  // Normalize last4 to exactly 4 digits (pad with zeros)
  const normalizedLast4 = last4Digits.padStart(4, '0').slice(-4);

  // Create canonical signature: "YYYY-MM-DD|amountKurus|last4"
  const signatureInput = `${normalizedDate}|${normalizedAmount}|${normalizedLast4}`;

  // Generate SHA-256 hash
  const signatureHash = crypto
    .createHash('sha256')
    .update(signatureInput)
    .digest('hex');

  console.log('[Receipt Signature] Signature created:', {
    signatureInput,
    signatureHash: signatureHash.substring(0, 16) + '...',
  });

  return {
    signatureInput,
    signatureHash,
  };
}

/**
 * Verify receipt signature format
 */
export function isValidReceiptSignature(signature: string): boolean {
  const parts = signature.split('|');
  if (parts.length !== 3) return false;

  const [date, amount, last4] = parts;

  // Check date format (YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(date)) return false;

  // Check amount is integer
  if (!/^\d+$/.test(amount)) return false;

  // Check last4 is 4 digits
  if (!/^\d{4}$/.test(last4)) return false;

  return true;
}

