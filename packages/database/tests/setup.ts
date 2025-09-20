import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables for testing
config({ path: '../../.env.test' });

// Ensure test environment variables are set
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY in test environment');
}

// Global test timeout
jest.setTimeout(30000);

// Setup global test client for contract and integration tests
const testClient = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_ANON_KEY || 'test-key'
);

declare global {
  var testSupabaseClient: typeof testClient;
}

global.testSupabaseClient = testClient;

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
  if (testClient) {
    // Supabase client doesn't have explicit close method
    // This is handled automatically
  }
});

export { testClient };