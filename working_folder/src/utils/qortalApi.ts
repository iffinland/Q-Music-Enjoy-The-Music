type SearchMode = 'ALL' | 'LATEST' | 'RANDOM' | string;

export interface SearchQdnResourcesParams {
  mode?: SearchMode;
  service: string;
  query?: string;
  name?: string;
  identifier?: string;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  includeMetadata?: boolean;
  includeStatus?: boolean;
  excludeBlocked?: boolean;
  namePrefix?: string;
  exactMatchNames?: boolean;
}

const assignIfDefined = <T extends Record<string, unknown>, K extends keyof any>(
  target: T,
  key: K,
  value: unknown,
) => {
  if (value === undefined || value === null) return;
  // @ts-expect-error - dynamic assignment
  target[key] = value;
};

// In-memory cache with TTL and in-flight de-duplication
type CacheKey = string;
interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}
const DEFAULT_TTL_MS = 60_000; // 60s
const cache = new Map<CacheKey, CacheEntry<any[]>>();
const inflight = new Map<CacheKey, Promise<any[]>>();

const stableKey = (payload: Record<string, unknown>): CacheKey => {
  // Only include stable primitives to form the cache key
  const ordered: Record<string, unknown> = {};
  Object.keys(payload)
    .sort()
    .forEach((k) => {
      const v = (payload as any)[k];
      if (v === undefined) return;
      // reduce objects/arrays to JSON
      if (typeof v === 'object' && v !== null) {
        ordered[k] = JSON.stringify(v);
      } else {
        ordered[k] = v;
      }
    });
  return JSON.stringify(ordered);
};

const getCached = (key: CacheKey): any[] | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const setCached = (key: CacheKey, value: any[], ttlMs = DEFAULT_TTL_MS) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

export const searchQdnResources = async (
  params: SearchQdnResourcesParams,
): Promise<any[]> => {
  const payload: Record<string, unknown> = {
    action: 'SEARCH_QDN_RESOURCES',
  };

  assignIfDefined(payload, 'mode', params.mode);
  assignIfDefined(payload, 'service', params.service);
  assignIfDefined(payload, 'query', params.query);
  assignIfDefined(payload, 'name', params.name);
  assignIfDefined(payload, 'identifier', params.identifier);
  assignIfDefined(payload, 'limit', params.limit);
  assignIfDefined(payload, 'offset', params.offset);
  assignIfDefined(payload, 'reverse', params.reverse);
  assignIfDefined(payload, 'includeMetadata', params.includeMetadata);
  assignIfDefined(payload, 'includeStatus', params.includeStatus);
  assignIfDefined(payload, 'excludeBlocked', params.excludeBlocked);
  assignIfDefined(payload, 'namePrefix', params.namePrefix);
  assignIfDefined(payload, 'exactMatchNames', params.exactMatchNames);

  const key = stableKey(payload);

  const cached = getCached(key);
  if (cached) {
    return cached;
  }

  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const result = await qortalRequest(payload as any);
    const arr = Array.isArray(result) ? result : [];
    setCached(key, arr);
    inflight.delete(key);
    return arr;
  })().catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
};

export interface FetchQdnResourceParams {
  name: string;
  service: string;
  identifier: string;
}

export const fetchQdnResource = async (params: FetchQdnResourceParams) => {
  const payload: Record<string, unknown> = {
    action: 'FETCH_QDN_RESOURCE',
    ...params,
  };
  // Cache fetch of playlist or other resources too (small TTL)
  const key = stableKey(payload);
  const cached = getCached(key);
  if (cached) {
    return cached;
  }
  const result = await qortalRequest(payload as any);
  const value = Array.isArray(result) ? result : result ? [result] : [];
  setCached(key, value, 30_000); // 30s TTL
  return result;
};

export const getNamesByAddress = async (address: string): Promise<string[]> => {
  const payload: Record<string, unknown> = {
    action: 'GET_ACCOUNT_NAMES',
    address,
  };
  const key = stableKey(payload);
  const cached = getCached(key);
  if (cached) {
    return cached as unknown as string[];
  }
  const names = await qortalRequest(payload as any);
  let normalized: string[] = [];
  if (Array.isArray(names)) {
    normalized = names
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }
        if (entry && typeof entry === 'object' && typeof (entry as any).name === 'string') {
          return ((entry as any).name as string).trim();
        }
        return null;
      })
      .filter((value): value is string => !!value && value.length > 0);
    normalized = Array.from(new Set(normalized));
  }
  setCached(key, normalized as unknown as any[]);
  return normalized;
};

// In-flight de-dupe and caching for GET_QDN_RESOURCE_URL specifically
const urlInflight = new Map<string, Promise<string | null>>();
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_TTL_MS = 5 * 60_000; // 5 minutes

export const getQdnResourceUrl = async (
  service: string,
  name: string,
  identifier: string,
): Promise<string | null> => {
  try {
    const key = `${service}:${name}:${identifier}`;
    const cached = urlCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.url;
    }
    const inflightExisting = urlInflight.get(key);
    if (inflightExisting) {
      return inflightExisting;
    }
    const p = (async () => {
      const result = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        service,
        name,
        identifier,
      });
      const url =
        typeof result === 'string' && result !== 'Resource does not exist'
          ? result
          : null;
      // Only cache successful resolutions so we keep retrying on null/404
      if (url) {
        urlCache.set(key, { url, expiresAt: Date.now() + URL_TTL_MS });
      } else {
        urlCache.delete(key);
      }
      urlInflight.delete(key);
      return url;
    })().catch((e) => {
      urlInflight.delete(key);
      throw e;
    });
    urlInflight.set(key, p);
    return p;
  } catch (error) {
    console.error('Failed to resolve QDN resource URL', error);
  }
  return null;
};

export interface HostedDataReference {
  name: string;
  service: string;
  identifier: string;
}

export const deleteHostedData = async (
  hostedData: HostedDataReference[],
): Promise<void> => {
  if (!Array.isArray(hostedData) || hostedData.length === 0) {
    return;
  }

  await qortalRequest({
    action: 'DELETE_HOSTED_DATA',
    hostedData,
  } as any);
};

const DELETE_RETRY_ATTEMPTS = 3;
const DELETE_RETRY_DELAY_MS = 750;
const DELETE_TIMEOUT_MS = 15_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveErrorMessage = (error: unknown): string => {
  if (!error) return '';
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return '';
  }
};

const isNotFoundError = (message: string) => /does not exist/i.test(message);
const isRetryableDeleteError = (message: string) =>
  /timed? ?out/i.test(message) || /temporarily unavailable/i.test(message) || /network/i.test(message);

const performDeleteRequest = async (
  reference: HostedDataReference,
  timeoutMs: number,
) => {
  const payload = {
    action: 'DELETE_QDN_RESOURCE',
    name: reference.name,
    service: reference.service,
    identifier: reference.identifier,
  } as any;

  if (typeof qortalRequestWithTimeout === 'function' && Number.isFinite(timeoutMs)) {
    return qortalRequestWithTimeout(payload, timeoutMs);
  }

  return qortalRequest(payload);
};

export const deleteQdnResource = async (
  reference: HostedDataReference,
  options?: { retries?: number; timeoutMs?: number; retryDelayMs?: number },
): Promise<void> => {
  const attempts = Math.max(1, options?.retries ?? DELETE_RETRY_ATTEMPTS);
  const timeoutMs = Math.max(1_000, options?.timeoutMs ?? DELETE_TIMEOUT_MS);
  const retryDelayMs = Math.max(0, options?.retryDelayMs ?? DELETE_RETRY_DELAY_MS);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await performDeleteRequest(reference, timeoutMs);
      return;
    } catch (error) {
      const message = resolveErrorMessage(error);
      if (isNotFoundError(message)) {
        return;
      }

      const shouldRetry = isRetryableDeleteError(message) && attempt < attempts - 1;
      if (!shouldRetry) {
        console.warn('Failed to delete QDN resource', reference, error);
        throw error instanceof Error ? error : new Error(message || 'Failed to delete resource');
      }

      await delay(retryDelayMs * (attempt + 1));
    }
  }
};

export const getQdnResourceStatus = async (
  reference: HostedDataReference,
): Promise<Record<string, unknown> | null> => {
  try {
    const result = await qortalRequest({
      action: 'GET_QDN_RESOURCE_STATUS',
      name: reference.name,
      service: reference.service,
      identifier: reference.identifier,
    } as any);
    if (result && typeof result === 'object') {
      return result as Record<string, unknown>;
    }
  } catch (error) {
    console.error('Failed to fetch QDN resource status', error);
  }
  return null;
};
