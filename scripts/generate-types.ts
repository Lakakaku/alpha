#!/usr/bin/env tsx

/**
 * Generate TypeScript types from Supabase schema
 * 
 * This script:
 * 1. Connects to Supabase using the service role key
 * 2. Extracts schema information for all tables
 * 3. Generates TypeScript type definitions
 * 4. Updates packages/types/src/database.ts with the generated types
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_table?: string;
  foreign_column?: string;
}

interface TableInfo {
  table_name: string;
  columns: ColumnInfo[];
}

/**
 * Map PostgreSQL types to TypeScript types
 */
function mapPostgresToTypeScript(pgType: string, isNullable: boolean): string {
  const baseType = (() => {
    switch (pgType.toLowerCase()) {
      case 'bigint':
      case 'integer':
      case 'smallint':
      case 'decimal':
      case 'numeric':
      case 'real':
      case 'double precision':
        return 'number';
      case 'text':
      case 'varchar':
      case 'character':
      case 'character varying':
      case 'uuid':
        return 'string';
      case 'boolean':
        return 'boolean';
      case 'timestamp':
      case 'timestamp with time zone':
      case 'timestamp without time zone':
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

  return isNullable && isNullable === 'YES' ? `${baseType} | null` : baseType;
}

/**
 * Get table and column information from information_schema
 */
async function getTableInfo(): Promise<TableInfo[]> {
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .not('table_name', 'like', 'pg_%')
    .not('table_name', 'like', '_prisma_%');

  if (tablesError) {
    throw new Error(`Error fetching tables: ${tablesError.message}`);
  }

  const tableInfoPromises = tables.map(async (table): Promise<TableInfo> => {
    // Get column information
    const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
      table_name_param: table.table_name
    });

    if (columnsError) {
      console.warn(`Warning: Could not fetch columns for ${table.table_name}: ${columnsError.message}`);
      
      // Fallback: try direct query to information_schema
      const { data: fallbackColumns, error: fallbackError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', table.table_name)
        .order('ordinal_position');

      if (fallbackError) {
        throw new Error(`Error fetching columns for ${table.table_name}: ${fallbackError.message}`);
      }

      return {
        table_name: table.table_name,
        columns: (fallbackColumns || []).map(col => ({
          column_name: col.column_name,
          data_type: col.data_type,
          is_nullable: col.is_nullable,
          column_default: col.column_default,
          is_primary_key: col.column_name === 'id', // Assume id is primary key
          is_foreign_key: col.column_name.endsWith('_id') && col.column_name !== 'id'
        }))
      };
    }

    return {
      table_name: table.table_name,
      columns: columns || []
    };
  });

  return Promise.all(tableInfoPromises);
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
  const interfaceName = tableNameToInterface(table.table_name);
  
  const properties = table.columns.map(column => {
    const tsType = mapPostgresToTypeScript(column.data_type, column.is_nullable === 'YES');
    const optional = column.is_nullable === 'YES' || column.column_default !== null ? '?' : '';
    
    let comment = '';
    if (column.is_primary_key) {
      comment = ' // Primary key';
    } else if (column.is_foreign_key) {
      comment = ` // Foreign key${column.foreign_table ? ` to ${column.foreign_table}` : ''}`;
    }
    
    return `  ${column.column_name}${optional}: ${tsType};${comment}`;
  }).join('\n');

  return `export interface ${interfaceName} {\n${properties}\n}`;
}

/**
 * Generate insert type (all optional except required fields)
 */
function generateInsertType(table: TableInfo): string {
  const interfaceName = tableNameToInterface(table.table_name);
  const insertTypeName = `${interfaceName}Insert`;
  
  const properties = table.columns
    .filter(column => !column.is_primary_key || column.column_default === null) // Exclude auto-generated PKs
    .map(column => {
      const tsType = mapPostgresToTypeScript(column.data_type, column.is_nullable === 'YES');
      const optional = column.is_nullable === 'YES' || column.column_default !== null ? '?' : '';
      
      return `  ${column.column_name}${optional}: ${tsType};`;
    }).join('\n');

  return `export interface ${insertTypeName} {\n${properties}\n}`;
}

/**
 * Generate update type (all optional)
 */
function generateUpdateType(table: TableInfo): string {
  const interfaceName = tableNameToInterface(table.table_name);
  const updateTypeName = `${interfaceName}Update`;
  
  const properties = table.columns
    .filter(column => !column.is_primary_key) // Exclude primary keys from updates
    .map(column => {
      const tsType = mapPostgresToTypeScript(column.data_type, column.is_nullable === 'YES');
      return `  ${column.column_name}?: ${tsType};`;
    }).join('\n');

  return `export interface ${updateTypeName} {\n${properties}\n}`;
}

/**
 * Generate the complete types file
 */
function generateTypesFile(tables: TableInfo[]): string {
  const header = `/**
 * Database Types - Auto-generated from Supabase schema
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
${tables.map(table => `      ${table.table_name}: {
        Row: ${tableNameToInterface(table.table_name)};
        Insert: ${tableNameToInterface(table.table_name)}Insert;
        Update: ${tableNameToInterface(table.table_name)}Update;
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
  const interfaceName = tableNameToInterface(table.table_name);
  return `export type ${interfaceName}Row = Tables<'${table.table_name}'>;
export type ${interfaceName}Insert = TablesInsert<'${table.table_name}'>;
export type ${interfaceName}Update = TablesUpdate<'${table.table_name}'>;`;
}).join('\n\n')}
`;

  return header;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🔄 Fetching database schema...');
    
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('information_schema.tables')
      .select('count')
      .limit(1)
      .single();
    
    if (testError) {
      throw new Error(`Cannot connect to Supabase: ${testError.message}`);
    }

    const tables = await getTableInfo();
    
    if (tables.length === 0) {
      console.warn('⚠️  No tables found in the public schema');
      return;
    }

    console.log(`📊 Found ${tables.length} tables: ${tables.map(t => t.table_name).join(', ')}`);

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