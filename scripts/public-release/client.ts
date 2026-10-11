export const PUBLIC_RELEASE_API_URL = 'https://vellira.dev/api/public-release';
export const PUBLIC_RELEASE_REFRESH_MS = 15 * 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const STORAGE_KEY = 'vellira-published-npm-release-v1';

export type PublishedRelease = {
  version: string;
  verifiedAt: string;
  stale: boolean;
};

type VersionStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type BrowserApi = {
  window?: {
    localStorage?: VersionStorage;
    setInterval(callback: () => void, ms: number): number;
    clearInterval(timer: number): void;
  };
  document?: {
    visibilityState: string;
    addEventListener(event: string, callback: () => void): void;
    removeEventListener(event: string, callback: () => void): void;
  };
};

function getBrowserApi(): BrowserApi {
  return globalThis as unknown as BrowserApi;
}

type ReadReleaseOptions = {
  url?: string;
  fetchImpl?: typeof fetch;
  storage?: VersionStorage | null;
  now?: () => number;
};

function availableStorage(): VersionStorage | null {
  try {
    return getBrowserApi().window?.localStorage ?? null;
  } catch {
    return null;
  }
}

function validateRelease(value: unknown, now: number): PublishedRelease | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = value as Record<string, unknown>;
  if (
    entry.schemaVersion !== 1 ||
    entry.source !== 'npm-dist-tags' ||
    typeof entry.version !== 'string' ||
    !VERSION_PATTERN.test(entry.version) ||
    typeof entry.verifiedAt !== 'string' ||
    typeof entry.stale !== 'boolean' ||
    !Array.isArray(entry.packages) ||
    entry.packages.length !== 6 ||
    new Set(entry.packages).size !== 6
  ) {
    return null;
  }

  const verified = Date.parse(entry.verifiedAt);
  if (
    !Number.isFinite(verified) ||
    verified > now + 60_000 ||
    now - verified > MAX_STALE_MS
  ) {
    return null;
  }

  return {
    version: entry.version,
    verifiedAt: entry.verifiedAt,
    stale: entry.stale,
  };
}

export function parsePublicRelease(
  value: unknown,
  now = Date.now()
): PublishedRelease | null {
  return validateRelease(value, now);
}

export function readCachedPublicRelease(
  storage: VersionStorage | null = availableStorage(),
  now = Date.now()
): PublishedRelease | null {
  if (!storage) return null;
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    const parsed = validateRelease(value, now);
    return parsed ? { ...parsed, stale: true } : null;
  } catch {
    return null;
  }
}

export async function readPublicRelease({
  url = PUBLIC_RELEASE_API_URL,
  fetchImpl = fetch,
  storage = availableStorage(),
  now = Date.now,
}: ReadReleaseOptions = {}): Promise<PublishedRelease | null> {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      credentials: 'omit',
      mode: 'cors',
    });
    if (!response.ok) {
      return readCachedPublicRelease(storage, now());
    }

    const raw: unknown = await response.json();
    const verified = parsePublicRelease(raw, now());
    if (!verified) {
      return readCachedPublicRelease(storage, now());
    }

    if (!verified.stale && storage) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(raw));
      } catch {
        // Storage is optional. The current valid network result still wins.
      }
    }
    return verified;
  } catch {
    return readCachedPublicRelease(storage, now());
  }
}

export function observePublicRelease(
  onChange: (release: PublishedRelease | null) => void,
  { url = PUBLIC_RELEASE_API_URL }: Pick<ReadReleaseOptions, 'url'> = {}
): () => void {
  const browser = getBrowserApi();
  if (!browser.window || !browser.document) return () => {};

  const browserWindow = browser.window;
  const browserDocument = browser.document;
  let active = true;
  let lastRequestAt = 0;
  const cached = readCachedPublicRelease();
  if (cached) onChange(cached);

  const refresh = async () => {
    lastRequestAt = Date.now();
    const release = await readPublicRelease({ url });
    if (active) onChange(release);
  };

  const onVisibility = () => {
    if (
      browserDocument.visibilityState === 'visible' &&
      Date.now() - lastRequestAt >= PUBLIC_RELEASE_REFRESH_MS
    ) {
      void refresh();
    }
  };

  void refresh();
  const timer = browserWindow.setInterval(
    () => void refresh(),
    PUBLIC_RELEASE_REFRESH_MS
  );
  browserDocument.addEventListener('visibilitychange', onVisibility);

  return () => {
    active = false;
    browserWindow.clearInterval(timer);
    browserDocument.removeEventListener('visibilitychange', onVisibility);
  };
}
