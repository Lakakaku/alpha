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

async function fixFunctions() {
  console.log('🔧 Fixing utility functions...');

  const statements = [
    `CREATE OR REPLACE FUNCTION create_time_tolerance(customer_time TIMESTAMP WITH TIME ZONE)
RETURNS TSRANGE AS $$
BEGIN
  RETURN tsrange(
    customer_time - INTERVAL '2 minutes',
    customer_time + INTERVAL '2 minutes'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE`,

    `CREATE OR REPLACE FUNCTION create_amount_tolerance(customer_amount DECIMAL)
RETURNS NUMRANGE AS $$
BEGIN
  RETURN numrange(
    customer_amount - 2.0,
    customer_amount + 2.0
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE`
  ];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Fixing function...`);

    try {
      await executeSQL(statement);
      console.log(`✅ Success`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

fixFunctions().catch(console.error);