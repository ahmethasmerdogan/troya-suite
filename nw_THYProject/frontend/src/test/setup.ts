import "@testing-library/jest-dom/vitest";

// jsdom 29 localStorage sağlamıyor (opaque origin) — testler için minimal polyfill.
// Uygulama kodu gerçek tarayıcıda native localStorage kullanır; bu yalnızca test ortamı.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  const polyfill: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    key: (i) => [...store.keys()][i] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", { value: polyfill, configurable: true });
  if (typeof window !== "undefined") Object.defineProperty(window, "localStorage", { value: polyfill, configurable: true });
}
