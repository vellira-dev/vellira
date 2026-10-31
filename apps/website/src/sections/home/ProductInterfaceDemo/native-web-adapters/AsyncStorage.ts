// Browser-only adapter for the real Expo Starter's local sample state.
// This file is used by the website bundler; the Expo app keeps its native module.
const keyFor = (key: string) => 'vellira-native-showcase:' + key;

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(keyFor(key));
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(keyFor(key), value);
    } catch {
      // Browser preview stays functional when storage is unavailable.
    }
  },
};

export default AsyncStorage;
