#!/usr/bin/env node

// Automated Vercel project configuration script
const { execSync } = require('child_process');

const projects = [
  {
    name: 'vocilia-customer-prod',
    rootDir: 'apps/customer',
    buildFilter: '@vocilia/customer'
  },
  {
    name: 'vocilia-business-prod', 
    rootDir: 'apps/business',
    buildFilter: '@vocilia/business'
  },
  {
    name: 'vocilia-admin-prod',
    rootDir: 'apps/admin', 
    buildFilter: '@vocilia/admin'
  }
];

const baseEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL=https://wtdckfgdcryjvbllcajq.supabase.co',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZGNrZmdkY3J5anZibGxjYWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMDgxNDcsImV4cCI6MjA3Mzc4NDE0N30.KF2AzXqPLvT8VDUiLOYu67DUvU6rnUZHqfpURdp14pU',
  'NEXT_PUBLIC_SUPPORT_ENABLED=true',
  'NEXT_PUBLIC_SUPPORT_CHANNELS=phone,email,chat',
  'NEXT_PUBLIC_COMMUNICATION_PREFERENCES_ENABLED=true',
  'NEXT_PUBLIC_VERIFICATION_NOTIFICATIONS_ENABLED=true',
  'NEXT_PUBLIC_COMMUNICATION_METRICS_ENABLED=true',
  'NEXT_PUBLIC_SUPPORT_SYSTEM_ENABLED=true'
];

async function setProjectEnvVars(projectName, apiUrl) {
  console.log(`🔧 Setting environment variables for ${projectName}...`);
  
  const envVars = [
    ...baseEnvVars,
    `NEXT_PUBLIC_API_URL=${apiUrl}`
  ];
  
  for (const envVar of envVars) {
    try {
      execSync(`npx vercel env add ${envVar} production --project=${projectName} --yes`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.log(`ℹ️  Variable ${envVar.split('=')[0]} may already exist`);
    }
  }
}

async function main() {
  const apiUrl = process.argv[2];
  
  if (!apiUrl) {
    console.error('❌ Please provide the Railway backend URL as an argument');
    process.exit(1);
  }
  
  console.log(`🚀 Configuring Vercel projects with API URL: ${apiUrl}`);
  
  for (const project of projects) {
    await setProjectEnvVars(project.name, apiUrl);
    console.log(`✅ Configured ${project.name}`);
  }
  
  console.log('🎉 All Vercel projects configured!');
  console.log('\n📝 Next steps:');
  console.log('1. Go to Vercel dashboard to set Root Directory for each project');
  console.log('2. Deploy each project');
}

if (require.main === module) {
  main().catch(console.error);
}