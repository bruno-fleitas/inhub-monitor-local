/**
 * @fileoverview IndexedDB storage adapter.
 *
 * Infrastructure/adapter layer of the hexagonal architecture.
 * Provides a simple key-value cache backed by IndexedDB for persisting
 * processed datasets between sessions.
 *
 * Dependencies: none (uses global indexedDB).
 *
 * Exports: cacheSet, cacheGet
 */

const DB_NAME = 'inhub-monitor-local';
const DB_VERSION = 1;
const STORE = 'datasets';

/**
 * Open the IndexedDB database (creating it if needed).
 * @private
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Store a value in the cache under the given key.
 * @param {string} key - Cache key.
 * @param {*} value - Value to store (structured-cloneable).
 * @returns {Promise<void>}
 */
export async function cacheSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve a value from the cache by key.
 * @param {string} key - Cache key.
 * @returns {Promise<*>} The cached value or undefined.
 */
export async function cacheGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
