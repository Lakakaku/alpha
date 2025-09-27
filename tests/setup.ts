/**
 * Global test setup for Jest
 * Configures Supabase test client and global test utilities
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env.test if it exists
config({ path: '.env.test' });

// Test database configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'test-anon-key';

// Create Supabase test client
export const supabaseTest = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Global test configuration
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.TZ = 'Europe/Stockholm'; // Swedish timezone for consistent test data
  
  // Configure timeouts for slower operations
  jest.setTimeout(30000);
  
  // Mock console methods to reduce noise in tests
  if (!process.env.DEBUG_TESTS) {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  }
  
  // Verify test database connection
  try {
    const { data, error } = await supabaseTest.from('stores').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = relation doesn't exist (OK for empty test DB)
      console.error('Test database connection failed:', error);
    }
  } catch (err) {
    console.warn('Could not verify test database connection:', err);
  }
});

// Clean up after each test
afterEach(async () => {
  // Clear any authentication state
  await supabaseTest.auth.signOut();
  
  // Reset all mocks
  jest.clearAllMocks();
});

// Global cleanup
afterAll(async () => {
  // Close any open connections
  if (supabaseTest) {
    // Supabase client doesn't have an explicit close method
    // Connection will be closed automatically
  }
});

// Global test utilities
declare global {
  var testUtils: {
    createTestUser: (userData?: Partial<TestUser>) => Promise<TestUser>;
    createTestStore: (storeData?: Partial<TestStore>) => Promise<TestStore>;
    createTestBusiness: (businessData?: Partial<TestBusiness>) => Promise<TestBusiness>;
    createTestAdmin: (adminData?: Partial<TestAdmin>) => Promise<TestAdmin>;
    cleanupTestData: () => Promise<void>;
    waitForAsync: (ms?: number) => Promise<void>;
    mockSwedishPhoneNumber: () => string;
    mockSwedishPersonName: () => { firstName: string; lastName: string };
  };
}

// Test data interfaces
interface TestUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

interface TestStore {
  id: string;
  name: string;
  businessId: string;
  location: string;
  qrCode?: string;
  createdAt: string;
}

interface TestBusiness {
  id: string;
  name: string;
  orgNumber: string;
  contactEmail: string;
  createdAt: string;
}

interface TestAdmin {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  createdAt: string;
}

// Swedish test data generators using minimal faker functionality
const generateSwedishPhone = (): string => {
  // Swedish mobile number format: +46 7X XXX XX XX
  const prefix = '+46 7';
  const secondDigit = Math.floor(Math.random() * 9); // 0-8 (9 is less common)
  const remaining = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
  return `${prefix}${secondDigit} ${remaining.slice(0, 3)} ${remaining.slice(3, 5)} ${remaining.slice(5)}`;
};

const generateSwedishName = (): { firstName: string; lastName: string } => {
  const firstNames = [
    'Emma', 'William', 'Alice', 'Lucas', 'Maja', 'Liam', 'Elsa', 'Noah', 'Olivia', 'Oliver',
    'Astrid', 'Hugo', 'Ebba', 'Theo', 'Wilma', 'Levi', 'Alma', 'Isak', 'Stella', 'Leon'
  ];
  const lastNames = [
    'Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson',
    'Svensson', 'Gustafsson', 'Pettersson', 'Jonsson', 'Jansson', 'Hansson', 'Bengtsson'
  ];
  
  return {
    firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
    lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
  };
};

// Test utilities implementation
global.testUtils = {
  async createTestUser(userData = {}): Promise<TestUser> {
    const name = generateSwedishName();
    const phone = generateSwedishPhone();
    const defaultUser = {
      id: `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      phone,
      firstName: name.firstName,
      lastName: name.lastName,
      email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}@test.vocilia.se`,
      createdAt: new Date().toISOString(),
    };
    
    return { ...defaultUser, ...userData };
  },
  
  async createTestStore(storeData = {}): Promise<TestStore> {
    const storeNames = [
      'ICA Supermarket', 'Coop Extra', 'Hemköp', 'City Gross', 'Willys',
      'Pressbyrån', 'Apotek Hjärtat', 'Systembolaget', 'H&M', 'Elgiganten'
    ];
    const locations = [
      'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås',
      'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping'
    ];
    
    const defaultStore = {
      id: `test_store_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: storeNames[Math.floor(Math.random() * storeNames.length)],
      businessId: `test_business_${Date.now()}`,
      location: locations[Math.floor(Math.random() * locations.length)],
      createdAt: new Date().toISOString(),
    };
    
    return { ...defaultStore, ...storeData };
  },
  
  async createTestBusiness(businessData = {}): Promise<TestBusiness> {
    const businessTypes = [
      'Retail AB', 'Handel & Service AB', 'Nordic Trade AB', 'Swedish Commerce AB',
      'Butik & Handel AB', 'Service Solutions AB', 'Trade Partners AB'
    ];
    
    const defaultBusiness = {
      id: `test_business_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: businessTypes[Math.floor(Math.random() * businessTypes.length)],
      orgNumber: `55${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`,
      contactEmail: `contact@${Math.random().toString(36).substr(2, 5)}.test.se`,
      createdAt: new Date().toISOString(),
    };
    
    return { ...defaultBusiness, ...businessData };
  },
  
  async createTestAdmin(adminData = {}): Promise<TestAdmin> {
    const defaultAdmin = {
      id: `test_admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: `admin.${Math.random().toString(36).substr(2, 5)}@vocilia.se`,
      name: 'Test Administrator',
      role: 'admin' as const,
      createdAt: new Date().toISOString(),
    };
    
    return { ...defaultAdmin, ...adminData };
  },
  
  async cleanupTestData(): Promise<void> {
    // In a real implementation, this would clean up test data from database
    // For now, we'll just clear any in-memory test state
    jest.clearAllMocks();
  },
  
  async waitForAsync(ms = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  mockSwedishPhoneNumber(): string {
    return generateSwedishPhone();
  },
  
  mockSwedishPersonName(): { firstName: string; lastName: string } {
    return generateSwedishName();
  },
};

// Export test client and utilities for direct imports
export { testUtils } from './setup';
export default supabaseTest;