#!/usr/bin/env node

const https = require('https');

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_ID = process.env.SUPABASE_PROJECT_REF;

if (!ACCESS_TOKEN || !PROJECT_ID) {
  console.error('❌ Error: SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF environment variables are required');
  process.exit(1);
}

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function deployIndexes() {
  console.log('🚀 Deploying performance indexes...');

  const statements = [
    // Business entities
    'CREATE INDEX idx_stores_business_id ON stores (business_id)',
    'CREATE UNIQUE INDEX idx_stores_qr_code ON stores (qr_code_data)',
    'CREATE INDEX idx_stores_active ON stores (business_id, is_active) WHERE is_active = true',

    // User management
    'CREATE INDEX idx_user_accounts_business ON user_accounts (business_id)',
    'CREATE INDEX idx_user_accounts_role ON user_accounts (role)',

    // Context windows
    'CREATE UNIQUE INDEX idx_context_window_store ON context_window (store_id)',
    'CREATE INDEX idx_context_window_score ON context_window (context_score)',

    // Transactions and tolerance matching
    'CREATE INDEX idx_transactions_tolerance ON transactions USING GIST (customer_time_range, customer_amount_range)',
    'CREATE INDEX idx_transactions_store_verification ON transactions (store_id, verification_status, created_at)',
    'CREATE INDEX idx_transactions_weekly ON transactions (store_id, created_at) WHERE verification_status = \'pending\'',

    // Feedback sessions
    'CREATE INDEX idx_feedback_sessions_store_time ON feedback_sessions (store_id, created_at DESC)',
    'CREATE INDEX idx_feedback_sessions_quality ON feedback_sessions (store_id, quality_grade, created_at)',
    'CREATE INDEX idx_feedback_sessions_verification ON feedback_sessions (transaction_id, status) WHERE status = \'completed\'',

    // Verification records
    'CREATE UNIQUE INDEX idx_verification_business_week ON verification_record (business_id, week_identifier)',
    'CREATE INDEX idx_verification_status ON verification_record (status, created_at)'
  ];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

    console.log(`\n[${i + 1}/${statements.length}] Creating: ${preview}${statement.length > 80 ? '...' : ''}`);

    try {
      await executeSQL(statement);
      console.log(`✅ Success`);
      successCount++;
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      errorCount++;

      // Continue even if index already exists
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  Index already exists, continuing...`);
      }
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n🎯 Indexes Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total: ${statements.length}`);
}

deployIndexes().catch(console.error);