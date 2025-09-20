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

async function deployRemainingSchema() {
  console.log('🚀 Deploying remaining schema components...');

  const statements = [
    // Utility functions
    `CREATE OR REPLACE FUNCTION create_time_tolerance(customer_time TIMESTAMP WITH TIME ZONE)
RETURNS TSRANGE AS $$
BEGIN
  RETURN tsrange(
    customer_time - INTERVAL '2 minutes',
    customer_time + INTERVAL '2 minutes',
    '[]'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE`,

    `CREATE OR REPLACE FUNCTION create_amount_tolerance(customer_amount DECIMAL)
RETURNS NUMRANGE AS $$
BEGIN
  RETURN numrange(
    customer_amount - 2.0,
    customer_amount + 2.0,
    '[]'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE`,

    `CREATE OR REPLACE FUNCTION calculate_context_score(
  store_profile_data JSONB,
  custom_questions_data JSONB,
  ai_config_data JSONB,
  fraud_settings_data JSONB
)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Store profile completeness (25 points)
  IF store_profile_data IS NOT NULL AND jsonb_array_length(jsonb_object_keys(store_profile_data)) > 0 THEN
    score := score + 25;
  END IF;

  -- Custom questions (25 points)
  IF custom_questions_data IS NOT NULL AND jsonb_array_length(custom_questions_data) > 0 THEN
    score := score + 25;
  END IF;

  -- AI configuration (25 points)
  IF ai_config_data IS NOT NULL AND jsonb_array_length(jsonb_object_keys(ai_config_data)) > 0 THEN
    score := score + 25;
  END IF;

  -- Fraud detection settings (25 points)
  IF fraud_settings_data IS NOT NULL AND jsonb_array_length(jsonb_object_keys(fraud_settings_data)) > 0 THEN
    score := score + 25;
  END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE`,

    // Trigger functions
    `CREATE OR REPLACE FUNCTION update_context_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.context_score := calculate_context_score(
    NEW.store_profile,
    NEW.custom_questions,
    NEW.ai_configuration,
    NEW.fraud_detection_settings
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,

    `CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,

    // Triggers
    `CREATE TRIGGER context_score_update
  BEFORE INSERT OR UPDATE ON context_window
  FOR EACH ROW
  EXECUTE FUNCTION update_context_score()`,

    `CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

    `CREATE TRIGGER update_user_accounts_updated_at BEFORE UPDATE ON user_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

    `CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
  ];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

    console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}${statement.length > 80 ? '...' : ''}`);

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

  console.log('\n🎯 Functions and Triggers Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total: ${statements.length}`);
}

deployRemainingSchema().catch(console.error);