/**
 * Jest Environment Setup for Security Testing
 * Environment variables and configuration for security test execution
 */

// Security testing environment variables
process.env.NODE_ENV = 'test';
process.env.SECURITY_TEST_MODE = 'true';
process.env.PERFORMANCE_MONITORING = 'true';

// Constitutional compliance settings
process.env.TYPESCRIPT_STRICT_MODE = 'true';
process.env.REAL_DATA_VALIDATION = 'true';
process.env.PRODUCTION_READY_TESTING = 'true';

// Performance monitoring
process.env.PERFORMANCE_LIMIT = '10'; // Maximum 10% degradation

// Database configuration for security testing
process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL || process.env.SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || process.env.SUPABASE_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Security test user credentials
process.env.ADMIN_TEST_TOKEN = process.env.ADMIN_TEST_TOKEN || 'test-admin-token';
process.env.BUSINESS_TEST_TOKEN = process.env.BUSINESS_TEST_TOKEN || 'test-business-token';
process.env.CUSTOMER_TEST_PHONE = process.env.CUSTOMER_TEST_PHONE || '+46701234567';

// OWASP ZAP configuration
process.env.ZAP_ENABLED = process.env.ZAP_ENABLED || 'false';
process.env.ZAP_API_URL = process.env.ZAP_API_URL || 'http://localhost:8080';
process.env.ZAP_PROXY_HOST = process.env.ZAP_PROXY_HOST || 'localhost';
process.env.ZAP_PROXY_PORT = process.env.ZAP_PROXY_PORT || '8081';

// Security test timeouts
process.env.SECURITY_TEST_TIMEOUT = '30000'; // 30 seconds
process.env.VULNERABILITY_SCAN_TIMEOUT = '1800000'; // 30 minutes
process.env.GDPR_DELETION_TIMEOUT = '259200000'; // 72 hours

// Privacy and GDPR testing
process.env.GDPR_TEST_MODE = 'true';
process.env.PRIVACY_VALIDATION_MODE = 'true';
process.env.DATA_ANONYMIZATION_TESTING = 'true';

// Authentication and authorization testing
process.env.AUTH_BRUTE_FORCE_THRESHOLD = '5';
process.env.SESSION_TIMEOUT_HOURS = '2';
process.env.PRIVILEGE_ESCALATION_TESTING = 'true';

// Logging configuration for security tests
process.env.LOG_LEVEL = 'debug';
process.env.SECURITY_AUDIT_LOGGING = 'true';
process.env.TEST_EXECUTION_LOGGING = 'true';

console.log('Security testing environment configured with strict compliance settings');