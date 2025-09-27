# Vocilia Alpha Constitution

## Core Principles

### I. Production from Day One

Every feature must be production-ready from initial implementation. No mock
data, placeholder implementations, or temporary solutions. All features deploy
to real environments with real data from day one.

### II. Security & Privacy First

Security is mandatory, not optional. All data access requires proper
authentication and authorization. Row Level Security (RLS) policies are required
for all database operations. No security shortcuts or "we'll add it later"
approaches.

### III. TypeScript Strict Mode (NON-NEGOTIABLE)

All code must be written in TypeScript with strict mode enabled. No `any` types,
no loose typing, no JavaScript files in TypeScript projects. Type safety is
enforced at compile time.

### IV. Real Data Only

Features must work with real production data from existing systems. No local
databases, no seed data, no mock APIs. Integration with existing Supabase
database and real business workflows required.

### V. Monorepo Architecture

All code follows the established monorepo structure with three apps (customer,
business, admin) and shared packages. No breaking changes to existing
architecture. New features extend the existing structure.

## Technical Standards

### Testing Requirements

- Test-Driven Development (TDD) mandatory: Tests written → Tests fail → Then
  implement
- Contract tests for all API endpoints
- Integration tests for all user workflows
- Unit tests for business logic components

### Performance Standards

- Page loads: <3s initial, <1s cached (measured on mobile 3G)
- API operations: <500ms for CRUD, <2s for complex operations
- Lighthouse scores: >90 for Performance, Accessibility, PWA

### Deployment Standards

- Backend services deploy to Railway
- Frontend applications deploy to Vercel
- Database hosted on Supabase with RLS policies
- All deployments use existing CI/CD pipelines

## Development Workflow

### Feature Development Process

1. Specification via `/specify` command
2. Planning via `/plan` command
3. Task generation via `/tasks` command
4. Implementation following TDD principles
5. Integration testing with real data
6. Performance validation before merge

### Quality Gates

- All tests must pass before merge
- TypeScript compilation with zero errors
- ESLint and Prettier compliance
- Security review for data access patterns
- Performance benchmarks met

## Governance

This constitution supersedes all other development practices. Feature
implementations that violate these principles must be rejected regardless of
functionality.

Constitution changes require explicit documentation and approval process outside
of normal feature development.

**Version**: 1.0.0 | **Ratified**: 2025-09-23 | **Last Amended**: 2025-09-23
