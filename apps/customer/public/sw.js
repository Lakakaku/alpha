// Vocilia Customer PWA Service Worker
// Handles caching, offline functionality, and background sync

const CACHE_NAME = 'vocilia-customer-v1.2.0';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  
  // Core pages
  '/verify',
  '/call-status',
  '/settings',
  
  // Icons (placeholder paths - actual icons would need to be generated)
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  
  // Critical CSS and JS will be injected by build process
  // Next.js will handle this through workbox integration
];

// API endpoints to cache with strategies
const API_CACHE_PATTERNS = [
  { pattern: /\/api\/v1\/calls\/.*\/status/, strategy: 'network-first', ttl: 30000 },
  { pattern: /\/api\/v1\/verification\/.*/, strategy: 'network-only' },
  { pattern: /\/api\/v1\/support\/faq/, strategy: 'cache-first', ttl: 3600000 },
  { pattern: /\/api\/v1\/accessibility\/.*/, strategy: 'network-first', ttl: 300000 }
];

// Background sync configuration
const BACKGROUND_SYNC_TAG = 'vocilia-offline-sync';
const RETRY_DELAY = 30000; // 30 seconds

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('vocilia-customer-') && 
                !cacheName.includes('v1.2.0')) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with appropriate strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and different origins (except API)
  if (request.method !== 'GET') {
    if (request.method === 'POST' && isOfflineSubmission(request)) {
      event.respondWith(handleOfflineSubmission(request));
    }
    return;
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
  } else {
    event.respondWith(handleDynamicAsset(request));
  }
});

// Handle API requests with appropriate caching strategies
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Find matching cache pattern
  const cacheRule = API_CACHE_PATTERNS.find(rule => 
    rule.pattern.test(url.pathname)
  );
  
  if (!cacheRule) {
    // Default to network-only for unconfigured API endpoints
    return fetch(request);
  }
  
  switch (cacheRule.strategy) {
    case 'network-first':
      return networkFirst(request, API_CACHE, cacheRule.ttl);
    case 'cache-first':
      return cacheFirst(request, API_CACHE, cacheRule.ttl);
    case 'network-only':
    default:
      return fetch(request);
  }
}

// Handle static assets (cache-first strategy)
async function handleStaticAsset(request) {
  return cacheFirst(request, STATIC_CACHE);
}

// Handle navigation requests (network-first with offline fallback)
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful navigation responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Serve from cache or offline page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Serve offline page for navigation requests
    return caches.match('/offline');
  }
}

// Handle dynamic assets (network-first)
async function handleDynamicAsset(request) {
  return networkFirst(request, DYNAMIC_CACHE);
}

// Caching strategies
async function networkFirst(request, cacheName, ttl = 300000) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();
      
      // Add timestamp for TTL
      if (ttl) {
        const headers = new Headers(responseToCache.headers);
        headers.set('sw-cache-timestamp', Date.now().toString());
        const modifiedResponse = new Response(await responseToCache.arrayBuffer(), {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers
        });
        cache.put(request, modifiedResponse);
      } else {
        cache.put(request, responseToCache);
      }
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await getCachedResponse(request, cacheName, ttl);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function cacheFirst(request, cacheName, ttl = 3600000) {
  const cachedResponse = await getCachedResponse(request, cacheName, ttl);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const cache = await caches.open(cacheName);
    const responseToCache = networkResponse.clone();
    
    if (ttl) {
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-timestamp', Date.now().toString());
      const modifiedResponse = new Response(await responseToCache.arrayBuffer(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      cache.put(request, modifiedResponse);
    } else {
      cache.put(request, responseToCache);
    }
  }
  
  return networkResponse;
}

// Get cached response with TTL check
async function getCachedResponse(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (!cachedResponse) {
    return null;
  }
  
  // Check TTL if specified
  if (ttl) {
    const cacheTimestamp = cachedResponse.headers.get('sw-cache-timestamp');
    if (cacheTimestamp) {
      const age = Date.now() - parseInt(cacheTimestamp);
      if (age > ttl) {
        // Expired, remove from cache
        cache.delete(request);
        return null;
      }
    }
  }
  
  return cachedResponse;
}

// Utility functions
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)$/.test(pathname) ||
         pathname.startsWith('/icons/') ||
         pathname.startsWith('/screenshots/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

function isOfflineSubmission(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/offline/submit') || 
         url.pathname.includes('/verification/submit');
}

// Handle offline submissions (store for background sync)
async function handleOfflineSubmission(request) {
  try {
    // Try network first
    return await fetch(request);
  } catch (error) {
    // Store for background sync
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.arrayBuffer(),
      timestamp: Date.now()
    };
    
    // Store in IndexedDB for background sync
    await storeOfflineSubmission(requestData);
    
    // Register background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register(BACKGROUND_SYNC_TAG);
    }
    
    // Return offline response
    return new Response(JSON.stringify({
      success: false,
      offline: true,
      message: 'Submission queued for when connection is restored',
      queued_at: new Date().toISOString()
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === BACKGROUND_SYNC_TAG) {
    event.waitUntil(processOfflineSubmissions());
  }
});

// Process queued offline submissions
async function processOfflineSubmissions() {
  console.log('[SW] Processing offline submissions...');
  
  try {
    const submissions = await getOfflineSubmissions();
    
    for (const submission of submissions) {
      try {
        const request = new Request(submission.url, {
          method: submission.method,
          headers: submission.headers,
          body: submission.body
        });
        
        const response = await fetch(request);
        
        if (response.ok) {
          // Successfully sent, remove from queue
          await removeOfflineSubmission(submission.id);
          console.log('[SW] Offline submission sent successfully:', submission.id);
          
          // Notify clients of successful sync
          notifyClients('sync-success', { submissionId: submission.id });
        } else {
          console.warn('[SW] Offline submission failed:', response.status);
        }
      } catch (error) {
        console.error('[SW] Error processing offline submission:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Error processing offline submissions:', error);
  }
}

// IndexedDB operations for offline storage
async function storeOfflineSubmission(submissionData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('vocilia-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['submissions'], 'readwrite');
      const store = transaction.objectStore('submissions');
      
      const id = Date.now() + Math.random();
      store.add({ ...submissionData, id });
      
      transaction.oncomplete = () => resolve(id);
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', { keyPath: 'id' });
      }
    };
  });
}

async function getOfflineSubmissions() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('vocilia-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['submissions'], 'readonly');
      const store = transaction.objectStore('submissions');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
}

async function removeOfflineSubmission(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('vocilia-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['submissions'], 'readwrite');
      const store = transaction.objectStore('submissions');
      
      store.delete(id);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'Ditt samtal är redo att bekräftas',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/call-status'
    },
    actions: [
      {
        action: 'view',
        title: 'Visa samtal',
        icon: '/icons/action-view.png'
      },
      {
        action: 'dismiss',
        title: 'Avvisa',
        icon: '/icons/action-dismiss.png'
      }
    ],
    requireInteraction: true,
    tag: 'call-ready'
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.message || options.body;
      options.data = { ...options.data, ...data };
    } catch (error) {
      console.warn('[SW] Failed to parse push data:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('Vocilia - Samtalsuppdatering', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message handling for client communication
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
      case 'CLEAR_CACHE':
        clearAllCaches().then(() => {
          event.ports[0].postMessage({ success: true });
        });
        break;
    }
  }
});

// Utility function to notify all clients
function notifyClients(type, data = {}) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type, ...data });
    });
  });
}

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service worker script loaded');