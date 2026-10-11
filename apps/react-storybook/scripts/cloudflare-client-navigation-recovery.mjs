export function destinationEdgeFailures(failures, href) {
  const destinationPath = new URL(href, 'https://vellira.invalid').pathname;
  return failures.filter(
    (failure) =>
      new URL(failure.url, 'https://vellira.invalid').pathname ===
      destinationPath
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

// SiteHeader's compact breakpoint is 1280px, but the component drawer is
// available only through 1100px. At 1280px the portal's canonical global exit
// is its Next Link brand. Each route hop must use the caller's same-document,
// destination-specific recovery contract; opening a menu is preparation only.
export async function navigateToBlogAcrossSiteSurface({ page, navigate }) {
  const controls = () => ({
    primary: page
      .getByRole('navigation', { name: 'Primary navigation', exact: true })
      .getByRole('link', { name: 'Blog', exact: true }),
    mobile: page
      .getByRole('navigation', { name: 'Mobile navigation', exact: true })
      .getByRole('link', { name: 'Blog', exact: true }),
    marketing: page.getByRole('button', {
      name: 'Open navigation',
      exact: true,
    }),
    portal: page.getByRole('button', {
      name: 'Open component navigation',
      exact: true,
    }),
    brand: page.locator('header').getByRole('link', {
      name: 'Vellira',
      exact: true,
    }),
  });
  const inspect = async () => {
    const surface = controls();
    const visible = Object.fromEntries(
      await Promise.all(
        Object.entries(surface).map(async ([name, control]) => [
          name,
          await control.isVisible(),
        ])
      )
    );
    return { surface, visible };
  };
  const unavailable = (visible) =>
    new Error(
      `No visible client-navigation path to /blog at ${page.url()}; ` +
        `viewport=${JSON.stringify(page.viewportSize())}; surfaces=${JSON.stringify(visible)}`
    );
  const actionableLink = async (link, href) => {
    if ((await link.getAttribute('href')) !== href) {
      throw new Error(
        `Site navigation link must target ${href} at ${page.url()}`
      );
    }
    await link.click({ trial: true, timeout: 15_000 });
    return link;
  };

  const initial = await inspect();
  if (
    !initial.visible.primary &&
    !initial.visible.mobile &&
    !initial.visible.marketing
  ) {
    if (
      !new URL(page.url()).pathname.startsWith('/components') ||
      !initial.visible.portal ||
      !initial.visible.brand
    )
      throw unavailable(initial.visible);

    let brand;
    await navigate({
      href: '/',
      title: /^Independent modules\.\s*One seamless system\.$/,
      stage: 'portal brand -> marketing home',
      prepareAttempt: async () => {
        const { surface, visible } = await inspect();
        if (!visible.brand) throw unavailable(visible);
        brand = await actionableLink(surface.brand, '/');
      },
      action: () => brand.click({ timeout: 15_000 }),
    });
  }

  let blog;
  await navigate({
    href: '/blog',
    title: 'Blog',
    stage: 'visible site navigation -> /blog',
    prepareAttempt: async () => {
      const { surface, visible } = await inspect();
      if (visible.primary) {
        blog = await actionableLink(surface.primary, '/blog');
        return;
      }
      if (!visible.mobile) {
        if (!visible.marketing) throw unavailable(visible);
        await surface.marketing.click({ timeout: 15_000 });
        await surface.mobile.waitFor({ state: 'visible', timeout: 15_000 });
      }
      blog = await actionableLink(surface.mobile, '/blog');
    },
    action: () => blog.click({ timeout: 15_000 }),
  });
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

export function isSafeClientNavigationReplay({
  baseUrl,
  startPath,
  currentUrl,
  expectedDocumentToken,
  currentDocumentToken,
  expectedDocumentIdentity,
  currentDocumentIdentity,
  edgeRecovered,
}) {
  if (!edgeRecovered || !baseUrl || !startPath) return false;

  const base = new URL(baseUrl);
  const current = new URL(currentUrl, base);
  const expectedStart = new URL(startPath, base);
  const routeStayedPut =
    current.origin === base.origin &&
    expectedStart.origin === base.origin &&
    current.pathname === expectedStart.pathname;

  if (!routeStayedPut) return false;

  const identityProofAvailable =
    expectedDocumentIdentity?.available === true &&
    currentDocumentIdentity?.available === true &&
    Boolean(expectedDocumentIdentity.loaderId) &&
    Boolean(currentDocumentIdentity.loaderId);

  if (identityProofAvailable) {
    return (
      expectedDocumentIdentity.loaderId === currentDocumentIdentity.loaderId &&
      expectedDocumentIdentity.generation === currentDocumentIdentity.generation
    );
  }

  return (
    Boolean(expectedDocumentToken) &&
    currentDocumentToken === expectedDocumentToken
  );
}
