# Vocilia Alpha Constitution

## Core Principles

### I. Production from Day One (NON-NEGOTIABLE)
No mock data, prototypes, or placeholder integrations. Every component must use real external services and production-ready implementations from the first commit. All integrations (Supabase, Swish, GPT-4o-mini) must be functional and tested.

### II. Security & Privacy First
Customer phone numbers are never shared with businesses during verification. All feedback is anonymized before delivery to businesses. Row Level Security (RLS) policies are mandatory for all database operations. All secrets and API keys must be properly secured.

### III. TypeScript Strict Mode (NON-NEGOTIABLE)
All code must pass TypeScript strict mode compilation. No `any` types except for well-documented external API responses. Type safety is enforced throughout the entire stack from database to frontend.

### IV. Real Data Only
All development and testing must use actual Supabase database with proper RLS policies. No local databases, mock data, or fake implementations. Weekly verification workflows must process real transaction data.

### V. Monorepo Architecture
Three applications (Customer, Business, Admin) share common packages and utilities. Deployment separation: frontend applications to Vercel, backend services to Railway. Clear separation of concerns between frontend and backend.

## Technology Constraints

### Stack Requirements
- **Frontend**: Next.js 14 with TypeScript (deployed on Vercel)
- **Backend**: Node.js APIs and services (deployed on Railway)
- **Database**: Supabase PostgreSQL with RLS
- **Styling**: Tailwind CSS only
- **AI**: GPT-4o-mini for voice calls and feedback analysis
- **Payments**: Swish integration for Swedish market

### Deployment Architecture
Frontend applications must deploy to Vercel with automatic GitHub integration. Backend services must deploy to Railway. Database operations through Supabase with proper authentication and RLS policies.

## Development Workflow

### Weekly Verification Cycle
All transaction data must be cross-referenced with POS systems weekly. Fraud detection and legitimacy analysis are mandatory. Context-based verification ensures system integrity.

### AI Integration Standards
Voice calls must use GPT-4o-mini with Swedish language support. Business Context Window system guides AI interactions. Feedback analysis and grading algorithms must be consistently applied.

## Governance

This constitution supersedes all other development practices. Any deviation must be documented and approved. The weekly verification workflow and production-ready requirement are non-negotiable core principles.

All code reviews must verify compliance with RLS policies, TypeScript strict mode, and production-ready implementations.

**Version**: 1.0.0 | **Ratified**: 2025-01-18 | **Last Amended**: 2025-01-18