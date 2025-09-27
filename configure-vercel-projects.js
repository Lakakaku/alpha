const https = require('https');

// Configuration for each project
const projectConfigs = [
  {
    id: 'prj_QY7DIN4L29cdLluJ6VIIfhlGeev8', // vocilia-customer-prod
    name: 'vocilia-customer-prod',
    rootDirectory: 'apps/customer',
    framework: 'nextjs',
    buildCommand: 'cd ../.. && pnpm run build --filter=@vocilia/customer',
    installCommand: 'cd ../.. && pnpm install',
    outputDirectory: '.next'
  }
];

async function updateProject(config) {
  const data = JSON.stringify({
    framework: config.framework,
    rootDirectory: config.rootDirectory,
    buildCommand: config.buildCommand,
    installCommand: config.installCommand,
    outputDirectory: config.outputDirectory
  });

  const options = {
    hostname: 'api.vercel.com',
    port: 443,
    path: `/v10/projects/${config.id}`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ Updated ${config.name}`);
          resolve(JSON.parse(responseData));
        } else {
          console.error(`❌ Failed to update ${config.name}: ${res.statusCode}`);
          console.error(responseData);
          reject(new Error(responseData));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Configuring Vercel projects for monorepo...');
  
  for (const config of projectConfigs) {
    try {
      await updateProject(config);
    } catch (error) {
      console.error(`Failed to update ${config.name}:`, error.message);
    }
  }
  
  console.log('Done!');
}

main().catch(console.error);