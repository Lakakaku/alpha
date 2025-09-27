/**
 * Lighthouse CI Configuration for Vocilia Alpha
 * Performance auditing for customer, business, and admin applications
 */

module.exports = {
  ci: {
    collect: {
      // URLs to audit
      url: [
        // Customer app - mobile-first PWA
        'http://localhost:3000',
        'http://localhost:3000/qr/scan',
        'http://localhost:3000/verification',
        'http://localhost:3000/support',
        
        // Business app - dashboard and management
        'http://localhost:3001/dashboard',
        'http://localhost:3001/stores',
        'http://localhost:3001/questions',
        'http://localhost:3001/feedback-analysis',
        
        // Admin app - administrative functions
        'http://localhost:3002/admin',
        'http://localhost:3002/testing',
        'http://localhost:3002/monitoring',
        'http://localhost:3002/payments'
      ],
      
      // Collection settings
      numberOfRuns: 3, // Run 3 times and take median
      startServerCommand: 'pnpm dev:all', // Start all apps
      startServerReadyPattern: 'ready', // Wait for this pattern
      startServerReadyTimeout: 60000, // 60 second timeout
      
      // Chrome settings for consistent results
      chromePath: process.env.CHROME_PATH,
      chromeFlags: [
        '--headless',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      
      // Device simulation
      settings: {
        // Mobile device simulation for customer app
        emulatedFormFactor: 'mobile',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4
        },
        // Collect all relevant metrics
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo',
          'pwa'
        ]
      }
    },
    
    assert: {
      // Performance budgets - constitutional requirements
      assertions: {
        // Core Web Vitals thresholds
        'categories:performance': ['error', { minScore: 0.9 }], // 90+ performance score
        'categories:accessibility': ['error', { minScore: 0.95 }], // 95+ accessibility score
        'categories:best-practices': ['error', { minScore: 0.9 }], // 90+ best practices score
        'categories:seo': ['error', { minScore: 0.9 }], // 90+ SEO score
        'categories:pwa': ['error', { minScore: 0.8 }], // 80+ PWA score (customer app only)
        
        // Performance metrics - constitutional requirements
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }], // < 1.8s FCP
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // < 2.5s LCP
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // < 0.1 CLS
        'total-blocking-time': ['error', { maxNumericValue: 300 }], // < 300ms TBT
        'speed-index': ['error', { maxNumericValue: 3000 }], // < 3s Speed Index
        
        // Resource optimization
        'unused-css-rules': ['warn', { maxNumericValue: 50000 }], // < 50KB unused CSS
        'unused-javascript': ['warn', { maxNumericValue: 100000 }], // < 100KB unused JS
        'render-blocking-resources': ['warn', { maxNumericValue: 500 }], // < 500ms blocking
        
        // Image optimization
        'modern-image-formats': ['warn', { minScore: 0.8 }],
        'efficient-animated-content': ['warn', { minScore: 0.8 }],
        'offscreen-images': ['warn', { minScore: 0.8 }],
        
        // Network efficiency
        'uses-text-compression': ['error', { minScore: 1 }],
        'uses-responsive-images': ['warn', { minScore: 0.8 }],
        'preload-lcp-image': ['warn', { minScore: 0.8 }],
        
        // PWA requirements (for customer app)
        'installable-manifest': ['warn', { minScore: 1 }],
        'service-worker': ['warn', { minScore: 1 }],
        'splash-screen': ['warn', { minScore: 1 }],
        'themed-omnibox': ['warn', { minScore: 1 }],
        
        // Accessibility requirements
        'color-contrast': ['error', { minScore: 1 }],
        'heading-order': ['error', { minScore: 1 }],
        'aria-allowed-attr': ['error', { minScore: 1 }],
        'aria-required-attr': ['error', { minScore: 1 }],
        'button-name': ['error', { minScore: 1 }],
        'link-name': ['error', { minScore: 1 }],
        
        // SEO requirements
        'meta-description': ['error', { minScore: 1 }],
        'document-title': ['error', { minScore: 1 }],
        'html-has-lang': ['error', { minScore: 1 }],
        'meta-viewport': ['error', { minScore: 1 }]
      }
    },
    
    upload: {
      // Storage configuration for results
      target: 'temporary-public-storage', // Use temporary storage for CI
      // Uncomment and configure for persistent storage:
      // target: 'lhci',
      // serverBaseUrl: process.env.LHCI_SERVER_URL,
      // token: process.env.LHCI_TOKEN
    },
    
    server: {
      // Local server configuration for development
      port: 9001,
      storage: {
        storageMethod: 'sql',
        sqlDialect: 'sqlite',
        sqlDatabasePath: './lighthouse-results.db'
      }
    }
  },
  
  // Custom configuration for different app types
  configurations: {
    // Customer app - mobile-first PWA configuration
    'customer-mobile': {
      extends: 'lighthouse:default',
      settings: {
        emulatedFormFactor: 'mobile',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4, // Slow 4G
          cpuSlowdownMultiplier: 4
        },
        onlyCategories: ['performance', 'pwa', 'accessibility']
      }
    },
    
    // Business app - desktop configuration
    'business-desktop': {
      extends: 'lighthouse:default',
      settings: {
        emulatedFormFactor: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240, // Fast connection
          cpuSlowdownMultiplier: 1
        },
        onlyCategories: ['performance', 'best-practices', 'accessibility']
      }
    },
    
    // Admin app - secure desktop configuration
    'admin-desktop': {
      extends: 'lighthouse:default',
      settings: {
        emulatedFormFactor: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1
        },
        onlyCategories: ['performance', 'best-practices', 'accessibility', 'seo']
      }
    }
  },
  
  // Budget configuration for performance monitoring
  budgets: [
    {
      // Customer app performance budget
      path: '/',
      resourceSizes: [
        { resourceType: 'script', budget: 400 }, // 400KB JavaScript
        { resourceType: 'stylesheet', budget: 100 }, // 100KB CSS
        { resourceType: 'image', budget: 500 }, // 500KB images
        { resourceType: 'font', budget: 100 }, // 100KB fonts
        { resourceType: 'total', budget: 1000 } // 1MB total
      ],
      resourceCounts: [
        { resourceType: 'script', budget: 10 }, // Max 10 JS files
        { resourceType: 'stylesheet', budget: 5 }, // Max 5 CSS files
        { resourceType: 'image', budget: 20 }, // Max 20 images
        { resourceType: 'third-party', budget: 5 } // Max 5 third-party resources
      ],
      timings: [
        { metric: 'first-contentful-paint', budget: 1800 },
        { metric: 'largest-contentful-paint', budget: 2500 },
        { metric: 'cumulative-layout-shift', budget: 100 }, // CLS * 1000
        { metric: 'total-blocking-time', budget: 300 },
        { metric: 'speed-index', budget: 3000 }
      ]
    }
  ],
  
  // Plugins for enhanced reporting
  plugins: [
    '@lhci/plugin-lighthouse-plugin-field-performance'
  ],
  
  // Environment-specific overrides
  ...(process.env.CI && {
    ci: {
      collect: {
        // Use production URLs in CI
        url: [
          process.env.CUSTOMER_APP_URL || 'https://vocilia-customer.vercel.app',
          process.env.BUSINESS_APP_URL || 'https://vocilia-business.vercel.app',
          process.env.ADMIN_APP_URL || 'https://vocilia-admin.vercel.app'
        ],
        // Don't start server in CI - use deployed apps
        startServerCommand: undefined,
        // More runs for stable CI results
        numberOfRuns: 5
      },
      upload: {
        target: 'lhci',
        serverBaseUrl: process.env.LHCI_SERVER_URL,
        token: process.env.LHCI_TOKEN
      }
    }
  })
};