// Service Worker for PWA functionality and offline caching
const CACHE_NAME = 'starked-education-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://vjs.zencdn.net/8.6.1/video-js.css',
  'https://vjs.zencdn.net/8.6.1/video.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Clearing old cache');
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests unless they're in our allowed list
  if (url.origin !== location.origin && !urlsToCache.some(u => u.includes(url.origin))) {
    return;
  }

  // Strategy: Cache First for static assets, Network First for API calls
  if (request.url.includes('/api/')) {
    // Network First for API calls
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Try to get from cache if network fails
          return caches.match(request)
            .then((response) => {
              if (response) {
                return response;
              }
              // Return offline page for API failures
              return new Response(
                JSON.stringify({ error: 'Offline - Please check your connection' }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
  } else {
    // Cache First for static assets
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            console.log('Serving from cache:', request.url);
            return response;
          }
          
          // If not in cache, fetch from network
          return fetch(request)
            .then((response) => {
              // Don't cache non-successful responses
              if (!response.ok) {
                return response;
              }
              
              // Cache the response for future use
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
              
              return response;
            })
            .catch((error) => {
              console.error('Fetch failed:', error);
              
              // Return offline page for navigation requests
              if (request.mode === 'navigate') {
                return caches.match('/index.html')
                  .then((response) => {
                    return response || new Response('Offline', {
                      status: 503,
                      statusText: 'Service Unavailable'
                    });
                  });
              }
              
              // Return error for other requests
              return new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

// Handle background sync
async function doBackgroundSync() {
  try {
    // Get all pending sync items from IndexedDB
    const pendingItems = await getPendingSyncItems();
    
    for (const item of pendingItems) {
      try {
        // Retry the failed request
        await fetch(item.url, item.options);
        // Remove from pending items on success
        await removePendingSyncItem(item.id);
      } catch (error) {
        console.error('Background sync failed for item:', item, error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helpers for pending sync items
async function getPendingSyncItems() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('StarkedEducationDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const getAllRequest = store.getAll();
      
      getAllRequest.onerror = () => reject(getAllRequest.error);
      getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
    };
  });
}

async function removePendingSyncItem(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('StarkedEducationDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onsuccess = () => resolve();
    };
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from Starred Education',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/logo192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Starred Education', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling for cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Update specific cache entries
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => {
          return cache.add(event.data.url);
        })
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-courses') {
    console.log('Service Worker: Periodic sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

console.log('Service Worker: Loaded');
