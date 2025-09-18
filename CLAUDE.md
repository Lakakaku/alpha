# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project Alpha** - A customer feedback reward system for physical stores where customers scan QR codes to provide feedback through AI-powered phone calls and receive cashback rewards. This project implements the Vocilia system concept.

**Important**: This project is specifically called "alpha" in both GitHub and Supabase:
- **GitHub Repository**: https://github.com/Lakakaku/alpha
- **Supabase Project**: "alpha" (project ref: wtdckfgdcryjvbllcajq)
- **Supabase Dashboard**: https://supabase.com/dashboard/project/wtdckfgdcryjvbllcajq/settings/general

This is the alpha development workspace for the Vocilia system concept. The main implementation will be a Next.js monorepo with three applications:
- **Customer**: Customer-facing feedback collection interface
- **Business**: Store management and feedback analysis dashboard
- **Admin**: System administration and verification workflows

## MCP Server Configuration

The project uses multiple MCP servers for external integrations:

- **Railway**: Backend API deployment and hosting management
- **Vercel**: Frontend application deployment and hosting
- **Supabase**: Database and backend services (read-only mode, project ref: wtdckfgdcryjvbllcajq)
- **Context7**: HTTP streaming and library information
- **GitHub**: Repository management (repo: Lakakaku/alpha)
- **Playwright**: Browser automation
- **Serena**: Additional tooling support

MCP configuration is stored in `.mcp.json` (git-ignored for security).

## Project Structure & Architecture

### Core System Components

**Customer Flow**:
1. QR code scan → verification page
2. Transaction validation (time ±2 min, amount ±2 SEK)
3. AI-powered Swedish phone call (GPT-4o-mini)
4. Feedback analysis and grading
5. Cashback calculation (2-15% based on quality)

**Business Context System**:
- Business Context Window for AI guidance configuration
- Custom question creation with frequency settings
- Store profile and layout documentation
- AI assistant for context building

**Data Management**:
- Weekly verification cycle with POS system cross-reference
- Store-specific databases with privacy protection
- Fraud detection and legitimacy analysis

### Deployment Architecture

**Frontend (Vercel)**:
- Next.js applications: Customer, Business, and Admin interfaces
- Static site generation and edge functions
- Automatic deployments from GitHub
- Global CDN and edge caching

**Backend (Railway)**:
- Node.js API services and webhooks
- AI processing and telephony integration
- Background jobs and scheduled tasks
- Payment processing workflows
- Database operations and business logic

**Database (Supabase)**:
- PostgreSQL with Row Level Security
- Real-time subscriptions
- Authentication and user management
- File storage and edge functions

### Technology Stack
- **Frontend**: Next.js 14 with TypeScript (deployed on Vercel)
- **Backend**: Node.js APIs and services (deployed on Railway)
- **Database**: Supabase with Row Level Security (RLS)
- **Styling**: Tailwind CSS
- **AI**: GPT-4o-mini for calls and analysis
- **Payments**: Swish (Swedish mobile payment)
- **Hosting**:
  - Frontend applications → Vercel
  - Backend APIs and services → Railway
  - Database → Supabase

## Development Principles

1. **Production from day one** - No mock data, real integrations only
2. **TypeScript strict mode** enforced throughout
3. **Real data only** via Supabase
4. **RLS policies mandatory** for all database operations
5. **Weekly verification workflow** for fraud prevention

## Security & Privacy

- Customer phone numbers never shared with businesses during verification
- Feedback anonymized in final delivery
- Transaction verification with POS system cross-reference
- Context-based fraud detection and legitimacy analysis

## Hooks Configuration

The project uses comprehensive Claude Code hooks for:
- **Pre-tool-use**: Validates operations, blocks sensitive modifications
- **Post-tool-use**: TypeScript/lint checks after modifications
- **User-prompt-submit**: Adds context and validates prompts
- **Session management**: Environment setup and cleanup

Auto-approved operations include:
- Read operations on `./apps/**`, `./packages/**`, documentation files
- Common commands: `pnpm`, `npm run`, `npx supabase`, `ls`, `cat`, `grep`

Blocked paths: `node_modules`, `.git`, `.next`, `dist`, `.vercel`, `.railway`, lock files

## Key Documentation

- `VISION.md`: Complete system specification and requirements
- `MCP_SETUP.md`: MCP server configuration instructions
- `.claude/hooks.json`: Development workflow automation