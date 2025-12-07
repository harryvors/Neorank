/**
 * Test Script for POST /api/reviews
 * 
 * This script tests the review creation endpoint with dummy data.
 * 
 * Usage:
 *   node test-review-api.mjs
 * 
 * Make sure the API server is running on http://localhost:3001
 */

const API_URL = 'http://localhost:3001/api/reviews';

// Test payload (dummy data)
const testPayload = {
  placeId: `test-place-${Date.now()}`,
  placeName: 'Test Coffee Shop',
  lat: 41.0422,
  lng: 29.0081,
  rating: 4.5,
  comment: 'This is a test review from the test script',
  walletAddress: '0x1234567890123456789012345678901234567890',
  transactionDigest: `test-tx-${Date.now()}-${Math.random().toString(36).substring(7)}`
};

async function testReviewEndpoint() {
  console.log('🧪 Testing POST /api/reviews endpoint...\n');
  console.log('📤 Request payload:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log('\n');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    console.log(`📥 Response headers:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`📥 Response body (raw):`, responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log(`📥 Response body (parsed):`);
      console.log(JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.warn('⚠️ Response is not valid JSON');
    }

    if (response.ok) {
      console.log('\n✅ Test PASSED - Review created successfully!');
      console.log(`   Walrus ID: ${responseData?.walrusId || 'N/A'}`);
      console.log(`   Review ID: ${responseData?.review?.id || 'N/A'}`);
    } else {
      console.log('\n❌ Test FAILED - Server returned error');
      console.log(`   Error type: ${responseData?.error || 'Unknown'}`);
      console.log(`   Error message: ${responseData?.message || responseData?.error || 'No message'}`);
      if (responseData?.details) {
        console.log(`   Details: ${responseData.details}`);
      }
      if (responseData?.missingFields) {
        console.log(`   Missing fields: ${responseData.missingFields.join(', ')}`);
      }
    }
  } catch (error) {
    console.error('\n❌ Test FAILED - Network or parsing error');
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure the API server is running on http://localhost:3001');
      console.error('   Run: node server.mjs');
    }
  }
}

// Run the test
testReviewEndpoint().catch(console.error);

