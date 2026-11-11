// A tiny promise layer over IndexedDB: one database, one store, string keys.
const NAME = 'fair-weather';
const STORE = 'saves';

export interface Db {
  get(key: string): Promise<unknown>;
  /** Puts every entry in one transaction. */
  putAll(entries: [string, unknown][]): Promise<void>;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => {
      resolve(r.result);
    };
    r.onerror = () => {
      reject(r.error ?? new Error('IndexedDB request failed'));
    };
  });
}

/** Opens the database. Rejects when storage is blocked or the open throws. */
export function openDb(factory: IDBFactory): Promise<Db> {
  return new Promise((resolve, reject) => {
    let open: IDBOpenDBRequest;
    try {
      open = factory.open(NAME, 1);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE);
    };
    open.onerror = () => {
      reject(open.error ?? new Error('IndexedDB is blocked'));
    };
    open.onblocked = () => {
      reject(new Error('IndexedDB is blocked'));
    };
    open.onsuccess = () => {
      const db = open.result;
      resolve({
        get: (key) => request(db.transaction(STORE).objectStore(STORE).get(key)),
        putAll: (entries) =>
          new Promise((res, rej) => {
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            for (const [k, v] of entries) store.put(v, k);
            tx.oncomplete = () => {
              res();
            };
            tx.onerror = () => {
              rej(tx.error ?? new Error('IndexedDB write failed'));
            };
            tx.onabort = () => {
              rej(tx.error ?? new Error('IndexedDB write failed'));
            };
          }),
      });
    };
  });
}
