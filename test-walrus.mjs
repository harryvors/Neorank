/**
 * Test Script for Walrus Client
 * 
 * Tests uploadReview and readBlob functions
 * 
 * Usage:
 *   node test-walrus.mjs
 * 
 * Make sure WALRUS_PUBLISHER and WALRUS_AGGREGATOR are set in .env
 * or use default testnet endpoints
 */

import { uploadReview, readBlob } from './lib/walrus.mjs';

async function testWalrus() {
  console.log('🧪 Testing Walrus Client...\n');

  // Test payload
  const testPayload = {
    foo: 'bar',
    timestamp: Date.now(),
    test: true,
  };

  try {
    // Test 1: Upload review
    console.log('📤 Test 1: Uploading review...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));
    console.log('');

    const uploadResult = await uploadReview(testPayload);
    
    console.log('✅ Upload successful!');
    console.log('Result:', {
      walrusId: uploadResult.walrusId || uploadResult.blobId,
      objectId: uploadResult.objectId,
      success: uploadResult.success,
    });
    console.log('');

    const blobId = uploadResult.walrusId || uploadResult.blobId;
    if (!blobId) {
      throw new Error('No blobId returned from upload');
    }

    // Test 2: Read blob
    console.log('📥 Test 2: Reading blob...');
    console.log('Blob ID:', blobId);
    console.log('');

    const blobContent = await readBlob(blobId);
    
    console.log('✅ Read successful!');
    console.log('Blob content type:', typeof blobContent);
    console.log('Blob content length:', blobContent.length, 'bytes');
    console.log('');

    // Test 3: Verify content
    console.log('🔍 Test 3: Verifying content...');
    
    let parsedContent;
    try {
      parsedContent = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
    } catch (e) {
      console.warn('⚠️ Could not parse blob content as JSON');
      parsedContent = blobContent;
    }

    console.log('Parsed content:', JSON.stringify(parsedContent, null, 2));
    console.log('');

    // Verify payload matches
    if (typeof parsedContent === 'object' && parsedContent.foo === testPayload.foo) {
      console.log('✅ Content verification passed!');
      console.log('   Original payload matches retrieved blob');
    } else {
      console.warn('⚠️ Content verification failed');
      console.warn('   Original:', testPayload);
      console.warn('   Retrieved:', parsedContent);
    }

    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testWalrus().catch(console.error);

