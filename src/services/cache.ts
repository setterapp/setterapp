/**
 * Cache Service
 * Manages client-side caching with TTL and automatic invalidation
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

const CACHE_PREFIX = 'setterapp_cache_'
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutos por defecto

export const cacheService = {
  /**
   * Get cached data if it exists and is still valid
   */
  get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`)
      if (!cached) return null

      const entry: CacheEntry<T> = JSON.parse(cached)
      const now = Date.now()

      // Check if cache is still valid
      if (now - entry.timestamp > entry.ttl) {
        // Cache expired, remove it
        this.remove(key)
        return null
      }

      return entry.data
    } catch (error) {
      console.error('Error reading from cache:', error)
      return null
    }
  },

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      }
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry))
    } catch (error) {
      console.error('Error writing to cache:', error)
      // If storage is full, try to clear old entries
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clear()
        // Retry once
        try {
          const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl,
          }
          localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry))
        } catch (retryError) {
          console.error('Error retrying cache write:', retryError)
        }
      }
    }
  },

  /**
   * Remove a specific cache entry
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`)
    } catch (error) {
      console.error('Error removing from cache:', error)
    }
  },

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  },

  /**
   * Clear expired cache entries
   */
  clearExpired(): void {
    try {
      const keys = Object.keys(localStorage)
      const now = Date.now()

      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          try {
            const cached = localStorage.getItem(key)
            if (cached) {
              const entry: CacheEntry<any> = JSON.parse(cached)
              if (now - entry.timestamp > entry.ttl) {
                localStorage.removeItem(key)
              }
            }
          } catch (error) {
            // If entry is corrupted, remove it
            localStorage.removeItem(key)
          }
        }
      })
    } catch (error) {
      console.error('Error clearing expired cache:', error)
    }
  },

  /**
   * Check if a cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null
  },
}

// Limpiar entradas expiradas al iniciar
if (typeof window !== 'undefined') {
  cacheService.clearExpired()

  // Limpiar entradas expiradas cada 10 minutos
  setInterval(() => {
    cacheService.clearExpired()
  }, 10 * 60 * 1000)
}
