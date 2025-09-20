# @vocilia/shared

Shared utilities and common functionality for Project Alpha (Vocilia).

## Overview

This package provides common utilities, helpers, and shared functionality used across all Vocilia applications. It includes currency formatting, phone number validation, cashback calculations, and other business-specific utilities.

## Installation

```bash
# In workspace root
pnpm add @vocilia/shared
```

## Usage

### Currency Formatting

```typescript
import { formatCurrency } from '@vocilia/shared'

const price = formatCurrency(29.99) // "29,99 kr"
const cashback = formatCurrency(4.50) // "4,50 kr"
```

### Phone Number Utilities

```typescript
import { formatPhoneNumber, isValidSwedishPhoneNumber } from '@vocilia/shared'

// Format Swedish phone numbers
const formatted = formatPhoneNumber('0701234567') // "070-123 45 67"

// Validate Swedish phone numbers
const isValid = isValidSwedishPhoneNumber('0701234567') // true
const isInvalid = isValidSwedishPhoneNumber('123456') // false
```

### Cashback Calculations

```typescript
import { calculateCashbackPercentage } from '@vocilia/shared'

// Calculate dynamic cashback based on feedback quality
const cashback = calculateCashbackPercentage(
  rating: 5,                    // 5-star rating
  hasDetailedFeedback: true,    // Detailed text feedback provided
  sentimentScore: 0.8           // Positive sentiment (0-1 scale)
)
// Returns: 15% (max cashback)

const basicCashback = calculateCashbackPercentage(2, false, 0.1)
// Returns: 2% (base cashback only)
```

### QR Code Generation

```typescript
import { generateQRCodeData } from '@vocilia/shared'

// Generate QR code URL for store feedback
const qrData = generateQRCodeData('store-123', 'business-456')
// Returns: "https://alpha.vocilia.com/feedback/business-456/store-123"
```

### Utility Functions

```typescript
import { sleep, debounce } from '@vocilia/shared'

// Async delay
await sleep(1000) // Wait 1 second

// Debounce function calls
const debouncedSearch = debounce((query: string) => {
  // Search implementation
}, 300) // Wait 300ms between calls
```

## Available Utilities

### Currency & Formatting
- `formatCurrency(amount: number)` - Format amounts in Swedish Krona (SEK)
- `formatPhoneNumber(phone: string)` - Format Swedish phone numbers

### Validation
- `isValidSwedishPhoneNumber(phone: string)` - Validate Swedish phone format

### Business Logic
- `calculateCashbackPercentage(rating, hasDetailedFeedback, sentimentScore)` - Dynamic cashback calculation
- `generateQRCodeData(storeId, businessId)` - Generate feedback QR code URLs

### Development Utilities
- `sleep(ms: number)` - Promise-based delay
- `debounce(func, wait)` - Debounce function execution

## Business Rules

### Cashback Calculation

The cashback percentage is calculated based on feedback quality:

- **Base**: 2% for all feedback
- **Rating Bonus**: 
  - 5+ stars: +3%
  - 4+ stars: +1%
- **Detailed Feedback**: +3% for text feedback
- **Sentiment Bonus**:
  - Positive (>0.7): +7%
  - Neutral (>0.3): +3%
  - Negative: +0%
- **Maximum**: 15% total cashback

### Phone Number Format

Swedish phone numbers are formatted as: `XXX-XXX XX XX`
- Must be 10 digits
- Must start with '0'
- Non-digit characters are removed before validation

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

# Type checking
pnpm typecheck
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Dependencies

- `@vocilia/types` - Shared type definitions

## Environment Variables

- `NEXT_PUBLIC_APP_URL` - Base URL for QR code generation (defaults to https://alpha.vocilia.com)

## License

Private package - restricted access