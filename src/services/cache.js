// كاش بسيط للبيانات النادرة التغير (الفصول، المواد، الإعدادات): ذاكرة + sessionStorage مع مدة صلاحية.
const memory = new Map();
const PREFIX = 'tng-cache:';

function readStored(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function cacheGet(key) {
  const now = Date.now();
  const hit = memory.get(key) ?? readStored(key);
  if (hit && hit.expires > now) {
    memory.set(key, hit);
    return hit.value;
  }
  memory.delete(key);
  return undefined;
}

export function cacheSet(key, value, ttlMs) {
  const entry = { value, expires: Date.now() + ttlMs };
  memory.set(key, entry);
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify(entry)); } catch { /* التخزين ممتلئ أو محظور */ }
  return value;
}

export function cacheInvalidate(key) {
  memory.delete(key);
  try { sessionStorage.removeItem(PREFIX + key); } catch { /* تجاهل */ }
}

const inflight = new Map();

export async function cached(key, ttlMs, loader) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const promise = Promise.resolve().then(loader).then(value => cacheSet(key, value, ttlMs)).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
