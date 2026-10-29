import {
  LIBRARY_KEY,
  LEGACY_KEY,
  normalizeLibrary,
  reduceLibrary,
} from "./model.js";
export const isExtension = !!globalThis.chrome?.runtime?.id;
const listeners = new Set();
let previewQueue = Promise.resolve();
export async function dispatch(action) {
  if (isExtension) {
    const response = await chrome.runtime.sendMessage({
      channel: "music-library",
      action,
    });
    if (response?.error || !response?.library)
      throw new Error(response?.error || "Reload the extension and try again.");
    return response.library;
  }
  previewQueue = previewQueue
    .catch(() => {})
    .then(() => {
      let library = normalizeLibrary(
        JSON.parse(localStorage.getItem(LIBRARY_KEY) || "null"),
        JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]"),
      );
      if (action) library = reduceLibrary(library, action);
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
      for (const listener of listeners) listener(library);
      return library;
    });
  return previewQueue;
}
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
if (isExtension)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[LIBRARY_KEY]?.newValue)
      for (const listener of listeners)
        listener(normalizeLibrary(changes[LIBRARY_KEY].newValue));
  });
else
  globalThis.addEventListener?.("storage", (event) => {
    if (event.key === LIBRARY_KEY && event.newValue)
      for (const listener of listeners)
        listener(normalizeLibrary(JSON.parse(event.newValue)));
  });
let database;
function openDatabase() {
  return (database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("music-library-audio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = null;
      reject(new Error("Local audio storage is unavailable."));
    };
  }));
}
export async function fileStore(method, id, file) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      "files",
      method === "get" ? "readonly" : "readwrite",
    );
    const store = transaction.objectStore("files");
    const request = method === "put" ? store.put(file, id) : store[method](id);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = transaction.onabort = () =>
      reject(
        new Error(
          "Could not access local audio. Your device may be out of storage.",
        ),
      );
  });
}
