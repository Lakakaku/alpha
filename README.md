# Project Alpha - Vocilia Customer Feedback Reward System

A comprehensive customer feedback system for physical stores where customers scan QR codes to provide feedback through AI-powered phone calls and receive cashback rewards based on feedback quality.

## 🎯 Project Overview

**Vocilia** is a customer feedback reward system that transforms how businesses collect and analyze customer feedback. Customers scan QR codes, verify their purchase, participate in brief AI-powered phone interviews, and receive cashback rewards based on the quality of their feedback.

### Key Features

- **QR Code Integration**: Simple customer entry point
- **AI-Powered Calls**: Swedish-speaking GPT-4o-mini conducts 1-2 minute feedback calls
- **Smart Rewards**: 2-15% cashback based on feedback quality and legitimacy
- **Business Intelligence**: Advanced feedback analysis and insights
- **Fraud Prevention**: Multi-layer verification with POS system integration
- **Privacy Protection**: Customer data anonymization and secure handling

## 🏗️ Architecture

This is a **Next.js 14 monorepo** with three main applications:

```
alpha/
├── apps/
│   ├── customer/          # Customer-facing feedback interface
│   ├── business/          # Store management and analytics dashboard
│   └── admin/             # System administration and verification
├── packages/
│   ├── ui/                # Shared component library
│   ├── database/          # Database client and utilities
│   ├── types/             # Shared TypeScript definitions
│   └── utils/             # Common utilities and helpers
└── docs/                  # Documentation and guides
```

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Database**: Supabase with Row Level Security (RLS)
- **AI**: GPT-4o-mini (OpenAI) for calls and analysis
- **Payments**: Swish (Swedish mobile payment system)
- **Hosting**: Railway
- **Authentication**: Supabase Auth

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account
- OpenAI API access

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Lakakaku/alpha.git
   cd alpha
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required environment variables (see [Environment Variables](#environment-variables))

4. **Database Setup**
   ```bash
   npx supabase link --project-ref wtdckfgdcryjvbllcajq
   npx supabase db pull
   ```

5. **Start Development**
   ```bash
   pnpm dev
   ```

## 📋 Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://wtdckfgdcryjvbllcajq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Swish Payment Configuration
SWISH_MERCHANT_ID=your_swish_merchant_id
SWISH_CERTIFICATE_PATH=path_to_swish_certificate
SWISH_PRIVATE_KEY_PATH=path_to_private_key

# Application URLs
NEXT_PUBLIC_CUSTOMER_APP_URL=http://localhost:3000
NEXT_PUBLIC_BUSINESS_APP_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3002

# Telephony Provider (TBD)
TELEPHONY_API_KEY=your_telephony_api_key
TELEPHONY_WEBHOOK_SECRET=your_webhook_secret

# Development
NODE_ENV=development
```

## 🏃‍♂️ Development Commands

```bash
# Install dependencies
pnpm install

# Start all applications in development mode
pnpm dev

# Start specific application
pnpm dev:customer    # Customer app on :3000
pnpm dev:business    # Business app on :3001
pnpm dev:admin       # Admin app on :3002

# Build all applications
pnpm build

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm format

# Type checking
pnpm type-check

# Database operations
pnpm db:generate     # Generate types from Supabase
pnpm db:reset        # Reset local database
pnpm db:seed         # Seed with test data
```

## 📁 Project Structure

### Applications

- **`apps/customer/`** - Customer-facing application for QR code scanning and verification
- **`apps/business/`** - Business dashboard for store management and feedback analysis
- **`apps/admin/`** - Administrative interface for system management and verification workflows

### Packages

- **`packages/ui/`** - Shared React components with Tailwind CSS
- **`packages/database/`** - Supabase client, types, and database utilities
- **`packages/types/`** - Shared TypeScript type definitions
- **`packages/utils/`** - Common utility functions and helpers

## 🔒 Security & Privacy

### Data Protection
- Customer phone numbers are never shared with businesses
- Feedback is anonymized before delivery to businesses
- All database operations use Row Level Security (RLS)
- Transaction verification with POS system integration

### Fraud Prevention
- ±2 minute transaction time verification
- ±2 SEK transaction amount verification
- AI-powered legitimacy analysis
- Weekly verification cycle with business POS systems

## 📊 System Flow

### Customer Journey
1. **Scan QR Code** → Unique store identification
2. **Verify Purchase** → Time and amount validation
3. **AI Phone Call** → Swedish GPT-4o-mini interview (1-2 min)
4. **Feedback Analysis** → Quality and legitimacy scoring
5. **Cashback Reward** → 2-15% based on feedback grade

### Business Workflow
1. **Context Configuration** → Store profile and custom questions
2. **QR Code Management** → Generate and display codes
3. **Weekly Verification** → Validate transactions against POS
4. **Feedback Analysis** → AI-powered insights and reporting
5. **Invoice Processing** → Pay rewards + 20% admin fee

### Admin Operations
1. **Store Management** → Oversee all business accounts
2. **Verification Coordination** → Manage weekly verification cycle
3. **Payment Processing** → Handle reward distributions
4. **System Monitoring** → Performance and fraud detection

## 🔧 Development Principles

1. **Production from Day One** - No mock data, real integrations only
2. **TypeScript Strict Mode** - Type safety enforced throughout
3. **Real Data Only** - All data operations via Supabase
4. **RLS Mandatory** - Database security by design
5. **Weekly Verification** - Built-in fraud prevention

## 📚 Documentation

- **[VISION.md](./VISION.md)** - Complete system specification and requirements
- **[TASKS.md](./TASKS.md)** - Detailed implementation plan and task breakdown
- **[CLAUDE.md](./CLAUDE.md)** - Claude Code development guidelines
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development workflow and contribution guidelines
- **[SECURITY.md](./SECURITY.md)** - Security policies and vulnerability reporting

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📞 Support

For questions and support:
- **Technical Issues**: Create an issue in this repository
- **Security Concerns**: See [SECURITY.md](./SECURITY.md) for reporting procedures
- **Business Inquiries**: Contact the project maintainers

## 📄 License

This project is proprietary software. All rights reserved.

---

**Project Alpha** - Building the future of customer feedback collection 🚀