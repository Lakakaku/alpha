#!/bin/bash

# Test Environment Setup Script
# Sets up isolated test environments for comprehensive testing
# Usage: ./scripts/setup-test-env.sh [environment] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="test"
RESET_DB=false
SEED_DATA=true
SETUP_SERVICES=true
CLEANUP_FIRST=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --reset-db)
            RESET_DB=true
            shift
            ;;
        --no-seed)
            SEED_DATA=false
            shift
            ;;
        --no-services)
            SETUP_SERVICES=false
            shift
            ;;
        --cleanup)
            CLEANUP_FIRST=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --env, -e ENV      Environment name (test, ci, local)"
            echo "  --reset-db         Reset database before setup"
            echo "  --no-seed          Skip seeding test data"
            echo "  --no-services      Skip service setup"
            echo "  --cleanup          Cleanup existing environment first"
            echo "  --verbose, -v      Verbose output"
            echo "  --help, -h         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${NC}[VERBOSE]${NC} $1"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites for $ENVIRONMENT environment..."
    
    local missing_deps=()
    
    # Check required tools
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v pnpm &> /dev/null; then
        missing_deps+=("pnpm")
    fi
    
    if ! command -v supabase &> /dev/null; then
        missing_deps+=("supabase CLI")
    fi
    
    # Check for Docker if needed
    if [ "$ENVIRONMENT" = "ci" ] && ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_error "Please install missing dependencies before continuing"
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local required_version="18.0.0"
    
    if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
        log_warning "Node.js version $node_version may not be compatible (required: $required_version+)"
    fi
    
    log_success "Prerequisites check completed"
}

# Load environment configuration
load_environment_config() {
    log_info "Loading configuration for $ENVIRONMENT environment..."
    
    case $ENVIRONMENT in
        "test")
            export NODE_ENV=test
            export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vocilia_test"
            export SUPABASE_URL="http://localhost:54321"
            export SUPABASE_ANON_KEY="test-anon-key"
            export SUPABASE_SERVICE_ROLE_KEY="test-service-role-key"
            export API_BASE_URL="http://localhost:3001"
            export CUSTOMER_APP_URL="http://localhost:3000"
            export BUSINESS_APP_URL="http://localhost:3002"
            export ADMIN_APP_URL="http://localhost:3003"
            ;;
        "ci")
            export NODE_ENV=test
            export CI=true
            export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vocilia_test"
            export SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
            export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-test-anon-key}"
            export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-test-service-role-key}"
            export API_BASE_URL="http://localhost:3001"
            ;;
        "local")
            # Load from .env.local if available
            if [ -f ".env.local" ]; then
                log_verbose "Loading .env.local"
                set -a
                source .env.local
                set +a
            fi
            export NODE_ENV=development
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    log_verbose "Environment variables set for $ENVIRONMENT"
    log_success "Environment configuration loaded"
}

# Cleanup existing environment
cleanup_environment() {
    if [ "$CLEANUP_FIRST" = false ]; then
        return
    fi
    
    log_info "Cleaning up existing environment..."
    
    # Stop any running processes
    pkill -f "node.*vocilia" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    pkill -f "supabase" 2>/dev/null || true
    
    # Remove test artifacts
    rm -rf test-results/ 2>/dev/null || true
    rm -rf coverage/ 2>/dev/null || true
    rm -rf playwright-report/ 2>/dev/null || true
    rm -rf .lighthouseci/ 2>/dev/null || true
    
    # Clear test database if local
    if [ "$ENVIRONMENT" = "test" ] && command -v supabase &> /dev/null; then
        supabase db reset --db-url "$DATABASE_URL" 2>/dev/null || true
    fi
    
    log_success "Environment cleanup completed"
}

# Setup database
setup_database() {
    log_info "Setting up test database..."
    
    if [ "$ENVIRONMENT" = "ci" ]; then
        log_verbose "CI environment - database setup handled by workflow"
        return
    fi
    
    # Start Supabase if local
    if [ "$ENVIRONMENT" = "test" ]; then
        log_info "Starting local Supabase instance..."
        
        # Check if supabase is already running
        if ! curl -s "$SUPABASE_URL/rest/v1/" &> /dev/null; then
            log_verbose "Starting Supabase..."
            supabase start &
            
            # Wait for Supabase to be ready
            local max_attempts=30
            local attempt=1
            
            while [ $attempt -le $max_attempts ]; do
                if curl -s "$SUPABASE_URL/rest/v1/" &> /dev/null; then
                    log_success "Supabase is ready"
                    break
                fi
                
                log_verbose "Waiting for Supabase... (attempt $attempt/$max_attempts)"
                sleep 2
                ((attempt++))
            done
            
            if [ $attempt -gt $max_attempts ]; then
                log_error "Supabase failed to start within expected time"
                exit 1
            fi
        else
            log_verbose "Supabase is already running"
        fi
    fi
    
    # Reset database if requested
    if [ "$RESET_DB" = true ]; then
        log_info "Resetting database..."
        
        if [ "$ENVIRONMENT" = "test" ]; then
            supabase db reset
        else
            log_warning "Database reset not supported in $ENVIRONMENT environment"
        fi
    fi
    
    # Run migrations
    log_info "Running database migrations..."
    if [ -d "supabase/migrations" ]; then
        supabase db reset
        log_success "Database migrations completed"
    else
        log_warning "No migrations directory found"
    fi
    
    log_success "Database setup completed"
}

# Generate test data
generate_test_data() {
    if [ "$SEED_DATA" = false ]; then
        log_info "Skipping test data generation"
        return
    fi
    
    log_info "Generating test data..."
    
    # Create test data generators if they don't exist
    mkdir -p tests/utils
    
    # Run test data generation script
    if [ -f "tests/utils/generate-test-data.js" ]; then
        log_verbose "Running test data generator..."
        node tests/utils/generate-test-data.js
    else
        log_info "Creating basic test data generator..."
        cat > tests/utils/generate-test-data.js << 'EOF'
// Basic test data generator
const { faker } = require('@faker-js/faker');

// Set Swedish locale
faker.setLocale('sv');

// Generate test data
async function generateTestData() {
    console.log('Generating Swedish test data...');
    
    // Generate test users
    const users = Array.from({ length: 100 }, () => ({
        id: faker.datatype.uuid(),
        phone: faker.phone.number('+46########'),
        name: faker.name.fullName(),
        email: faker.internet.email(),
        createdAt: faker.date.recent(30),
    }));
    
    // Generate test stores
    const stores = Array.from({ length: 20 }, () => ({
        id: faker.datatype.uuid(),
        name: faker.company.name(),
        address: faker.address.streetAddress(),
        city: faker.address.city(),
        postalCode: faker.address.zipCode(),
        phone: faker.phone.number('+46########'),
        businessType: faker.helpers.arrayElement(['restaurant', 'retail', 'service', 'health']),
        createdAt: faker.date.recent(90),
    }));
    
    console.log(`Generated ${users.length} test users and ${stores.length} test stores`);
    
    // Save to temporary files for tests to use
    const fs = require('fs');
    fs.writeFileSync('tests/fixtures/users.json', JSON.stringify(users, null, 2));
    fs.writeFileSync('tests/fixtures/stores.json', JSON.stringify(stores, null, 2));
    
    console.log('Test data generation completed');
}

generateTestData().catch(console.error);
EOF
        
        # Create fixtures directory
        mkdir -p tests/fixtures
        
        # Run the generator
        node tests/utils/generate-test-data.js
    fi
    
    log_success "Test data generation completed"
}

# Setup services
setup_services() {
    if [ "$SETUP_SERVICES" = false ]; then
        log_info "Skipping service setup"
        return
    fi
    
    log_info "Setting up services for $ENVIRONMENT environment..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        pnpm install --frozen-lockfile
    fi
    
    # Build shared packages
    log_info "Building shared packages..."
    pnpm --filter @vocilia/types build
    pnpm --filter @vocilia/database build
    pnpm --filter @vocilia/ui build
    
    # Build applications for testing
    if [[ "$ENVIRONMENT" =~ ^(test|ci)$ ]]; then
        log_info "Building applications..."
        pnpm --filter @vocilia/backend build
        pnpm --filter @vocilia/customer build
        pnpm --filter @vocilia/business build
        pnpm --filter @vocilia/admin build
    fi
    
    log_success "Service setup completed"
}

# Setup test tools
setup_test_tools() {
    log_info "Setting up test tools..."
    
    # Install Playwright browsers if not in CI
    if [ "$ENVIRONMENT" != "ci" ] && command -v npx &> /dev/null; then
        if [ ! -d "$HOME/.cache/ms-playwright" ]; then
            log_info "Installing Playwright browsers..."
            npx playwright install --with-deps
        else
            log_verbose "Playwright browsers already installed"
        fi
    fi
    
    # Install Artillery if not present
    if ! command -v artillery &> /dev/null; then
        log_info "Installing Artillery..."
        npm install -g artillery@latest
    else
        log_verbose "Artillery already installed"
    fi
    
    # Install Lighthouse CLI if not present
    if ! command -v lhci &> /dev/null; then
        log_info "Installing Lighthouse CI..."
        npm install -g @lhci/cli
    else
        log_verbose "Lighthouse CI already installed"
    fi
    
    log_success "Test tools setup completed"
}

# Create test directories
create_test_directories() {
    log_info "Creating test directories..."
    
    # Create all necessary test directories
    mkdir -p {
        test-results/{unit,contract,integration,e2e,performance,security},
        tests/{unit,contract,integration,e2e,performance,security,fixtures,utils},
        coverage,
        playwright-report,
        .lighthouseci
    }
    
    # Create .gitkeep files for empty directories
    find test-results tests coverage playwright-report .lighthouseci -type d -empty -exec touch {}/.gitkeep \;
    
    log_success "Test directories created"
}

# Validate environment
validate_environment() {
    log_info "Validating test environment..."
    
    local validation_errors=()
    
    # Check database connectivity
    if [ "$ENVIRONMENT" != "ci" ]; then
        if ! curl -s "$SUPABASE_URL/rest/v1/" &> /dev/null; then
            validation_errors+=("Database not accessible at $SUPABASE_URL")
        fi
    fi
    
    # Check required directories exist
    local required_dirs=("tests" "test-results")
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            validation_errors+=("Missing directory: $dir")
        fi
    done
    
    # Check required files exist
    local required_files=("package.json" "jest.config.js")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            validation_errors+=("Missing file: $file")
        fi
    done
    
    if [ ${#validation_errors[@]} -gt 0 ]; then
        log_error "Environment validation failed:"
        for error in "${validation_errors[@]}"; do
            log_error "  - $error"
        done
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Create environment info file
create_environment_info() {
    log_info "Creating environment info file..."
    
    local info_file="test-results/environment-info.json"
    
    cat > "$info_file" << EOF
{
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "nodeVersion": "$(node --version)",
    "pnpmVersion": "$(pnpm --version)",
    "platform": "$(uname -s)",
    "architecture": "$(uname -m)",
    "environmentVariables": {
        "NODE_ENV": "$NODE_ENV",
        "CI": "${CI:-false}",
        "DATABASE_URL": "${DATABASE_URL:-not_set}",
        "SUPABASE_URL": "${SUPABASE_URL:-not_set}",
        "API_BASE_URL": "${API_BASE_URL:-not_set}"
    },
    "options": {
        "resetDb": $RESET_DB,
        "seedData": $SEED_DATA,
        "setupServices": $SETUP_SERVICES,
        "cleanupFirst": $CLEANUP_FIRST
    }
}
EOF
    
    log_success "Environment info saved to $info_file"
}

# Main execution
main() {
    log_info "Starting test environment setup for: $ENVIRONMENT"
    
    # Run setup steps
    check_prerequisites
    load_environment_config
    cleanup_environment
    create_test_directories
    setup_database
    generate_test_data
    setup_services
    setup_test_tools
    validate_environment
    create_environment_info
    
    log_success "Test environment setup completed! 🎉"
    log_info "Environment: $ENVIRONMENT"
    log_info "Database: ${DATABASE_URL:-not_configured}"
    log_info "Ready for testing!"
}

# Run main function
main "$@"