# @vocilia/types

Shared TypeScript type definitions for the Vocilia application ecosystem.

## Overview

This package provides centralized type definitions used across all Vocilia applications including customer, business, and admin interfaces, as well as the backend API.

## Installation

```bash
# Install via workspace (recommended)
pnpm add @vocilia/types

# Or install directly
npm install @vocilia/types
```

## Usage

```typescript
import { 
  UserProfile, 
  Business, 
  Store, 
  FeedbackSession,
  Database 
} from '@vocilia/types';

// Use types in your application
const user: UserProfile = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'user@example.com',
  role: 'business_account',
  // ...
};

// Database types (auto-generated from schema)
type BusinessRow = Database['public']['Tables']['businesses']['Row'];
type BusinessInsert = Database['public']['Tables']['businesses']['Insert'];
```

## Type Categories

### Authentication Types
- `UserProfile` - Complete user profile information
- `UserRole` - User role definitions (`business_account`, `admin_account`)
- `AuthResponse` - Authentication response structure
- `LoginRequest`, `RegisterRequest` - Authentication request types

### Business Types
- `Business` - Business entity definition
- `Store` - Store entity definition
- `BusinessStats` - Business analytics and metrics

### Database Types (Auto-generated)
- `Database` - Complete database schema types
- `Tables<T>` - Generic table row type
- `TablesInsert<T>` - Generic table insert type
- `TablesUpdate<T>` - Generic table update type

### API Types
- `ApiResponse<T>` - Standardized API response wrapper
- `PaginatedResponse<T>` - Paginated data responses
- `ErrorResponse` - Error response structure

## Auto-generated Types

Database types are automatically generated from the Supabase schema using:

```bash
npm run generate:types
```

This ensures type safety between the database schema and TypeScript code.

## Type Structure

```
src/
├── index.ts          # Main exports
├── auth.ts           # Authentication-related types
├── business.ts       # Business and store types
├── api.ts            # API response types
└── database.ts       # Auto-generated database types
```

## Development

### Building

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

### Linting

```bash
pnpm lint
pnpm lint:fix
```

### Type Checking

```bash
pnpm typecheck
```

## Contributing

When adding new types:

1. **Add to appropriate file** - Group related types together
2. **Export from index.ts** - Ensure types are available for import
3. **Document complex types** - Add JSDoc comments for complex structures
4. **Update tests** - Add type tests for new definitions

### Type Naming Conventions

- **Interfaces**: PascalCase (e.g., `UserProfile`, `BusinessStats`)
- **Types**: PascalCase (e.g., `UserRole`, `ApiStatus`)
- **Enums**: PascalCase with SCREAMING_SNAKE_CASE values
- **Generic constraints**: Single uppercase letter (e.g., `T`, `K`, `V`)

## Examples

### Creating a typed API client

```typescript
import { ApiResponse, Business, Store } from '@vocilia/types';

class BusinessAPI {
  async getBusiness(id: string): Promise<ApiResponse<Business>> {
    // Implementation with full type safety
  }
  
  async getStores(businessId: string): Promise<ApiResponse<Store[]>> {
    // Implementation with full type safety
  }
}
```

### Using database types with Supabase

```typescript
import { Database } from '@vocilia/types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient<Database>(url, key);

// Fully typed database operations
const { data: businesses } = await supabase
  .from('businesses')
  .select('*')
  .returns<Business[]>();
```

### Form validation with types

```typescript
import { BusinessInsert } from '@vocilia/types';

function validateBusinessForm(data: Partial<BusinessInsert>): string[] {
  const errors: string[] = [];
  
  if (!data.name) errors.push('Business name is required');
  if (!data.contact_email) errors.push('Contact email is required');
  
  return errors;
}
```

## Dependencies

- **TypeScript**: ^5.5.4 - Core type system
- **tsup**: ^8.0.1 - Build tool for TypeScript packages

## License

Private - Internal use only within the Vocilia ecosystem.

## Support

For questions about types or to request new type definitions:

- **Team**: Vocilia Development Team
- **Email**: dev@vocilia.se
- **Documentation**: [API Documentation](../../docs/api/README.md)