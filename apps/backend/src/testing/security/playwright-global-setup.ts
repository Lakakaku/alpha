/**
 * Playwright Global Setup for Security Testing
 * Initialize security testing environment and authentication states
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('Setting up security testing environment...');

  // Create browser instance for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Setup admin authentication state
    await setupAdminAuth(page);
    
    // Setup business authentication state  
    await setupBusinessAuth(page);
    
    // Verify security testing endpoints are available
    await verifySecurityEndpoints(page);
    
    console.log('Security testing environment setup completed');
  } catch (error) {
    console.error('Failed to setup security testing environment:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function setupAdminAuth(page: any) {
  const baseURL = process.env.ADMIN_BASE_URL || 'http://localhost:3002';
  
  // Navigate to admin login
  await page.goto(`${baseURL}/login`);
  
  // Login with test admin credentials
  await page.fill('[data-testid="email"]', process.env.ADMIN_TEST_EMAIL || 'security-test@vocilia.com');
  await page.fill('[data-testid="password"]', process.env.ADMIN_TEST_PASSWORD || 'SecureTestPassword123!');
  await page.click('[data-testid="login-submit"]');
  
  // Wait for successful login
  await page.waitForURL('**/admin/dashboard');
  
  // Save authentication state
  await page.context().storageState({ 
    path: path.join(__dirname, '../../../tests/fixtures/admin-auth-state.json')
  });
  
  console.log('Admin authentication state saved');
}

async function setupBusinessAuth(page: any) {
  const baseURL = process.env.BUSINESS_BASE_URL || 'http://localhost:3001';
  
  // Navigate to business login
  await page.goto(`${baseURL}/login`);
  
  // Login with test business credentials
  await page.fill('[data-testid="email"]', process.env.BUSINESS_TEST_EMAIL || 'business-test@vocilia.com');
  await page.fill('[data-testid="password"]', process.env.BUSINESS_TEST_PASSWORD || 'BusinessTestPassword123!');
  await page.click('[data-testid="login-submit"]');
  
  // Wait for successful login
  await page.waitForURL('**/dashboard');
  
  // Save authentication state
  await page.context().storageState({ 
    path: path.join(__dirname, '../../../tests/fixtures/business-auth-state.json')
  });
  
  console.log('Business authentication state saved');
}

async function verifySecurityEndpoints(page: any) {
  const apiBaseURL = process.env.API_BASE_URL || 'http://localhost:3000';
  
  // Verify health endpoint is accessible
  const healthResponse = await page.request.get(`${apiBaseURL}/api/health`);
  if (!healthResponse.ok()) {
    throw new Error(`Health endpoint not accessible: ${healthResponse.status()}`);
  }
  
  // Verify admin endpoints require authentication
  const adminResponse = await page.request.get(`${apiBaseURL}/api/admin/stores`);
  if (adminResponse.status() !== 401 && adminResponse.status() !== 403) {
    console.warn('Admin endpoints may not be properly protected');
  }
  
  console.log('Security endpoint verification completed');
}

export default globalSetup;