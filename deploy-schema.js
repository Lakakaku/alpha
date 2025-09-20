#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

// Configuration
const SUPABASE_URL = 'https://wtdckfgdcryjvbllcajq.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZGNrZmdkY3J5anZibGxjYWpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODIwODE0NywiZXhwIjoyMDczNzg0MTQ3fQ.Zk_SqbQpDihTXZu0Bz7ScDzxMKLIu7n-v3tkzU6QX3w';

// Read the schema file
const schemaPath = '/Users/lucasjenner/alpha/specs/001-step-1-2/contracts/schema.sql';
const schema = fs.readFileSync(schemaPath, 'utf8');

console.log('🚀 Starting database schema deployment...');
console.log(`📁 Schema file: ${schemaPath}`);
console.log(`🔗 Target database: ${SUPABASE_URL}`);

// Split schema into individual statements to execute them one by one
const statements = schema
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
  .map(stmt => stmt + ';');

console.log(`📝 Found ${statements.length} SQL statements to execute`);

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'wtdckfgdcryjvbllcajq.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
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

async function deploySchema() {
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 100).replace(/\s+/g, ' ');

    console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}${statement.length > 100 ? '...' : ''}`);

    try {
      await executeSQL(statement);
      console.log(`✅ Success`);
      successCount++;
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      errorCount++;

      // Continue with other statements unless it's a critical error
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  Skipping - entity already exists`);
      }
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n🎯 Deployment Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total: ${statements.length}`);

  if (errorCount === 0) {
    console.log('🎉 Schema deployment completed successfully!');
  } else {
    console.log('⚠️  Schema deployment completed with some errors.');
  }
}

// Alternative approach using the SQL editor endpoint
async function deploySchemaBatch() {
  console.log('\n🔄 Attempting batch deployment via SQL editor...');

  try {
    const result = await executeSQL(schema);
    console.log('✅ Batch deployment successful!');
    console.log('Response:', result.body);
  } catch (error) {
    console.log('❌ Batch deployment failed:', error.message);
    console.log('🔄 Falling back to statement-by-statement deployment...');
    await deploySchema();
  }
}

// Start deployment
deploySchemaBatch().catch(console.error);