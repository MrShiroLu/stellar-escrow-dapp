/**
 * Cache Service — localStorage-based caching with TTL
 */

const CACHE_PREFIX = 'stellar_escrow_';

/**
 * Set a value in cache with TTL
 * @param {string} key
 * @param {*} data
 * @param {number} ttlMs - time to live in milliseconds
 */
export function cacheSet(key, data, ttlMs = 30000) {
  try {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    console.warn('[Cache] Failed to set:', key, e);
  }
}

/**
 * Get a value from cache (returns null if expired or missing)
 * @param {string} key
 * @returns {*|null}
 */
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;

    if (age > entry.ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch (e) {
    console.warn('[Cache] Failed to get:', key, e);
    return null;
  }
}

/**
 * Invalidate a specific cache key
 * @param {string} key
 */
export function cacheInvalidate(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (e) {
    console.warn('[Cache] Failed to invalidate:', key, e);
  }
}

/**
 * Invalidate all cache entries
 */
export function cacheInvalidateAll() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('[Cache] Failed to invalidate all:', e);
  }
}

/**
 * Get cache entry age in seconds (for display)
 * @param {string} key
 * @returns {number|null}
 */
export function cacheAge(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return Math.floor((Date.now() - entry.timestamp) / 1000);
  } catch {
    return null;
  }
}
