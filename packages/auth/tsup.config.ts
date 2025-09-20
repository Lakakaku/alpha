import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/**/*.tsx',
    'src/business/registration.ts',
    'src/admin/verification.ts'
  ],
  format: ['cjs', 'esm'],
  dts: false, // Skip type declarations for now
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxFactory = 'React.createElement'
    options.jsxFragment = 'React.Fragment'
  },
})