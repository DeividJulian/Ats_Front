/** Name of the cache where the Service Worker keeps backend answers (same as API_CACHE in public/sw.js). */
export const API_CACHE = 'ats-api-v1';

/** Deletes the saved backend data, so the next person using this browser can't see it offline. */
export async function clearApiCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(API_CACHE);
  } catch {
    // Without access to the cache there is nothing to clear
  }
}
