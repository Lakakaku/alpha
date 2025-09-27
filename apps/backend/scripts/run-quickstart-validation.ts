#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });

async function runQuickstartValidation() {
  console.log('🚀 Starting Quickstart Validation for Swish Payment Integration');
  console.log('='.repeat(70));
  
  // Check required environment variables
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
  
  // Check database connectivity
  try {
    console.log('🔍 Testing database connectivity...');
    execSync('npx tsx src/config/test-db-connection.ts', { stdio: 'inherit' });
    console.log('✅ Database connectivity confirmed');
  } catch (error) {
    console.error('❌ Database connectivity failed:', error);
    process.exit(1);
  }
  
  // Run migration to ensure schema is up to date
  try {
    console.log('📊 Checking database schema...');
    execSync('npx supabase db push', { stdio: 'inherit' });
    console.log('✅ Database schema up to date');
  } catch (error) {
    console.log('⚠️  Database schema check failed, proceeding anyway:', error);
  }
  
  // Run the quickstart validation tests
  try {
    console.log('🧪 Running quickstart validation scenarios...');
    console.log('');
    
    const testCommand = 'npx jest tests/validation/quickstart-scenarios.test.ts --verbose --testTimeout=600000';
    execSync(testCommand, { stdio: 'inherit' });
    
    console.log('');
    console.log('✅ All quickstart validation scenarios passed!');
    console.log('🎉 Swish Payment Integration is ready for production');
    
  } catch (error) {
    console.error('❌ Quickstart validation failed');
    console.error('Please review the test output above for details');
    process.exit(1);
  }
}

// Run the validation if called directly
if (require.main === module) {
  runQuickstartValidation().catch((error) => {
    console.error('Fatal error during quickstart validation:', error);
    process.exit(1);
  });
}

export { runQuickstartValidation };