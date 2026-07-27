// Module-level in-memory cache. Client components sharing this module share
// this Map, so cached values survive route changes within the same browser
// session (but not a full page reload).
export const cache = {
  _store: new Map(),

  get(key) {
    const entry = this._store.get(key)
    if (!entry) return null
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key)
      return null
    }
    return entry.value
  },

  set(key, value, ttlMs = 30000) {
    this._store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    })
  },

  // Returns the value regardless of TTL, without evicting it — for
  // callers that always re-fetch fresh data anyway and just want an
  // instant placeholder no matter how old it is.
  peek(key) {
    const entry = this._store.get(key)
    return entry ? entry.value : null
  },

  invalidate(key) { this._store.delete(key) },

  invalidatePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) this._store.delete(key)
    }
  },
}
