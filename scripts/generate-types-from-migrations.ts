#!/usr/bin/env tsx

/**
 * Generate TypeScript types from Supabase migrations
 * 
 * This script:
 * 1. Reads all SQL migration files
 * 2. Parses CREATE TABLE statements
 * 3. Generates TypeScript type definitions
 * 4. Updates packages/types/src/database.ts with the generated types
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignTable?: string;
  hasDefault: boolean;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

/**
 * Map PostgreSQL types to TypeScript types
 */
function mapPostgresToTypeScript(pgType: string, isNullable: boolean): string {
  const baseType = (() => {
    const normalizedType = pgType.toLowerCase().replace(/\([^)]*\)/g, ''); // Remove constraints like VARCHAR(255)
    
    switch (normalizedType) {
      case 'bigint':
      case 'integer':
      case 'int':
      case 'int4':
      case 'int8':
      case 'smallint':
      case 'decimal':
      case 'numeric':
      case 'real':
      case 'double precision':
      case 'float':
      case 'float4':
      case 'float8':
        return 'number';
      case 'text':
      case 'varchar':
      case 'character':
      case 'character varying':
      case 'char':
      case 'uuid':
        return 'string';
      case 'boolean':
      case 'bool':
        return 'boolean';
      case 'timestamp':
      case 'timestamp with time zone':
      case 'timestamp without time zone':
      case 'timestamptz':
      case 'date':
      case 'time':
        return 'string';
      case 'json':
      case 'jsonb':
        return 'Record<string, any>';
      case 'array':
        return 'any[]';
      default:
        console.warn(`Unknown PostgreSQL type: ${pgType}, defaulting to 'any'`);
        return 'any';
    }
  })();

  return isNullable ? `${baseType} | null` : baseType;
}

/**
 * Parse a CREATE TABLE statement to extract table and column information
 */
function parseCreateTable(sql: string): TableInfo[] {
  const tables: TableInfo[] = [];
  
  // Regex to match CREATE TABLE statements
  const createTableRegex = /CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\);/gi;
  
  let match;
  while ((match = createTableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const columnDefinitions = match[2];
    
    const columns = parseColumnDefinitions(columnDefinitions);
    
    tables.push({
      name: tableName,
      columns
    });
  }
  
  return tables;
}

/**
 * Parse column definitions from a CREATE TABLE statement
 */
function parseColumnDefinitions(columnDefs: string): ColumnInfo[] {
  const columns: ColumnInfo[] = [];
  
  // Split by commas that are not inside parentheses
  const columnLines = splitByCommaOutsideParens(columnDefs);
  
  for (const line of columnLines) {
    const trimmed = line.trim();
    
    // Skip constraints and other non-column definitions
    if (trimmed.startsWith('CONSTRAINT') || 
        trimmed.startsWith('PRIMARY KEY') || 
        trimmed.startsWith('FOREIGN KEY') ||
        trimmed.startsWith('UNIQUE') ||
        trimmed.startsWith('CHECK') ||
        trimmed === '') {
      continue;
    }
    
    const column = parseColumnDefinition(trimmed);
    if (column) {
      columns.push(column);
    }
  }
  
  return columns;
}

/**
 * Split a string by commas that are not inside parentheses
 */
function splitByCommaOutsideParens(str: string): string[] {
  const result: string[] = [];
  let current = '';
  let parenDepth = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === '(') {
      parenDepth++;
    } else if (char === ')') {
      parenDepth--;
    } else if (char === ',' && parenDepth === 0) {
      result.push(current);
      current = '';
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    result.push(current);
  }
  
  return result;
}

/**
 * Parse a single column definition
 */
function parseColumnDefinition(def: string): ColumnInfo | null {
  // Basic regex to match column definition
  const columnRegex = /^(\w+)\s+([^,\s]+(?:\([^)]*\))?(?:\s+\w+)*)/i;
  const match = columnRegex.exec(def.trim());
  
  if (!match) {
    return null;
  }
  
  const columnName = match[1];
  const fullType = match[2];
  
  // Extract just the base type
  const typeMatch = fullType.match(/^([^\s(]+)/);
  const baseType = typeMatch ? typeMatch[1] : fullType;
  
  const nullable = !def.toUpperCase().includes('NOT NULL');
  const isPrimaryKey = def.toUpperCase().includes('PRIMARY KEY');
  const hasDefault = def.toUpperCase().includes('DEFAULT');
  const isForeignKey = columnName.endsWith('_id') && columnName !== 'id';
  
  return {
    name: columnName,
    type: baseType,
    nullable,
    isPrimaryKey,
    isForeignKey,
    hasDefault
  };
}

/**
 * Convert table name to TypeScript interface name
 */
function tableNameToInterface(tableName: string): string {
  return tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Generate TypeScript interface for a table
 */
function generateTableInterface(table: TableInfo): string {
  const interfaceName = tableNameToInterface(table.name);
  
  const properties = table.columns.map(column => {
    const tsType = mapPostgresToTypeScript(column.type, column.nullable);
    const optional = column.nullable || column.hasDefault ? '?' : '';
    
    let comment = '';
    if (column.isPrimaryKey) {
      comment = ' // Primary key';
    } else if (column.isForeignKey) {
      comment = ' // Foreign key';
    }
    
    return `  ${column.name}${optional}: ${tsType};${comment}`;
  }).join('\n');

  return `export interface ${interfaceName} {\n${properties}\n}`;
}

/**
 * Generate insert type (all optional except required fields)
 */
function generateInsertType(table: TableInfo): string {
  const interfaceName = tableNameToInterface(table.name);
  const insertTypeName = `${interfaceName}Insert`;
  
  const properties = table.columns
    .filter(column => !column.isPrimaryKey || !column.hasDefault) // Exclude auto-generated PKs
    .map(column => {
      const tsType = mapPostgresToTypeScript(column.type, column.nullable);
      const optional = column.nullable || column.hasDefault ? '?' : '';
      
      return `  ${column.name}${optional}: ${tsType};`;
    }).join('\n');

  return `export interface ${insertTypeName} {\n${properties}\n}`;
}

/**
 * Generate update type (all optional)
 */
function generateUpdateType(table: TableInfo): string {
  const interfaceName = tableNameToInterface(table.name);
  const updateTypeName = `${interfaceName}Update`;
  
  const properties = table.columns
    .filter(column => !column.isPrimaryKey) // Exclude primary keys from updates
    .map(column => {
      const tsType = mapPostgresToTypeScript(column.type, column.nullable);
      return `  ${column.name}?: ${tsType};`;
    }).join('\n');

  return `export interface ${updateTypeName} {\n${properties}\n}`;
}

/**
 * Generate the complete types file
 */
function generateTypesFile(tables: TableInfo[]): string {
  const header = `/**
 * Database Types - Auto-generated from Supabase migrations
 * 
 * Generated on: ${new Date().toISOString()}
 * 
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Run 'npm run generate:types' to regenerate
 */

// Base database types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
${tables.map(table => `      ${table.name}: {
        Row: ${tableNameToInterface(table.name)};
        Insert: ${tableNameToInterface(table.name)}Insert;
        Update: ${tableNameToInterface(table.name)}Update;
        Relationships: [];
      };`).join('\n')}
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Individual table types
${tables.map(table => generateTableInterface(table)).join('\n\n')}

// Insert types
${tables.map(table => generateInsertType(table)).join('\n\n')}

// Update types
${tables.map(table => generateUpdateType(table)).join('\n\n')}

// Convenience type exports
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

// Specific table type exports for easier importing
${tables.map(table => {
  const interfaceName = tableNameToInterface(table.name);
  return `export type ${interfaceName}Row = Tables<'${table.name}'>;
export type ${interfaceName}Insert = TablesInsert<'${table.name}'>;
export type ${interfaceName}Update = TablesUpdate<'${table.name}'>;`;
}).join('\n\n')}
`;

  return header;
}

/**
 * Read all migration files and extract table definitions
 */
function readMigrations(): TableInfo[] {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const tables: TableInfo[] = [];
  
  try {
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Process in order
    
    console.log(`📁 Found ${files.length} migration files`);
    
    for (const file of files) {
      const filePath = join(migrationsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      const tablesInFile = parseCreateTable(content);
      
      if (tablesInFile.length > 0) {
        console.log(`📄 ${file}: Found ${tablesInFile.length} tables: ${tablesInFile.map(t => t.name).join(', ')}`);
        tables.push(...tablesInFile);
      }
    }
    
    return tables;
  } catch (error) {
    console.error(`❌ Error reading migrations: ${error}`);
    return [];
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🔄 Reading migration files...');
    
    const tables = readMigrations();
    
    if (tables.length === 0) {
      console.warn('⚠️  No tables found in migration files');
      return;
    }

    console.log(`📊 Found ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`);

    console.log('🏗️  Generating TypeScript types...');
    const typesContent = generateTypesFile(tables);

    // Ensure packages/types/src directory exists
    const typesDir = join(process.cwd(), 'packages', 'types', 'src');
    const typesFilePath = join(typesDir, 'database.ts');

    // Write the generated types
    writeFileSync(typesFilePath, typesContent, 'utf-8');

    console.log(`✅ Types generated successfully!`);
    console.log(`📁 Written to: ${typesFilePath}`);
    console.log(`📄 Generated ${tables.length} table interfaces with insert/update types`);

    // Update the main index.ts to export database types
    const indexPath = join(typesDir, 'index.ts');
    try {
      let indexContent = readFileSync(indexPath, 'utf-8');
      
      // Add database types export if not already present
      if (!indexContent.includes("export * from './database';")) {
        indexContent += "\n// Auto-generated database types\nexport * from './database';\n";
        writeFileSync(indexPath, indexContent, 'utf-8');
        console.log('📝 Updated packages/types/src/index.ts with database exports');
      }
    } catch (error) {
      console.warn('⚠️  Could not update index.ts, you may need to manually export database types');
    }

  } catch (error) {
    console.error('❌ Error generating types:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}