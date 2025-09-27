/**
 * Jest Security Testing Setup
 * Global configuration and utilities for security test execution
 */

import { OwaspZapClient } from './owasp-zap-config';

// Global test configuration
const SECURITY_TEST_TIMEOUT = 30000; // 30 seconds
const PERFORMANCE_LIMIT = 10; // Maximum 10% performance degradation

// Security test environment setup
beforeAll(async () => {
  // Set longer timeout for security tests
  jest.setTimeout(SECURITY_TEST_TIMEOUT);
  
  // Initialize performance monitoring
  if (process.env.PERFORMANCE_MONITORING === 'true') {
    global.performanceBaseline = await measureBaseline();
  }
  
  // Setup OWASP ZAP if available
  if (process.env.ZAP_ENABLED === 'true') {
    global.zapClient = new OwaspZapClient();
    const connected = await global.zapClient.initialize();
    if (!connected) {
      console.warn('OWASP ZAP not available - vulnerability scans will be skipped');
    }
  }
  
  console.log('Security testing environment initialized');
});

// Performance monitoring utilities
async function measureBaseline(): Promise<{ cpu: number; memory: number }> {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  // Wait 1 second to get baseline measurements
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const endTime = process.hrtime.bigint();
  const endMemory = process.memoryUsage();
  
  return {
    cpu: Number(endTime - startTime) / 1000000, // Convert to milliseconds
    memory: endMemory.heapUsed - startMemory.heapUsed
  };
}

// Security test utilities
export const securityTestUtils = {
  /**
   * Measure performance impact of security test
   */
  async measurePerformanceImpact<T>(testFunction: () => Promise<T>): Promise<{
    result: T;
    performanceImpact: number;
  }> {
    const baseline = global.performanceBaseline || { cpu: 0, memory: 0 };
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    const result = await testFunction();
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000;
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    
    // Calculate performance impact as percentage
    const cpuImpact = ((duration - baseline.cpu) / baseline.cpu) * 100;
    const memoryImpact = ((memoryDelta - baseline.memory) / baseline.memory) * 100;
    const performanceImpact = Math.max(cpuImpact, memoryImpact);
    
    // Validate constitutional requirement
    if (performanceImpact > PERFORMANCE_LIMIT) {
      throw new Error(
        `Performance impact ${performanceImpact.toFixed(2)}% exceeds limit of ${PERFORMANCE_LIMIT}%`
      );
    }
    
    return { result, performanceImpact };
  },
  
  /**
   * Create test user with specific role for authorization testing
   */
  async createTestUser(role: 'admin' | 'business' | 'customer'): Promise<{
    id: string;
    token: string;
    cleanup: () => Promise<void>;
  }> {
    const testId = `test-${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // This would integrate with actual auth system
    const mockUser = {
      id: testId,
      role,
      token: `test-token-${testId}`,
      permissions: getPermissionsForRole(role)
    };
    
    // Store in test registry for cleanup
    global.testUsers = global.testUsers || [];
    global.testUsers.push(mockUser);
    
    return {
      id: mockUser.id,
      token: mockUser.token,
      cleanup: async () => {
        // Remove from test registry
        global.testUsers = global.testUsers.filter((u: any) => u.id !== mockUser.id);
      }
    };
  },
  
  /**
   * Generate common attack payloads for security testing
   */
  getAttackPayloads(): {
    xss: string[];
    sqlInjection: string[];
    commandInjection: string[];
    pathTraversal: string[];
  } {
    return {
      xss: [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert("xss")',
        '"><script>alert("xss")</script>'
      ],
      sqlInjection: [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM admin_accounts --",
        "1'; EXEC xp_cmdshell('dir'); --",
        "' OR 1=1 --"
      ],
      commandInjection: [
        '; cat /etc/passwd',
        '| whoami',
        '&& ls -la',
        '$(cat /etc/passwd)',
        '`cat /etc/passwd`'
      ],
      pathTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd'
      ]
    };
  }
};

function getPermissionsForRole(role: string): string[] {
  switch (role) {
    case 'admin':
      return ['*']; // Full access
    case 'business':
      return ['business:read', 'business:write', 'stores:manage'];
    case 'customer':
      return ['customer:read', 'feedback:submit'];
    default:
      return [];
  }
}

// Cleanup after all security tests
afterAll(async () => {
  // Cleanup test users
  if (global.testUsers) {
    for (const user of global.testUsers) {
      // Cleanup logic would go here
    }
    global.testUsers = [];
  }
  
  // Cleanup ZAP client
  if (global.zapClient) {
    // Stop any running scans
    console.log('Cleaning up OWASP ZAP resources');
  }
  
  console.log('Security testing cleanup completed');
});

// Global type declarations for TypeScript
declare global {
  var performanceBaseline: { cpu: number; memory: number };
  var zapClient: OwaspZapClient;
  var testUsers: any[];
}