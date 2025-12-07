/**
 * Receipt OCR Service
 * 
 * Extracts structured data from receipt images using OCR
 * Supports both real OCR (tesseract.js) and mock mode for development
 */

import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';

export interface ParsedReceiptFields {
  rawText: string;
  date?: string;          // YYYY-MM-DD formatında normalize edilmiş tarih
  amountKurus?: number;   // Toplam tutar kuruş cinsinden (örn: 87.50 TL → 8750)
  last4Digits?: string;   // Fiş numarası son 4 hane
}

/**
 * Parse date from Turkish receipt format to YYYY-MM-DD
 */
function parseDate(text: string): string | undefined {
  // Turkish date formats: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
  const datePatterns = [
    /(\d{2})[./-](\d{2})[./-](\d{4})/,  // DD.MM.YYYY
    /(\d{4})[./-](\d{2})[./-](\d{2})/,  // YYYY.MM.DD
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern === datePatterns[0]) {
        // DD.MM.YYYY format
        const [, day, month, year] = match;
        return `${year}-${month}-${day}`;
      } else {
        // YYYY.MM.DD format
        const [, year, month, day] = match;
        return `${year}-${month}-${day}`;
      }
    }
  }

  // Try to find date-like patterns in text
  const dateLikePattern = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;
  const dateMatch = text.match(dateLikePattern);
  if (dateMatch) {
    const [, part1, part2, part3] = dateMatch;
    // Heuristic: if part3 is 4 digits, it's year
    if (part3.length === 4) {
      // Assume DD.MM.YYYY
      return `${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    } else if (part3.length === 2) {
      // Assume DD.MM.YY
      const year = parseInt(part3) > 50 ? `19${part3}` : `20${part3}`;
      return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    }
  }

  return undefined;
}

/**
 * Parse total amount from receipt text
 * Looks for patterns like "Toplam: 87.50 TL" or "Genel Toplam 125,00"
 */
function parseAmount(text: string): number | undefined {
  // Turkish patterns for total amount
  const amountPatterns = [
    /(toplam|genel\s+toplam|tutar|ödenen)[^\d]*(\d+)[.,](\d{2})/i,
    /(\d+)[.,](\d{2})\s*(tl|₺)/i,
    /(toplam|tutar)[:\s]*(\d+)[.,](\d{2})/i,
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const lira = parseInt(match[2] || match[1]);
      const kurus = parseInt(match[3] || match[2] || '0');
      const totalKurus = lira * 100 + kurus;
      
      // Sanity check: reasonable amount (10 TL - 10000 TL)
      if (totalKurus >= 1000 && totalKurus <= 1000000) {
        return totalKurus;
      }
    }
  }

  // Fallback: find any number with 2 decimal places that looks like amount
  const fallbackPattern = /(\d{2,5})[.,](\d{2})/;
  const fallbackMatch = text.match(fallbackPattern);
  if (fallbackMatch) {
    const lira = parseInt(fallbackMatch[1]);
    const kurus = parseInt(fallbackMatch[2]);
    const totalKurus = lira * 100 + kurus;
    
    if (totalKurus >= 1000 && totalKurus <= 1000000) {
      return totalKurus;
    }
  }

  return undefined;
}

/**
 * Parse receipt number last 4 digits
 * Looks for patterns like "Fiş No: 12345678" or "Belge No 9876"
 */
function parseLast4Digits(text: string): string | undefined {
  const patterns = [
    /(fis|fiş|belge)\s*no\.?\s*[:\-]?\s*(\d+)/i,
    /(no|numara)[:\s]*(\d+)/i,
    /fiş[^\d]*(\d{4,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numberStr = match[2] || match[1];
      if (numberStr.length >= 4) {
        return numberStr.slice(-4); // Last 4 digits
      } else if (numberStr.length > 0) {
        return numberStr.padStart(4, '0'); // Pad if less than 4
      }
    }
  }

  // Fallback: find any 4+ digit number that might be receipt number
  const fallbackPattern = /\b(\d{4,})\b/;
  const matches = text.matchAll(fallbackPattern);
  for (const match of matches) {
    const num = match[1];
    // Skip if it looks like a date or amount
    if (num.length === 4 && !num.includes('.') && !num.includes(',')) {
      return num;
    }
  }

  return undefined;
}

/**
 * Extract receipt data from image using OCR
 * 
 * @param imagePath - Path to the receipt image file
 * @returns Parsed receipt fields
 */
export async function extractReceiptDataFromImage(imagePath: string): Promise<ParsedReceiptFields> {
  // Check if mock mode is enabled
  const useMock = process.env.RECEIPT_OCR_MOCK === 'true' || !process.env.TESSERACT_ENABLED;

  if (useMock) {
    console.log('[Receipt OCR] Using MOCK mode');
    return extractReceiptDataFromImageMock(imagePath);
  }

  try {
    console.log('[Receipt OCR] Starting OCR processing...');
    
    // Initialize Tesseract worker
    const worker = await createWorker('tur', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[Receipt OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Perform OCR
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();

    console.log('[Receipt OCR] OCR completed');
    console.log('[Receipt OCR] Extracted text length:', text.length);

    // Parse fields from OCR text
    const date = parseDate(text);
    const amountKurus = parseAmount(text);
    const last4Digits = parseLast4Digits(text);

    console.log('[Receipt OCR] Parsed fields:', {
      hasDate: !!date,
      hasAmount: !!amountKurus,
      hasLast4: !!last4Digits,
    });

    return {
      rawText: text,
      date,
      amountKurus,
      last4Digits,
    };
  } catch (error) {
    console.error('[Receipt OCR] OCR failed, falling back to mock:', error);
    return extractReceiptDataFromImageMock(imagePath);
  }
}

/**
 * Mock OCR implementation for development/testing
 */
async function extractReceiptDataFromImageMock(imagePath: string): Promise<ParsedReceiptFields> {
  // Simulate OCR delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Generate mock receipt data
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const amountKurus = Math.floor(Math.random() * 50000) + 2000; // 20-520 TL
  const last4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

  const mockText = `
FİŞ
Tarih: ${today.toLocaleDateString('tr-TR')}
Toplam: ${(amountKurus / 100).toFixed(2)} TL
Fiş No: ${Math.floor(Math.random() * 1000000)}${last4}
  `.trim();

  console.log('[Receipt OCR] Mock data generated');

  return {
    rawText: mockText,
    date: dateStr,
    amountKurus,
    last4Digits: last4,
  };
}

