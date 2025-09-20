# @vocilia/tsconfig

Shared TypeScript configuration for Project Alpha (Vocilia).

## Overview

This package provides consistent TypeScript configuration across all Vocilia applications and packages. It includes strict type checking, modern ES2022 features, and environment-specific configurations.

## Installation

```bash
# In workspace root
pnpm add -D @vocilia/tsconfig
```

## Usage

### Base Configuration

For shared packages and libraries:

```json
{
  "extends": "@vocilia/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

### React Configuration

For React applications and components:

```json
{
  "extends": "@vocilia/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

### Next.js Configuration

For Next.js applications:

```json
{
  "extends": "@vocilia/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Available Configurations

### `base.json`
- **Target**: ES2022 with modern features
- **Strict Mode**: Full TypeScript strict mode enabled
- **Module System**: ESNext with bundler resolution
- **Type Checking**: Enhanced with additional strict checks
- **Best For**: Shared packages, utilities, backend services

### `react.json`
- **Extends**: base.json
- **JSX**: React JSX support
- **DOM Types**: Browser DOM libraries included
- **Best For**: React components, UI libraries

### `nextjs.json`
- **Extends**: react.json
- **Incremental**: Faster builds with incremental compilation
- **Plugins**: Next.js specific TypeScript plugin
- **Best For**: Next.js applications (customer, business, admin portals)

## Configuration Features

### Strict Type Checking
All configurations include comprehensive strict type checking:

```typescript
// These will cause TypeScript errors:

// Unchecked indexed access
const value = obj[key] // Error: possibly undefined

// Unused locals
const unusedVar = 'test' // Error: unused local

// Implicit returns
function maybeReturn(x: number) {
  if (x > 0) return x
  // Error: not all code paths return a value
}

// Fallthrough cases
switch (value) {
  case 'a':
    console.log('a')
  case 'b': // Error: fallthrough case
    console.log('b')
}
```

### Module Resolution
- **ESNext modules** with bundler resolution
- **JSON imports** supported
- **Isolated modules** for better build performance
- **Synthetic default imports** enabled

### Build Output
- **Declaration files** (.d.ts) generated
- **Source maps** included for debugging
- **Import helpers** for optimized output
- **Comments preserved** in declaration files

## Environment-Specific Features

### React Applications
```typescript
// JSX support
const component = <div>Hello World</div>

// React types available
import { FC, useState } from 'react'

const MyComponent: FC = () => {
  const [state, setState] = useState<string>()
  return <div>{state}</div>
}
```

### Next.js Applications
```typescript
// Next.js types available
import { GetServerSideProps, NextPage } from 'next'

const Page: NextPage = () => <div>Hello</div>

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}
```

## IDE Integration

### VS Code Settings
Add to your workspace `.vscode/settings.json`:

```json
{
  "typescript.preferences.strictNullChecks": true,
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.suggestionActions.enabled": false,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  }
}
```

### ESLint Integration
The TypeScript configuration works well with ESLint:

```json
{
  "extends": [
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parserOptions": {
    "project": "./tsconfig.json"
  }
}
```

## Development Workflow

### Type Checking
```bash
# Check types without emitting files
npx tsc --noEmit

# Check types in watch mode
npx tsc --noEmit --watch
```

### Building
```bash
# Build with TypeScript
npx tsc

# Build with your bundler (preserves tsconfig settings)
npx vite build  # or webpack, rollup, etc.
```

## Best Practices

### Project Structure
```
my-package/
├── src/
│   ├── index.ts
│   └── components/
├── dist/           # Generated output
├── tsconfig.json   # Extends @vocilia/tsconfig
└── package.json
```

### Import Conventions
```typescript
// Explicit file extensions for better tooling
import { utils } from './utils.js'
import type { User } from './types.js'

// Use type-only imports when possible
import type { ComponentProps } from 'react'
```

### Error Handling
```typescript
// Strict null checks encourage proper error handling
function processUser(user: User | null): string {
  if (!user) {
    throw new Error('User is required')
  }
  return user.name // TypeScript knows user is not null
}
```

## Compatibility

- **TypeScript**: ^5.0.0
- **Node.js**: ^18.0.0
- **React**: ^18.0.0 (for react.json)
- **Next.js**: ^14.0.0 (for nextjs.json)

## License

Private package - restricted access