export function destinationEdgeFailures(failures, href) {
  const destinationPath = new URL(href, 'https://vellira.invalid').pathname;
  return failures.filter(
    (failure) =>
      new URL(failure.url, 'https://vellira.invalid').pathname === destinationPath
  );
}

export async function runRecoverableClientNavigation({
  stage,
  maxAttempts,
  prepareAttempt,
  runAttempt,
  failureCursor,
  failuresSince,
  recoverFailures,
  beforeRetry,
}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await prepareAttempt(attempt);
    const cursor = failureCursor();

    try {
      return await runAttempt(attempt);
    } catch (error) {
      const failures = failuresSince(cursor);
      const recovered =
        attempt < maxAttempts &&
        failures.length > 0 &&
        (await recoverFailures(failures, stage));

      if (!recovered) throw error;
      await beforeRetry?.(attempt + 1);
    }
  }

  throw new Error(`Client navigation did not recover during ${stage}.`);
}


function normalizedHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase(),
      String(value),
    ])
  );
}

export function isRecoveredDocumentFallback({
  href,
  baseUrl,
  expectedBuildId,
  edgeRecovered,
  documentResponse,
  previousDocumentSequence,
}) {
  if (!edgeRecovered || !expectedBuildId || !documentResponse) return false;
  if (
    !Number.isInteger(previousDocumentSequence) ||
    !Number.isInteger(documentResponse.sequence) ||
    documentResponse.sequence <= previousDocumentSequence
  ) {
    return false;
  }

  const expected = new URL(href, baseUrl);
  const actual = new URL(documentResponse.url);
  const headers = normalizedHeaders(documentResponse.headers);

  return (
    actual.origin === new URL(baseUrl).origin &&
    actual.pathname === expected.pathname &&
    documentResponse.status === 200 &&
    headers['x-vellira-build-id'] === expectedBuildId &&
    Boolean(headers['x-vellira-worker-version']) &&
    Boolean(headers['x-vellira-request-id']) &&
    headers['cache-control'] === 'no-cache, max-age=0, must-revalidate' &&
    headers['cloudflare-cdn-cache-control'] === 'no-store' &&
    !headers['clear-site-data'] &&
    !headers['set-cookie'] &&
    !headers.location
  );
}
