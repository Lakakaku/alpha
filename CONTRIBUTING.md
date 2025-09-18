# Contributing to Project Alpha

Thank you for your interest in contributing to Project Alpha (Vocilia)! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)

## 🤝 Code of Conduct

### Our Standards

- **Professional**: Maintain professional communication in all interactions
- **Respectful**: Treat all contributors with respect regardless of experience level
- **Collaborative**: Work together to build the best possible product
- **Security-First**: Always consider security implications of changes
- **Quality-Focused**: Prioritize code quality and maintainability

### Unacceptable Behavior

- Harassment or discriminatory behavior
- Sharing of sensitive credentials or data
- Introducing security vulnerabilities
- Bypassing established development processes

## 🛠️ Development Setup

### Prerequisites

- **Node.js** 18+ (use nvm for version management)
- **pnpm** (preferred package manager)
- **Git** with SSH key configured
- **VS Code** (recommended editor)
- **Claude Code** extension for AI assistance

### Initial Setup

1. **Fork and Clone**
   ```bash
   git clone git@github.com:yourusername/alpha.git
   cd alpha
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   # Fill in required environment variables
   ```

4. **Database Setup**
   ```bash
   npx supabase link --project-ref wtdckfgdcryjvbllcajq
   npx supabase db pull
   pnpm db:generate
   ```

5. **Verify Setup**
   ```bash
   pnpm dev
   pnpm test
   pnpm lint
   ```

## 🔄 Development Workflow

### Branch Strategy

- **`main`** - Production-ready code
- **`develop`** - Integration branch for features
- **`feature/feature-name`** - Individual feature development
- **`hotfix/issue-description`** - Critical production fixes

### Feature Development Process

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Development Cycle**
   - Make changes following code standards
   - Write/update tests for new functionality
   - Ensure all tests pass locally
   - Run linting and type checking

3. **Commit Standards**
   ```bash
   # Use conventional commits format
   git commit -m "feat(business): add context window configuration"
   git commit -m "fix(customer): resolve QR code scanning issue"
   git commit -m "docs: update API documentation"
   ```

4. **Push and PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request via GitHub
   ```

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Scopes:**
- `customer`: Customer application
- `business`: Business application
- `admin`: Admin application
- `ui`: Shared UI components
- `database`: Database operations
- `utils`: Utility functions

## 📝 Code Standards

### TypeScript

- **Strict Mode**: Always use TypeScript strict mode
- **Type Safety**: No `any` types without explicit justification
- **Interfaces**: Prefer interfaces over types for object shapes
- **Naming**: Use PascalCase for types/interfaces, camelCase for variables

```typescript
// ✅ Good
interface UserProfile {
  id: string;
  email: string;
  createdAt: Date;
}

// ❌ Avoid
type userProfile = {
  id: any;
  email: string;
  createdAt: any;
}
```

### React Components

- **Functional Components**: Use function components with hooks
- **TypeScript Props**: Always type component props
- **File Naming**: Use PascalCase for component files
- **Export**: Use default exports for components

```typescript
// ✅ Good - UserProfile.tsx
interface UserProfileProps {
  user: User;
  onUpdate: (user: User) => void;
}

export default function UserProfile({ user, onUpdate }: UserProfileProps) {
  // Component implementation
}
```

### Styling

- **Tailwind CSS**: Use Tailwind for all styling
- **Component Variants**: Use cva for component variants
- **Responsive**: Mobile-first responsive design
- **Dark Mode**: Consider dark mode support

```typescript
// ✅ Good
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
  }
)
```

### Database Operations

- **Type Safety**: Use generated types from Supabase
- **RLS Policies**: Always implement Row Level Security
- **Error Handling**: Handle database errors gracefully
- **Transactions**: Use transactions for multi-table operations

```typescript
// ✅ Good
async function createStore(storeData: InsertStore): Promise<Store> {
  const { data, error } = await supabase
    .from('stores')
    .insert(storeData)
    .select()
    .single();

  if (error) throw new DatabaseError(error.message);
  return data;
}
```

## 🧪 Testing Guidelines

### Test Structure

```bash
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
├── utils/
│   ├── validation.ts
│   └── validation.test.ts
└── app/
    ├── page.tsx
    └── page.test.tsx
```

### Testing Standards

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **API Tests**: Test database operations and API endpoints

### Test Examples

```typescript
// Component Test
describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
});

// Utility Test
describe('validateTransactionTime', () => {
  it('accepts time within 2 minute tolerance', () => {
    const transactionTime = new Date();
    const inputTime = new Date(transactionTime.getTime() + 60000); // 1 min later
    expect(validateTransactionTime(transactionTime, inputTime)).toBe(true);
  });
});
```

## 🔒 Security Guidelines

### Sensitive Data

- **Never commit**: API keys, passwords, or secrets
- **Environment Variables**: Use `.env.local` for sensitive config
- **Customer Data**: Follow privacy protection guidelines
- **RLS Policies**: Always implement proper database security

### Code Security

- **Input Validation**: Validate all user inputs
- **SQL Injection**: Use parameterized queries only
- **XSS Prevention**: Sanitize user-generated content
- **Authentication**: Verify user permissions for all operations

```typescript
// ✅ Good - Input validation
const transactionSchema = z.object({
  time: z.date(),
  amount: z.number().min(0).max(10000),
  phoneNumber: z.string().regex(/^\+46\d{9}$/),
});

// ✅ Good - Permission check
async function getStoreData(storeId: string, userId: string) {
  const { data, error } = await supabase
    .from('stores')
    .select()
    .eq('id', storeId)
    .eq('owner_id', userId) // RLS enforces this
    .single();
}
```

## 🔄 Pull Request Process

### Before Submitting

1. **Tests Pass**: All tests must pass
   ```bash
   pnpm test
   ```

2. **Linting Clean**: No linting errors
   ```bash
   pnpm lint
   ```

3. **Type Check**: No TypeScript errors
   ```bash
   pnpm type-check
   ```

4. **Build Success**: Application builds successfully
   ```bash
   pnpm build
   ```

### PR Requirements

- **Title**: Clear, descriptive title following conventional commits
- **Description**: Detailed description of changes and reasoning
- **Screenshots**: Include screenshots for UI changes
- **Testing**: Describe how the changes were tested
- **Breaking Changes**: Clearly document any breaking changes

### PR Template

```markdown
## Description
Brief description of the changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] E2E tests pass (if applicable)

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Checklist
- [ ] Code follows the style guidelines
- [ ] Self-review of code completed
- [ ] Code is commented (if complex)
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: At least one approving review required
3. **Security Review**: Required for security-sensitive changes
4. **Manual Testing**: QA testing for significant changes

## 🐛 Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
A clear description of what the bug is.

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g. iOS]
- Browser: [e.g. chrome, safari]
- Version: [e.g. 22]
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
Clear description of the requested feature.

**Problem Statement**
What problem does this solve?

**Proposed Solution**
Describe your preferred solution.

**Alternatives Considered**
Other solutions you've considered.

**Additional Context**
Any other context or screenshots.
```

## 📈 Performance Guidelines

### Code Performance

- **Bundle Size**: Monitor and minimize bundle size
- **Loading States**: Implement proper loading indicators
- **Error Boundaries**: Use error boundaries for graceful failures
- **Lazy Loading**: Implement code splitting where appropriate

### Database Performance

- **Query Optimization**: Use efficient database queries
- **Indexing**: Ensure proper database indexing
- **Caching**: Implement appropriate caching strategies
- **Connection Pooling**: Use connection pooling for database access

## 🚀 Deployment

### Staging Environment

All PRs are automatically deployed to staging for testing:
- **URL**: `https://alpha-staging.vercel.app`
- **Access**: Requires authentication
- **Database**: Uses staging Supabase project

### Production Deployment

- **Trigger**: Merge to `main` branch
- **Process**: Automated via Vercel
- **Monitoring**: Performance and error monitoring enabled
- **Rollback**: Automated rollback on critical errors

## 📞 Getting Help

### Development Questions

- **Discord**: Join our development Discord server
- **Documentation**: Check existing documentation first
- **Issues**: Create a discussion issue for questions
- **Code Review**: Request help during code review

### Mentorship

New contributors can request mentorship:
- **Onboarding**: Guided setup and first contribution
- **Code Review**: Detailed feedback on initial PRs
- **Best Practices**: Learning project conventions and standards

---

Thank you for contributing to Project Alpha! Together, we're building the future of customer feedback collection. 🚀