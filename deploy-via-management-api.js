#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const ACCESS_TOKEN = 'sbp_043d9851c31c0f85af3cfa240597eb17e586d352';
const PROJECT_ID = 'wtdckfgdcryjvbllcajq';

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

async function deploySchema() {
  console.log('🚀 Deploying schema via Management API...');

  const statements = [
    // Custom types
    "CREATE TYPE feedback_status AS ENUM ('initiated', 'in_progress', 'completed', 'failed');",
    "CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');",
    "CREATE TYPE weekly_verification_status AS ENUM ('pending', 'submitted', 'completed');",

    // Core tables
    `CREATE TABLE businesses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
      phone TEXT,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    `CREATE TABLE user_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
      role user_role NOT NULL,
      permissions JSONB DEFAULT '{}',
      last_login TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT admin_no_business CHECK (
        (role = 'admin' AND business_id IS NULL) OR
        (role != 'admin' AND business_id IS NOT NULL)
      )
    );`,

    `CREATE TABLE stores (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      location_address TEXT,
      qr_code_data TEXT UNIQUE NOT NULL,
      store_profile JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`
  ];

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
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n🎯 Deployment Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total: ${statements.length}`);
}

deploySchema().catch(console.error);