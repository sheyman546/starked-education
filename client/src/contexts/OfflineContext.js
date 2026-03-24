import React, { createContext, useContext, useState, useEffect } from 'react';

// Create context
const OfflineContext = createContext();

// IndexedDB helper functions
const initDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('StarkedEducationDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('content')) {
        const contentStore = db.createObjectStore('content', { keyPath: '_id' });
        contentStore.createIndex('course', 'course', { unique: false });
        contentStore.createIndex('type', 'type', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'id' });
        progressStore.createIndex('user', 'user', { unique: false });
        progressStore.createIndex('content', 'content', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('files')) {
        const filesStore = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        filesStore.createIndex('contentId', 'contentId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
        notesStore.createIndex('contentId', 'contentId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('bookmarks')) {
        const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true });
        bookmarksStore.createIndex('contentId', 'contentId', { unique: false });
      }
    };
  });
};

// Provider component
export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [db, setDb] = useState(null);
  const [cachedContent, setCachedContent] = useState([]);
  const [syncQueue, setSyncQueue] = useState([]);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 0 });

  // Initialize IndexedDB
  useEffect(() => {
    const initializeDB = async () => {
      try {
        const database = await initDB();
        setDb(database);
        
        // Load cached content
        const cached = await getCachedContent(database);
        setCachedContent(cached);
        
        // Calculate storage usage
        await calculateStorageUsage();
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
      }
    };
    
    initializeDB();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      syncOfflineData();
    }
  }, [isOnline, syncQueue]);

  // Calculate storage usage
  const calculateStorageUsage = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        setStorageUsage({
          used: estimate.usage || 0,
          total: estimate.quota || 0
        });
      } catch (error) {
        console.error('Failed to get storage estimate:', error);
      }
    }
  };

  // Get cached content from IndexedDB
  const getCachedContent = async (database) => {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['content'], 'readonly');
      const store = transaction.objectStore('content');
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  };

  // Cache content for offline access
  const cacheContent = async (content) => {
    if (!db) return false;
    
    try {
      const transaction = db.transaction(['content'], 'readwrite');
      const store = transaction.objectStore('content');
      
      // Store content metadata
      await new Promise((resolve, reject) => {
        const request = store.put(content);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
      
      // Cache files if available
      if (content.files && content.files.length > 0) {
        await cacheFiles(content._id, content.files);
      }
      
      // Update cached content state
      const updated = await getCachedContent(db);
      setCachedContent(updated);
      
      await calculateStorageUsage();
      
      return true;
    } catch (error) {
      console.error('Failed to cache content:', error);
      return false;
    }
  };

  // Cache files for offline access
  const cacheFiles = async (contentId, files) => {
    if (!db) return;
    
    try {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      for (const file of files) {
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          
          await new Promise((resolve, reject) => {
            const request = store.add({
              contentId,
              type: file.type,
              format: file.format,
              size: file.size,
              data: blob,
              url: file.url,
              cachedAt: new Date().toISOString()
            });
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
          });
        } catch (error) {
          console.error(`Failed to cache file ${file.url}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to cache files:', error);
    }
  };

  // Get cached file
  const getCachedFile = async (contentId, fileType) => {
    if (!db) return null;
    
    try {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('contentId');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(contentId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const files = request.result || [];
          const file = files.find(f => f.type === fileType);
          if (file && file.data) {
            // Create object URL from blob
            const url = URL.createObjectURL(file.data);
            resolve({ ...file, url });
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.error('Failed to get cached file:', error);
      return null;
    }
  };

  // Remove cached content
  const removeCachedContent = async (contentId) => {
    if (!db) return false;
    
    try {
      const transaction = db.transaction(['content', 'files'], 'readwrite');
      const contentStore = transaction.objectStore('content');
      const filesStore = transaction.objectStore('files');
      
      // Remove content
      await new Promise((resolve, reject) => {
        const request = contentStore.delete(contentId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
      
      // Remove associated files
      const filesIndex = filesStore.index('contentId');
      const files = await new Promise((resolve, reject) => {
        const request = filesIndex.getAll(contentId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      });
      
      for (const file of files) {
        await new Promise((resolve, reject) => {
          const request = filesStore.delete(file.id);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      }
      
      // Update cached content state
      const updated = await getCachedContent(db);
      setCachedContent(updated);
      
      await calculateStorageUsage();
      
      return true;
    } catch (error) {
      console.error('Failed to remove cached content:', error);
      return false;
    }
  };

  // Save progress offline
  const saveProgressOffline = async (contentId, progressData) => {
    if (!db) return false;
    
    try {
      const transaction = db.transaction(['progress'], 'readwrite');
      const store = transaction.objectStore('progress');
      
      await new Promise((resolve, reject) => {
        const request = store.put({
          id: `${contentId}_${progressData.user || 'anonymous'}`,
          contentId,
          user: progressData.user || 'anonymous',
          ...progressData,
          lastSynced: null,
          createdAt: new Date().toISOString()
        });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
      
      // Add to sync queue if online
      if (isOnline) {
        setSyncQueue(prev => [...prev, { type: 'progress', data: { contentId, ...progressData } }]);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save progress offline:', error);
      return false;
    }
  };

  // Save notes offline
  const saveNotesOffline = async (contentId, notes) => {
    if (!db) return false;
    
    try {
      const transaction = db.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      
      // Clear existing notes for this content
      const index = store.index('contentId');
      const existingNotes = await new Promise((resolve, reject) => {
        const request = index.getAll(contentId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      });
      
      for (const note of existingNotes) {
        await new Promise((resolve, reject) => {
          const request = store.delete(note.id);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      }
      
      // Add new notes
      for (const note of notes) {
        await new Promise((resolve, reject) => {
          const request = store.add({
            contentId,
            ...note,
            createdAt: new Date().toISOString()
          });
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      }
      
      // Add to sync queue if online
      if (isOnline) {
        setSyncQueue(prev => [...prev, { type: 'notes', data: { contentId, notes } }]);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save notes offline:', error);
      return false;
    }
  };

  // Sync offline data with server
  const syncOfflineData = async () => {
    if (!isOnline || syncQueue.length === 0) return;
    
    try {
      // Process sync queue
      for (const item of syncQueue) {
        try {
          // In a real implementation, this would make API calls to sync data
          console.log('Syncing item:', item);
          
          // Remove from queue after successful sync
          setSyncQueue(prev => prev.filter(i => i !== item));
        } catch (error) {
          console.error('Failed to sync item:', error);
        }
      }
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  };

  // Clear all cached data
  const clearCache = async () => {
    if (!db) return false;
    
    try {
      const stores = ['content', 'files', 'progress', 'notes', 'bookmarks'];
      
      for (const storeName of stores) {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(store);
        
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      }
      
      setCachedContent([]);
      setSyncQueue([]);
      await calculateStorageUsage();
      
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  };

  const value = {
    isOnline,
    cachedContent,
    syncQueue,
    storageUsage,
    cacheContent,
    removeCachedContent,
    getCachedFile,
    saveProgressOffline,
    saveNotesOffline,
    syncOfflineData,
    clearCache,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

// Hook to use offline context
export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

export default OfflineContext;
