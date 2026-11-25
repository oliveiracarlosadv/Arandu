// IndexedDB mínimo e tipado (sem dependências). Tudo fica no próprio navegador.
// Stores:
//  - history: metadados dos documentos processados (conteúdo só se o usuário autorizar)
//  - workspace: documentos que o usuário adicionou explicitamente ao Workspace Jurídico
//  - cases: processos/clientes do Workspace

const DB_NAME = 'arandu';
const DB_VERSION = 1;

export type StoreName = 'history' | 'workspace' | 'cases';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      if (!db.objectStoreNames.contains('workspace')) db.createObjectStore('workspace', { keyPath: 'id' }).createIndex('caseId', 'caseId');
      if (!db.objectStoreNames.contains('cases')) db.createObjectStore('cases', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const r = fn(t.objectStore(store));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export const db = {
  put: <T>(store: StoreName, value: T) => tx(store, 'readwrite', (s) => s.put(value)),
  get: <T>(store: StoreName, id: string) => tx<T | undefined>(store, 'readonly', (s) => s.get(id)),
  all: <T>(store: StoreName) => tx<T[]>(store, 'readonly', (s) => s.getAll()),
  delete: (store: StoreName, id: string) => tx(store, 'readwrite', (s) => s.delete(id)),
  clear: (store: StoreName) => tx(store, 'readwrite', (s) => s.clear()),
};
