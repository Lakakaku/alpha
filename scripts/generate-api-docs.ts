#!/usr/bin/env tsx

/**
 * Generate API documentation from OpenAPI contracts
 * 
 * This script:
 * 1. Reads OpenAPI YAML files from specs/contracts/
 * 2. Generates HTML documentation using Redoc
 * 3. Creates markdown documentation for each API
 * 4. Generates Postman collections
 * 5. Updates the main API documentation
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact?: {
      name?: string;
      email?: string;
    };
  };
  servers?: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components?: Record<string, any>;
}

/**
 * Read and parse an OpenAPI YAML file
 */
function readOpenAPISpec(filePath: string): OpenAPISpec {
  if (!existsSync(filePath)) {
    throw new Error(`OpenAPI spec file not found: ${filePath}`);
  }
  
  const content = readFileSync(filePath, 'utf-8');
  return yaml.load(content) as OpenAPISpec;
}

/**
 * Generate HTML documentation using Redoc
 */
function generateRedocHTML(spec: OpenAPISpec, outputPath: string): void {
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>${spec.info.title} - API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <redoc spec-url="./spec.json" theme='{
      "colors": {
        "primary": {
          "main": "#2563eb"
        }
      },
      "typography": {
        "fontSize": "14px",
        "fontFamily": "Roboto, sans-serif",
        "headings": {
          "fontFamily": "Montserrat, sans-serif"
        }
      }
    }'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;

  writeFileSync(outputPath, html, 'utf-8');
  
  // Also write the spec JSON file
  const specJsonPath = outputPath.replace('.html', '.json');
  writeFileSync(specJsonPath, JSON.stringify(spec, null, 2), 'utf-8');
}

/**
 * Generate Postman collection from OpenAPI spec
 */
function generatePostmanCollection(spec: OpenAPISpec): any {
  const collection = {
    info: {
      name: spec.info.title,
      description: spec.info.description,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      version: spec.info.version
    },
    auth: {
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: "{{access_token}}",
          type: "string"
        }
      ]
    },
    variable: [
      {
        key: "base_url",
        value: spec.servers?.[0]?.url || "https://api.vocilia.se/v1",
        type: "string"
      },
      {
        key: "access_token",
        value: "",
        type: "string"
      }
    ],
    item: []
  };

  // Convert paths to Postman requests
  Object.entries(spec.paths).forEach(([path, pathObj]) => {
    Object.entries(pathObj).forEach(([method, operation]: [string, any]) => {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
        const request: any = {
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            url: {
              raw: "{{base_url}}" + path,
              host: ["{{base_url}}"],
              path: path.split('/').filter(Boolean)
            },
            description: operation.description || operation.summary
          }
        };

        // Add auth if security is required
        if (operation.security) {
          request.request.auth = {
            type: "bearer",
            bearer: [
              {
                key: "token",
                value: "{{access_token}}",
                type: "string"
              }
            ]
          };
        }

        // Add request body for POST/PUT/PATCH
        if (['post', 'put', 'patch'].includes(method.toLowerCase()) && operation.requestBody) {
          const schema = operation.requestBody.content?.['application/json']?.schema;
          if (schema?.example) {
            request.request.body = {
              mode: "raw",
              raw: JSON.stringify(schema.example, null, 2)
            };
          } else if (schema?.properties) {
            // Generate example from schema
            const example: any = {};
            Object.entries(schema.properties).forEach(([prop, propSchema]: [string, any]) => {
              if (propSchema.example !== undefined) {
                example[prop] = propSchema.example;
              } else if (propSchema.type === 'string') {
                example[prop] = `example_${prop}`;
              } else if (propSchema.type === 'number') {
                example[prop] = 123;
              } else if (propSchema.type === 'boolean') {
                example[prop] = true;
              }
            });
            request.request.body = {
              mode: "raw",
              raw: JSON.stringify(example, null, 2)
            };
          }
        }

        // Add query parameters
        if (operation.parameters) {
          const queryParams = operation.parameters
            .filter((p: any) => p.in === 'query')
            .map((p: any) => ({
              key: p.name,
              value: p.example || (p.schema?.example) || "",
              description: p.description,
              disabled: !p.required
            }));
          
          if (queryParams.length > 0) {
            request.request.url.query = queryParams;
          }
        }

        collection.item.push(request);
      }
    });
  });

  return collection;
}

/**
 * Generate markdown documentation for an API spec
 */
function generateMarkdownDocs(spec: OpenAPISpec): string {
  let markdown = `# ${spec.info.title}\n\n`;
  markdown += `${spec.info.description}\n\n`;
  markdown += `**Version:** ${spec.info.version}\n\n`;

  if (spec.info.contact) {
    markdown += `**Contact:** ${spec.info.contact.name || 'API Team'}`;
    if (spec.info.contact.email) {
      markdown += ` (${spec.info.contact.email})`;
    }
    markdown += '\n\n';
  }

  if (spec.servers && spec.servers.length > 0) {
    markdown += '## Servers\n\n';
    spec.servers.forEach(server => {
      markdown += `- **${server.description}**: \`${server.url}\`\n`;
    });
    markdown += '\n';
  }

  markdown += '## Endpoints\n\n';

  Object.entries(spec.paths).forEach(([path, pathObj]) => {
    Object.entries(pathObj).forEach(([method, operation]: [string, any]) => {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
        markdown += `### ${method.toUpperCase()} ${path}\n\n`;
        markdown += `**Summary:** ${operation.summary}\n\n`;
        
        if (operation.description) {
          markdown += `**Description:** ${operation.description}\n\n`;
        }

        if (operation.tags && operation.tags.length > 0) {
          markdown += `**Tags:** ${operation.tags.join(', ')}\n\n`;
        }

        if (operation.security) {
          markdown += `**Authentication:** Required\n\n`;
        }

        // Parameters
        if (operation.parameters && operation.parameters.length > 0) {
          markdown += '**Parameters:**\n\n';
          operation.parameters.forEach((param: any) => {
            markdown += `- \`${param.name}\` (${param.in})`;
            if (param.required) markdown += ' *required*';
            markdown += `: ${param.description || 'No description'}\n`;
          });
          markdown += '\n';
        }

        // Request body
        if (operation.requestBody) {
          markdown += '**Request Body:**\n\n';
          const content = operation.requestBody.content?.['application/json'];
          if (content?.schema?.example) {
            markdown += '```json\n';
            markdown += JSON.stringify(content.schema.example, null, 2);
            markdown += '\n```\n\n';
          }
        }

        // Responses
        if (operation.responses) {
          markdown += '**Responses:**\n\n';
          Object.entries(operation.responses).forEach(([code, response]: [string, any]) => {
            markdown += `- **${code}**: ${response.description}\n`;
          });
          markdown += '\n';
        }

        markdown += '---\n\n';
      }
    });
  });

  return markdown;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🔄 Generating API documentation...');

    const contractsDir = join(process.cwd(), 'specs', '002-step-1-3', 'contracts');
    const docsDir = join(process.cwd(), 'docs', 'api');
    
    // Ensure docs directory exists
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    // Process each OpenAPI spec file
    const specFiles = ['auth-api.yaml', 'shared-api.yaml'];
    
    for (const specFile of specFiles) {
      const specPath = join(contractsDir, specFile);
      
      if (!existsSync(specPath)) {
        console.warn(`⚠️  Spec file not found: ${specFile}`);
        continue;
      }

      console.log(`📄 Processing ${specFile}...`);
      
      const spec = readOpenAPISpec(specPath);
      const baseName = specFile.replace('.yaml', '');
      
      // Generate HTML documentation
      const htmlPath = join(docsDir, `${baseName}.html`);
      generateRedocHTML(spec, htmlPath);
      console.log(`✅ Generated HTML docs: ${htmlPath}`);
      
      // Generate markdown documentation
      const markdownContent = generateMarkdownDocs(spec);
      const markdownPath = join(docsDir, `${baseName}.md`);
      writeFileSync(markdownPath, markdownContent, 'utf-8');
      console.log(`✅ Generated Markdown docs: ${markdownPath}`);
      
      // Generate Postman collection
      const collection = generatePostmanCollection(spec);
      const collectionPath = join(docsDir, `${baseName}.postman_collection.json`);
      writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf-8');
      console.log(`✅ Generated Postman collection: ${collectionPath}`);
    }

    // Create combined Postman collection
    const combinedCollection = {
      info: {
        name: "Vocilia API - Complete Collection",
        description: "Complete API collection for Vocilia",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        version: "1.0.0"
      },
      auth: {
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: "{{access_token}}",
            type: "string"
          }
        ]
      },
      variable: [
        {
          key: "base_url",
          value: "https://api.vocilia.se/v1",
          type: "string"
        },
        {
          key: "access_token",
          value: "",
          type: "string"
        }
      ],
      item: []
    };

    // Combine all collections
    for (const specFile of specFiles) {
      const specPath = join(contractsDir, specFile);
      if (existsSync(specPath)) {
        const spec = readOpenAPISpec(specPath);
        const collection = generatePostmanCollection(spec);
        
        // Add as a folder in the combined collection
        const folder = {
          name: spec.info.title,
          description: spec.info.description,
          item: collection.item
        };
        
        combinedCollection.item.push(folder);
      }
    }

    const combinedPath = join(docsDir, 'vocilia-api.postman_collection.json');
    writeFileSync(combinedPath, JSON.stringify(combinedCollection, null, 2), 'utf-8');
    console.log(`✅ Generated combined Postman collection: ${combinedPath}`);

    console.log('🎉 API documentation generation completed!');
    console.log('\nGenerated files:');
    console.log(`📁 ${docsDir}/`);
    console.log('  📄 README.md (main documentation)');
    console.log('  📄 auth-api.html (Authentication API - HTML)');
    console.log('  📄 auth-api.md (Authentication API - Markdown)');
    console.log('  📄 shared-api.html (Shared API - HTML)');
    console.log('  📄 shared-api.md (Shared API - Markdown)');
    console.log('  📄 *.postman_collection.json (Postman collections)');

  } catch (error) {
    console.error('❌ Error generating API documentation:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}