// Browser storage is optional convenience, never application authority. Resolve
// the Storage getter inside the try: disabled storage can throw before getItem.
type BrowserStorage = 'localStorage' | 'sessionStorage';
export function readBrowserStorage(
  storage: BrowserStorage,
  key: string
): string | null {
  try {
    return window[storage].getItem(key);
  } catch {
    return null;
  }
}
export function writeBrowserStorage(
  storage: BrowserStorage,
  key: string,
  value: string
): void {
  try {
    window[storage].setItem(key, value);
  } catch {
    /* Convenience only. */
  }
}
export function removeBrowserStorage(
  storage: BrowserStorage,
  key: string
): void {
  try {
    window[storage].removeItem(key);
  } catch {
    /* Convenience only. */
  }
}
