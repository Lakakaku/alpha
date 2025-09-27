#!/bin/bash

# Test Status Check Script for Vercel Deployment Gate
# This script checks the latest test results to determine if deployment should proceed
# Exit code 0 = proceed with deployment, Exit code 1 = block deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WEBHOOK_URL="${TEST_WEBHOOK_URL:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
REPOSITORY="${VERCEL_GIT_REPO_SLUG:-}"
COMMIT_SHA="${VERCEL_GIT_COMMIT_SHA:-}"
BRANCH="${VERCEL_GIT_COMMIT_REF:-}"
TIMEOUT_SECONDS=300 # 5 minutes timeout

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

# Check if we're in a test environment (skip checks)
if [[ "${VERCEL_ENV}" == "development" ]] || [[ "${NODE_ENV}" == "test" ]]; then
    log_info "Development/test environment detected - skipping test checks"
    exit 0
fi

# Check if this is a preview deployment for non-main branches
if [[ "${VERCEL_ENV}" == "preview" ]] && [[ "${BRANCH}" != "main" ]] && [[ "${BRANCH}" != "develop" ]]; then
    log_info "Preview deployment for feature branch - allowing deployment"
    exit 0
fi

# Function to check GitHub Actions workflow status
check_github_actions_status() {
    if [[ -z "$GITHUB_TOKEN" ]] || [[ -z "$REPOSITORY" ]]; then
        log_warning "GitHub token or repository not configured - skipping GitHub Actions check"
        return 1
    fi

    log_info "Checking GitHub Actions status for $REPOSITORY:$COMMIT_SHA"

    local api_url="https://api.github.com/repos/$REPOSITORY/commits/$COMMIT_SHA/check-runs"
    local response
    
    response=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
                   -H "Accept: application/vnd.github.v3+json" \
                   "$api_url" 2>/dev/null || echo "")

    if [[ -z "$response" ]]; then
        log_error "Failed to fetch GitHub Actions status"
        return 1
    fi

    # Parse the response to check for test workflow status
    local test_workflows=$(echo "$response" | grep -o '"name":"[^"]*[Tt]est[^"]*"' | wc -l)
    local completed_workflows=$(echo "$response" | grep -c '"status":"completed"' || echo "0")
    local successful_workflows=$(echo "$response" | grep -c '"conclusion":"success"' || echo "0")
    local failed_workflows=$(echo "$response" | grep -c '"conclusion":"failure"' || echo "0")

    log_info "Found $test_workflows test workflow(s), $completed_workflows completed, $successful_workflows successful, $failed_workflows failed"

    # If we have test workflows and any failed, block deployment
    if [[ $failed_workflows -gt 0 ]]; then
        log_error "❌ Test workflows failed - blocking deployment"
        return 1
    fi

    # If we have test workflows and all are successful, allow deployment
    if [[ $test_workflows -gt 0 ]] && [[ $successful_workflows -gt 0 ]]; then
        log_success "✅ All test workflows passed - allowing deployment"
        return 0
    fi

    # If we have test workflows but they're not completed yet, wait or fail
    if [[ $test_workflows -gt 0 ]] && [[ $completed_workflows -lt $test_workflows ]]; then
        log_warning "⏳ Test workflows still running - will wait"
        return 2 # Special code for "wait"
    fi

    # No test workflows found
    log_warning "No test workflows found for this commit"
    return 1
}

# Function to check webhook-based test results
check_webhook_test_results() {
    if [[ -z "$WEBHOOK_URL" ]]; then
        log_warning "Webhook URL not configured - skipping webhook check"
        return 1
    fi

    log_info "Checking test results via webhook for commit $COMMIT_SHA"

    local webhook_check_url="$WEBHOOK_URL/test-results/recent?branch=$BRANCH&limit=5"
    local response
    
    response=$(curl -s "$webhook_check_url" 2>/dev/null || echo "")

    if [[ -z "$response" ]]; then
        log_error "Failed to fetch test results from webhook"
        return 1
    fi

    # Parse the response to find results for our commit
    local commit_found=$(echo "$response" | grep -c "$COMMIT_SHA" || echo "0")
    
    if [[ $commit_found -eq 0 ]]; then
        log_warning "No test results found for commit $COMMIT_SHA"
        return 1
    fi

    # Check if the test run passed
    local test_status=$(echo "$response" | grep -A 10 "$COMMIT_SHA" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [[ "$test_status" == "passed" ]]; then
        log_success "✅ Tests passed for commit $COMMIT_SHA - allowing deployment"
        return 0
    elif [[ "$test_status" == "failed" ]]; then
        log_error "❌ Tests failed for commit $COMMIT_SHA - blocking deployment"
        return 1
    else
        log_warning "⏳ Test status unknown or pending for commit $COMMIT_SHA"
        return 2
    fi
}

# Function to wait for test completion
wait_for_tests() {
    log_info "Waiting for tests to complete (timeout: ${TIMEOUT_SECONDS}s)..."
    
    local start_time=$(date +%s)
    local end_time=$((start_time + TIMEOUT_SECONDS))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        log_info "Checking test status... ($(( end_time - $(date +%s) ))s remaining)"
        
        # Try GitHub Actions first
        check_github_actions_status
        local github_result=$?
        
        if [[ $github_result -eq 0 ]]; then
            return 0
        elif [[ $github_result -eq 1 ]]; then
            return 1
        fi
        
        # Try webhook as fallback
        check_webhook_test_results
        local webhook_result=$?
        
        if [[ $webhook_result -eq 0 ]]; then
            return 0
        elif [[ $webhook_result -eq 1 ]]; then
            return 1
        fi
        
        # Wait before next check
        sleep 30
    done
    
    log_error "⏰ Timeout waiting for test results - blocking deployment"
    return 1
}

# Function to run local quick tests as fallback
run_fallback_tests() {
    log_info "Running fallback local tests..."
    
    # Check if we can run basic tests
    if [[ ! -f "package.json" ]]; then
        log_warning "No package.json found - skipping local tests"
        return 1
    fi
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing dependencies..."
        if command -v pnpm &> /dev/null; then
            pnpm install --frozen-lockfile --prod=false
        elif command -v npm &> /dev/null; then
            npm ci
        else
            log_error "No package manager found"
            return 1
        fi
    fi
    
    # Run lint and typecheck as minimum verification
    log_info "Running lint check..."
    if command -v pnpm &> /dev/null; then
        if ! pnpm run lint 2>/dev/null; then
            log_error "Lint check failed"
            return 1
        fi
        
        log_info "Running type check..."
        if ! pnpm run typecheck 2>/dev/null; then
            log_error "Type check failed"
            return 1
        fi
    else
        log_warning "Cannot run lint/typecheck - pnpm not available"
        return 1
    fi
    
    log_success "Basic checks passed"
    return 0
}

# Main execution
main() {
    log_info "🔍 Checking test status for deployment gate"
    log_info "Repository: $REPOSITORY"
    log_info "Branch: $BRANCH"
    log_info "Commit: $COMMIT_SHA"
    log_info "Environment: ${VERCEL_ENV:-unknown}"
    
    # Try GitHub Actions first
    log_info "📊 Checking GitHub Actions status..."
    check_github_actions_status
    local github_result=$?
    
    case $github_result in
        0)
            log_success "🚀 GitHub Actions tests passed - deployment approved"
            exit 0
            ;;
        1)
            log_error "🚫 GitHub Actions tests failed - deployment blocked"
            exit 1
            ;;
        2)
            log_info "⏳ GitHub Actions tests pending - will wait"
            ;;
    esac
    
    # Try webhook as alternative
    log_info "🌐 Checking webhook test results..."
    check_webhook_test_results
    local webhook_result=$?
    
    case $webhook_result in
        0)
            log_success "🚀 Webhook tests passed - deployment approved"
            exit 0
            ;;
        1)
            log_error "🚫 Webhook tests failed - deployment blocked"
            exit 1
            ;;
        2)
            log_info "⏳ Webhook tests pending - will wait"
            ;;
    esac
    
    # If both methods indicate pending, wait for completion
    if [[ $github_result -eq 2 ]] || [[ $webhook_result -eq 2 ]]; then
        wait_for_tests
        local wait_result=$?
        
        if [[ $wait_result -eq 0 ]]; then
            log_success "🚀 Tests completed successfully - deployment approved"
            exit 0
        else
            log_error "🚫 Tests failed or timed out - deployment blocked"
            exit 1
        fi
    fi
    
    # Fallback to local tests for critical branches
    if [[ "$BRANCH" == "main" ]] || [[ "$BRANCH" == "develop" ]]; then
        log_warning "⚠️  No remote test results available for critical branch - running local fallback tests"
        
        run_fallback_tests
        local fallback_result=$?
        
        if [[ $fallback_result -eq 0 ]]; then
            log_warning "🟡 Local fallback tests passed - allowing deployment with warning"
            exit 0
        else
            log_error "🚫 Local fallback tests failed - deployment blocked"
            exit 1
        fi
    fi
    
    # For non-critical branches, allow deployment if no test results are available
    log_warning "⚠️  No test results available for feature branch - allowing deployment"
    exit 0
}

# Execute main function
main "$@"