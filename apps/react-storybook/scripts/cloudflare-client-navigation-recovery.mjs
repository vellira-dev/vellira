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
