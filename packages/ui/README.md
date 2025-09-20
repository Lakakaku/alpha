# @vocilia/ui

Shared UI components and design system for Project Alpha (Vocilia).

## Overview

This package provides a consistent set of React components built with Tailwind CSS and Radix UI primitives. It's designed to be used across all Vocilia applications (customer, business, and admin portals).

## Installation

```bash
# In workspace root
pnpm add @vocilia/ui
```

## Usage

### Components

```tsx
import { Button, Card, Input, Badge } from '@vocilia/ui'
import '@vocilia/ui/styles' // Import global styles

function MyComponent() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Welcome to Vocilia</Card.Title>
        <Card.Description>Feedback management made simple</Card.Description>
      </Card.Header>
      <Card.Content>
        <Input placeholder="Enter your email" />
        <Button>Get Started</Button>
        <Badge variant="success">Active</Badge>
      </Card.Content>
    </Card>
  )
}
```

### Styling

The package includes:
- Tailwind CSS configuration
- Global CSS styles
- Component variants using `class-variance-authority`
- Utility function `cn()` for conditional class names

### Available Components

- **Button** - Primary actions with multiple variants (default, destructive, outline, secondary, ghost, link)
- **Input** - Form input fields with consistent styling
- **Card** - Container component with header, content, and footer sections
- **Badge** - Status indicators and labels

## Development

```bash
# Build package
pnpm build

# Watch mode
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Configuration

### Tailwind Config

The package exports a Tailwind configuration that can be extended:

```js
// tailwind.config.js
import { tailwindConfig } from '@vocilia/ui/tailwind.config.js'

export default {
  ...tailwindConfig,
  content: [
    ...tailwindConfig.content,
    './src/**/*.{js,ts,jsx,tsx}'
  ]
}
```

## Dependencies

- React 18+
- Tailwind CSS
- Radix UI primitives
- Lucide React (for icons)

## License

Private package - restricted access