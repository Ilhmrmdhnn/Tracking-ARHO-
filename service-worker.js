const CACHE_NAME = 'gps-tracker-v2';
const urlsToCache = [
  './tracker.html',
  './dashboard.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('Service Worker: Cache failed', err);
      })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Background Sync - retry failed location updates
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'sync-location') {
    event.waitUntil(syncLocationData());
  }
});

// Periodic Background Sync (if supported and PWA installed)
self.addEventListener('periodicsync', (event) => {
  console.log('Service Worker: Periodic sync triggered', event.tag);
  
  if (event.tag === 'location-sync') {
    event.waitUntil(periodicLocationUpdate());
  }
});

// Function to sync queued location data
async function syncLocationData() {
  try {
    // This will be called when connection is restored
    console.log('Syncing location data...');
    
    // Send message to client to process queue
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_LOCATIONS'
      });
    });
    
    return Promise.resolve();
  } catch (error) {
    console.error('Sync failed:', error);
    return Promise.reject(error);
  }
}

// Function for periodic location updates (limited support)
async function periodicLocationUpdate() {
  try {
    console.log('Periodic location update triggered');
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'PERIODIC_UPDATE'
      });
    });
    
    return Promise.resolve();
  } catch (error) {
    console.error('Periodic update failed:', error);
    return Promise.reject(error);
  }
}

// Push notification (untuk notifikasi tracking)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'GPS Tracking Active',
    icon: './icon-192.png',
    badge: './badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'gps-tracking',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('GPS Tracker', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('./tracker.html')
  );
});

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'START_TRACKING') {
    console.log('Tracking started from client');
  }
  
  if (event.data && event.data.type === 'STOP_TRACKING') {
    console.log('Tracking stopped from client');
  }
});