// src/lib/cache.ts
// In-memory cache using globalThis to handle Next.js hot-reloads during development
// For serverless environments like Vercel, this cache may clear frequently.

type CacheItem<T> = {
  data: T;
  expiry: number;
};

const GLOBAL_CACHE_KEY = 'ANTIGRAVITY_GAME_CACHE';

interface GlobalWithCache extends globalThis.Global {
  [GLOBAL_CACHE_KEY]?: Map<string, CacheItem<any>>;
}

const g = global as unknown as GlobalWithCache;

if (!g[GLOBAL_CACHE_KEY]) {
  g[GLOBAL_CACHE_KEY] = new Map<string, CacheItem<any>>();
}

const cache = g[GLOBAL_CACHE_KEY]!;

export function getCache<T>(key: string): T | null {
  const item = cache.get(key) as CacheItem<T> | undefined;
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  
  return item.data;
}

export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

export function invalidateCache(key: string): void {
  cache.delete(key);
}

export function clearCache(): void {
  cache.clear();
}
