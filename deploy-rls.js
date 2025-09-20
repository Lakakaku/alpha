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

async function deployRLS() {
  console.log('🔐 Deploying Row Level Security...');

  const statements = [
    // Enable RLS on all tables
    'ALTER TABLE businesses ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE stores ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE context_window ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE transactions ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE feedback_sessions ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE verification_record ENABLE ROW LEVEL SECURITY',

    // Business isolation policies
    `CREATE POLICY "business_isolation" ON businesses
FOR ALL USING (id = (auth.jwt() ->> 'business_id')::uuid)`,

    `CREATE POLICY "admin_business_access" ON businesses
FOR ALL USING (auth.jwt() ->> 'role' = 'admin')`,

    // User account policies
    `CREATE POLICY "own_account_access" ON user_accounts
FOR ALL USING (id = auth.uid())`,

    `CREATE POLICY "business_staff_access" ON user_accounts
FOR SELECT USING (
  business_id = (auth.jwt() ->> 'business_id')::uuid
  AND auth.jwt() ->> 'role' IN ('business_owner', 'admin')
)`,

    `CREATE POLICY "admin_user_access" ON user_accounts
FOR ALL USING (auth.jwt() ->> 'role' = 'admin')`,

    // Store policies
    `CREATE POLICY "store_business_isolation" ON stores
FOR ALL USING (business_id = (auth.jwt() ->> 'business_id')::uuid)`,

    `CREATE POLICY "admin_store_access" ON stores
FOR ALL USING (auth.jwt() ->> 'role' = 'admin')`,

    `CREATE POLICY "public_qr_lookup" ON stores
FOR SELECT USING (is_active = true)`,

    // Context window policies
    `CREATE POLICY "context_business_access" ON context_window
FOR ALL USING (
  store_id IN (
    SELECT id FROM stores
    WHERE business_id = (auth.jwt() ->> 'business_id')::uuid
  )
)`,

    `CREATE POLICY "admin_context_access" ON context_window
FOR ALL USING (auth.jwt() ->> 'role' = 'admin')`,

    // Transaction policies
    `CREATE POLICY "transaction_business_access" ON transactions
FOR ALL USING (
  store_id IN (
    SELECT id FROM stores
    WHERE business_id = (auth.jwt() ->> 'business_id')::uuid
  )
)`,

    `CREATE POLICY "admin_transaction_access" ON transactions
FOR ALL USING (auth.jwt() ->> 'role' = 'admin')`,

    // Feedback session policies
    `CREATE POLICY "feedback_business_access" ON feedback_sessions
FOR ALL USING (
  store_id IN (
    SELECT id FROM stores
    WHERE business_id = (auth.jwt() ->> 'business_id')::uuid
  )
)`,

    `CREATE POLICY "admin_feedback_access" ON feedback_sessions
FOR ALL USING (auth.jwt() ->> 'role' = 'admin')`,

    // Verification record policies
    `CREATE POLICY "verification_business_access" ON verification_record
FOR ALL USING (business_id = (auth.jwt() ->> 'business_id')::uuid)`,

    `CREATE POLICY "admin_verification_access" ON verification_record
FOR ALL USING (auth.jwt() ->> 'role' = 'admin')`
  ];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

    console.log(`\n[${i + 1}/${statements.length}] Deploying: ${preview}${statement.length > 80 ? '...' : ''}`);

    try {
      await executeSQL(statement);
      console.log(`✅ Success`);
      successCount++;
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      errorCount++;

      // Continue even if policy already exists
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  Policy already exists, continuing...`);
      }
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  console.log('\n🔐 RLS Deployment Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total: ${statements.length}`);
}

deployRLS().catch(console.error);