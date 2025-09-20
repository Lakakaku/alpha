import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Skip type declarations for now
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['@supabase/supabase-js'],
})