import { SearchQdnResourcesParams, searchQdnResources } from '../utils/qortalApi';

type CacheEntry<T> = {
  timestamp: number;
  promise: Promise<T>;
};

const DEFAULT_TTL = 60_000; // 60 seconds
const searchCache = new Map<string, CacheEntry<any>>();

export interface CacheOptions {
  ttlMs?: number;
}

const buildKey = (params: SearchQdnResourcesParams) => JSON.stringify(params);

export const cachedSearchQdnResources = <T = any>(
  params: SearchQdnResourcesParams,
  options: CacheOptions = {},
): Promise<T> => {
  const ttl = typeof options.ttlMs === 'number' ? options.ttlMs : DEFAULT_TTL;
  const key = buildKey(params);
  const now = Date.now();
  const existing = searchCache.get(key);
  if (existing && now - existing.timestamp < ttl) {
    return existing.promise;
  }

  const promise = searchQdnResources(params) as Promise<T>;
  searchCache.set(key, { timestamp: now, promise });

  promise.catch(() => {
    const current = searchCache.get(key);
    if (current?.promise === promise) {
      searchCache.delete(key);
    }
  });

  return promise;
};

export const clearSearchCache = () => {
  searchCache.clear();
};
