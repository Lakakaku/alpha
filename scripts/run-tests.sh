#!/bin/bash

# Comprehensive Test Execution Script
# Usage: ./scripts/run-tests.sh [test-type] [options]
# Test types: all, unit, contract, integration, e2e, performance, security

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="all"
VERBOSE=false
COVERAGE=false
PARALLEL=true
SKIP_BUILD=false
CLEANUP=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --type|-t)
            TEST_TYPE="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --sequential|-s)
            PARALLEL=false
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --type, -t TYPE     Test type (all, unit, contract, integration, e2e, performance, security)"
            echo "  --verbose, -v       Verbose output"
            echo "  --coverage, -c      Generate coverage reports"
            echo "  --sequential, -s    Run tests sequentially instead of parallel"
            echo "  --skip-build        Skip building applications"
            echo "  --no-cleanup        Skip cleanup after tests"
            echo "  --help, -h          Show this help message"
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install pnpm first."
        exit 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        pnpm install --frozen-lockfile
    fi
    
    # Check environment variables
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        log_warning "Supabase environment variables not set. Some tests may fail."
    fi
    
    log_success "Prerequisites check completed"
}

# Setup test environment
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Create test results directory
    mkdir -p test-results/{unit,contract,integration,e2e,performance,security}
    
    # Set environment variables for testing
    export NODE_ENV=test
    export CI=true
    export JEST_JUNIT_OUTPUT_DIR=test-results
    
    # Generate test data if needed
    if [ -f "tests/utils/generate-test-data.js" ]; then
        log_info "Generating test data..."
        node tests/utils/generate-test-data.js
    fi
    
    log_success "Test environment setup completed"
}

# Build applications
build_applications() {
    if [ "$SKIP_BUILD" = true ]; then
        log_info "Skipping build step"
        return
    fi
    
    log_info "Building applications..."
    
    # Build shared packages first
    pnpm --filter @vocilia/types build
    pnpm --filter @vocilia/database build
    pnpm --filter @vocilia/ui build
    
    # Build applications
    pnpm --filter @vocilia/backend build
    pnpm --filter @vocilia/customer build
    pnpm --filter @vocilia/business build
    pnpm --filter @vocilia/admin build
    
    log_success "Applications built successfully"
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    local coverage_flag=""
    if [ "$COVERAGE" = true ]; then
        coverage_flag="--coverage"
    fi
    
    local parallel_flag=""
    if [ "$PARALLEL" = true ]; then
        parallel_flag="--maxWorkers=4"
    else
        parallel_flag="--runInBand"
    fi
    
    # Run unit tests for each app
    local apps=("backend" "customer" "business" "admin")
    local failed_apps=()
    
    for app in "${apps[@]}"; do
        log_info "Running unit tests for $app..."
        if pnpm --filter @vocilia/$app test $coverage_flag $parallel_flag --passWithNoTests --testPathPattern="\.test\.(ts|tsx)$"; then
            log_success "Unit tests passed for $app"
        else
            log_error "Unit tests failed for $app"
            failed_apps+=("$app")
        fi
    done
    
    # Run shared package tests
    log_info "Running unit tests for shared packages..."
    pnpm --filter @vocilia/types test $coverage_flag $parallel_flag --passWithNoTests
    pnpm --filter @vocilia/database test $coverage_flag $parallel_flag --passWithNoTests
    
    if [ ${#failed_apps[@]} -gt 0 ]; then
        log_error "Unit tests failed for: ${failed_apps[*]}"
        return 1
    fi
    
    log_success "All unit tests passed"
}

# Run contract tests
run_contract_tests() {
    log_info "Running contract tests..."
    
    # Ensure backend is running for contract tests
    if ! pgrep -f "node.*backend" > /dev/null; then
        log_info "Starting backend for contract tests..."
        pnpm --filter @vocilia/backend start &
        BACKEND_PID=$!
        sleep 10
    fi
    
    # Run contract tests
    if jest tests/contract --testTimeout=30000 --verbose; then
        log_success "Contract tests passed"
        local result=0
    else
        log_error "Contract tests failed"
        local result=1
    fi
    
    # Stop backend if we started it
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    return $result
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    # Start required services
    log_info "Starting services for integration tests..."
    pnpm --filter @vocilia/backend start &
    BACKEND_PID=$!
    sleep 15
    
    # Run integration tests
    if jest tests/integration --testTimeout=60000 --verbose --runInBand; then
        log_success "Integration tests passed"
        local result=0
    else
        log_error "Integration tests failed"
        local result=1
    fi
    
    # Stop services
    kill $BACKEND_PID 2>/dev/null || true
    
    return $result
}

# Run E2E tests
run_e2e_tests() {
    log_info "Running E2E tests..."
    
    # Install Playwright browsers if needed
    if [ ! -d "$HOME/.cache/ms-playwright" ]; then
        log_info "Installing Playwright browsers..."
        npx playwright install --with-deps
    fi
    
    # Start all services
    log_info "Starting all services for E2E tests..."
    pnpm --filter @vocilia/backend start &
    BACKEND_PID=$!
    pnpm --filter @vocilia/customer start &
    CUSTOMER_PID=$!
    pnpm --filter @vocilia/business start &
    BUSINESS_PID=$!
    pnpm --filter @vocilia/admin start &
    ADMIN_PID=$!
    
    # Wait for services to be ready
    sleep 30
    
    # Run E2E tests
    if npx playwright test; then
        log_success "E2E tests passed"
        local result=0
    else
        log_error "E2E tests failed"
        local result=1
    fi
    
    # Stop all services
    kill $BACKEND_PID $CUSTOMER_PID $BUSINESS_PID $ADMIN_PID 2>/dev/null || true
    
    return $result
}

# Run performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    # Install Artillery if not present
    if ! command -v artillery &> /dev/null; then
        log_info "Installing Artillery..."
        npm install -g artillery@latest
    fi
    
    # Start services
    log_info "Starting services for performance tests..."
    pnpm --filter @vocilia/backend start &
    BACKEND_PID=$!
    pnpm --filter @vocilia/customer start &
    CUSTOMER_PID=$!
    sleep 30
    
    local failed_tests=()
    
    # Run API performance tests
    log_info "Running API performance tests..."
    if jest tests/performance/api-performance.test.ts --testTimeout=120000; then
        log_success "API performance tests passed"
    else
        log_error "API performance tests failed"
        failed_tests+=("api-performance")
    fi
    
    # Run page performance tests
    log_info "Running page performance tests..."
    if jest tests/performance/page-performance.test.ts --testTimeout=120000; then
        log_success "Page performance tests passed"
    else
        log_error "Page performance tests failed"
        failed_tests+=("page-performance")
    fi
    
    # Run Artillery load tests
    log_info "Running Artillery load tests..."
    if artillery run tests/performance/qr-workflow-load.yml; then
        log_success "QR workflow load test passed"
    else
        log_error "QR workflow load test failed"
        failed_tests+=("qr-load")
    fi
    
    if artillery run tests/performance/verification-load.yml; then
        log_success "Verification load test passed"
    else
        log_error "Verification load test failed"
        failed_tests+=("verification-load")
    fi
    
    # Run Lighthouse CI if available
    if command -v lhci &> /dev/null; then
        log_info "Running Lighthouse CI..."
        if lhci autorun --config=tests/performance/lighthouse.config.js; then
            log_success "Lighthouse CI passed"
        else
            log_error "Lighthouse CI failed"
            failed_tests+=("lighthouse")
        fi
    else
        log_warning "Lighthouse CI not available, skipping"
    fi
    
    # Stop services
    kill $BACKEND_PID $CUSTOMER_PID 2>/dev/null || true
    
    if [ ${#failed_tests[@]} -gt 0 ]; then
        log_error "Performance tests failed: ${failed_tests[*]}"
        return 1
    fi
    
    log_success "All performance tests passed"
}

# Run security tests
run_security_tests() {
    log_info "Running security tests..."
    
    local failed_tests=()
    
    # Run npm audit
    log_info "Running npm audit..."
    if pnpm audit --audit-level moderate; then
        log_success "npm audit passed"
    else
        log_warning "npm audit found issues (non-blocking)"
    fi
    
    # Run security-specific tests if they exist
    if [ -d "tests/security" ]; then
        log_info "Running security test suite..."
        if jest tests/security --testTimeout=30000; then
            log_success "Security tests passed"
        else
            log_error "Security tests failed"
            failed_tests+=("security")
        fi
    fi
    
    if [ ${#failed_tests[@]} -gt 0 ]; then
        log_error "Security tests failed: ${failed_tests[*]}"
        return 1
    fi
    
    log_success "All security tests passed"
}

# Cleanup
cleanup() {
    if [ "$CLEANUP" = false ]; then
        log_info "Skipping cleanup"
        return
    fi
    
    log_info "Cleaning up..."
    
    # Kill any remaining processes
    pkill -f "node.*vocilia" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    
    # Clean up test artifacts if needed
    if [ "$COVERAGE" = false ]; then
        rm -rf coverage/ 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

# Generate test report
generate_report() {
    log_info "Generating test report..."
    
    local report_file="test-results/test-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Test Execution Report

**Date**: $(date)
**Test Type**: $TEST_TYPE
**Options**: Coverage: $COVERAGE, Parallel: $PARALLEL

## Summary

$(if [ $? -eq 0 ]; then echo "✅ **Overall Status**: PASSED"; else echo "❌ **Overall Status**: FAILED"; fi)

## Test Results

EOF
    
    # Add individual test results to report
    if [ -f "test-results/junit.xml" ]; then
        echo "See attached JUnit XML for detailed results." >> "$report_file"
    fi
    
    log_success "Test report generated: $report_file"
}

# Main execution
main() {
    log_info "Starting comprehensive test execution..."
    log_info "Test type: $TEST_TYPE"
    log_info "Options: verbose=$VERBOSE, coverage=$COVERAGE, parallel=$PARALLEL"
    
    # Setup trap for cleanup
    trap cleanup EXIT
    
    # Run prerequisite checks
    check_prerequisites
    setup_test_environment
    
    # Build if needed
    if [[ "$TEST_TYPE" =~ ^(all|integration|e2e|performance)$ ]]; then
        build_applications
    fi
    
    local overall_result=0
    
    # Execute tests based on type
    case $TEST_TYPE in
        "all")
            run_unit_tests || overall_result=1
            run_contract_tests || overall_result=1
            run_integration_tests || overall_result=1
            run_e2e_tests || overall_result=1
            run_performance_tests || overall_result=1
            run_security_tests || overall_result=1
            ;;
        "unit")
            run_unit_tests || overall_result=1
            ;;
        "contract")
            run_contract_tests || overall_result=1
            ;;
        "integration")
            run_integration_tests || overall_result=1
            ;;
        "e2e")
            run_e2e_tests || overall_result=1
            ;;
        "performance")
            run_performance_tests || overall_result=1
            ;;
        "security")
            run_security_tests || overall_result=1
            ;;
        *)
            log_error "Unknown test type: $TEST_TYPE"
            exit 1
            ;;
    esac
    
    # Generate report
    generate_report
    
    # Final result
    if [ $overall_result -eq 0 ]; then
        log_success "All tests completed successfully! 🎉"
    else
        log_error "Some tests failed! ❌"
    fi
    
    exit $overall_result
}

# Run main function
main "$@"