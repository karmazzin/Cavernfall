(() => {
  const Game = window.MC2D;
  const records = new Map();
  const available = !!window.indexedDB;
  let database = null;
  let initialized = !available;
  let lastError = null;

  // localStorage remains readable for old saves. IndexedDB stores worlds that
  // no longer fit there; an in-memory index keeps the existing world menu fast.
  const ready = !available ? Promise.resolve(false) : new Promise(resolve => {
    function fail(error) {
      lastError = error || new Error('Хранилище миров недоступно.');
      initialized = true;
      resolve(false);
    }
    try {
      const request = window.indexedDB.open('cavernfall-worlds-v1', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('worlds', { keyPath: 'id' });
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('Закройте другую вкладку игры для доступа к сохранениям.'));
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('worlds', 'readonly');
        const read = transaction.objectStore('worlds').getAll();
        read.onsuccess = () => {
          for (const record of read.result) records.set(record.id, record);
        };
        transaction.oncomplete = () => {
          database = db;
          database.onversionchange = () => { database.close(); database = null; };
          initialized = true;
          resolve(true);
        };
        transaction.onerror = () => fail(transaction.error);
        transaction.onabort = () => fail(transaction.error);
      };
    } catch (error) { fail(error); }
  });

  async function write(record) {
    await ready;
    if (!database) throw lastError || new Error('Хранилище миров недоступно.');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('worlds', 'readwrite');
      transaction.objectStore('worlds').put(record);
      transaction.oncomplete = () => { records.set(record.id, record); resolve(true); };
      transaction.onabort = () => reject(transaction.error || new Error('Запись мира прервана.'));
      transaction.onerror = () => reject(transaction.error || new Error('Ошибка записи мира.'));
    });
  }

  async function remove(id) {
    await ready;
    if (!database) throw lastError || new Error('Хранилище миров недоступно.');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('worlds', 'readwrite');
      transaction.objectStore('worlds').delete(id);
      transaction.oncomplete = () => { records.delete(id); resolve(true); };
      transaction.onabort = () => reject(transaction.error || new Error('Удаление мира прервано.'));
      transaction.onerror = () => reject(transaction.error || new Error('Ошибка удаления мира.'));
    });
  }

  Game.worldStorage = {
    available, ready, get initialized() { return initialized; },
    get: id => records.get(id), list: () => [...records.values()].map(record => record.meta),
    write, remove,
  };
})();
