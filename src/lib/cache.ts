interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as {
  __set360Cache?: Map<string, CacheEntry<unknown>>;
  __set360Inflight?: Map<string, Promise<unknown>>;
};

const store = (globalForCache.__set360Cache ??= new Map<string, CacheEntry<unknown>>());
const inflight = (globalForCache.__set360Inflight ??= new Map<string, Promise<unknown>>());

export async function getOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  forceRefresh = false
): Promise<T> {
  const now = Date.now();
  if (!forceRefresh) {
    const cached = store.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const existing = inflight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }
  }

  const promise = fetcher()
    .then((result) => {
      store.set(key, { value: result, expiresAt: Date.now() + ttlMs });
      inflight.delete(key);
      return result;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function clearCachePrefix(prefix?: string): number {
  let removed = 0;
  if (!prefix) {
    removed = store.size;
    store.clear();
    return removed;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed++;
    }
  }
  return removed;
}
