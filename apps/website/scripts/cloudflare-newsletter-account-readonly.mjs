import { pathToFileURL } from 'node:url';

const API_ORIGIN = 'https://api.cloudflare.com';
const API_ROOT = '/client/v4';
const ACCOUNT_ID = /^[a-f0-9]{32}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const OWNER = 'vellira-newsletter-budget-owner';
const COORDINATOR = 'NewsletterRollingBudgetCoordinator';
const WORKERS = ['vellira-website-staging', 'vellira-website', OWNER];
const DOMAINS = ['vellira.dev', 'www.vellira.dev'];
const PHASES = ['http_request_firewall_custom', 'http_ratelimit'];
const MAX_NAMESPACE_PAGES = 3;
const PAGE_SIZE = 100;
const MAX_VERSION_READS = 4;

function unavailable(response) {
  if (response?.status === 403) return 'permission_denied';
  if (response?.status === 401) return 'authentication_denied';
  if (response?.status === 404) return 'not_found';
  if (response?.status === 429) return 'rate_limited';
  return 'unavailable';
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function budgetBindingPresent(bindings) {
  if (Array.isArray(bindings)) {
    return bindings.some((binding) => isObject(binding) && binding.name === 'NEWSLETTER_GLOBAL_BUDGET');
  }
  if (!isObject(bindings)) return null;
  return (
    Object.hasOwn(bindings, 'NEWSLETTER_GLOBAL_BUDGET') ||
    Object.values(bindings).some(
      (binding) => isObject(binding) && binding.name === 'NEWSLETTER_GLOBAL_BUDGET'
    )
  );
}

function pageStatus(payload, count, page, maximum) {
  const info = payload.result_info;
  if (info !== undefined && (!isObject(info) || (
    info.total_pages !== undefined &&
    (!Number.isSafeInteger(info.total_pages) || info.total_pages < page)
  ))) return { status: 'incomplete' };
  const total = info?.total_pages;
  if (total !== undefined) {
    if (total > maximum) return { status: 'incomplete' };
    return { status: page >= total ? 'complete' : 'next' };
  }
  if (count < PAGE_SIZE) return { status: 'complete' };
  return { status: 'incomplete' };
}

export async function auditCloudflareNewsletterAccount({
  accountId,
  apiToken,
  fetcher = fetch,
} = {}) {
  if (!ACCOUNT_ID.test(accountId ?? '') || typeof apiToken !== 'string' || !apiToken.trim()) {
    throw new Error('Configured Cloudflare account ID and API token are required');
  }

  let calls = 0;
  async function get(path) {
    const url = new URL(API_ROOT + path, API_ORIGIN);
    if (
      url.origin !== API_ORIGIN ||
      !url.pathname.startsWith(API_ROOT + '/') ||
      url.username ||
      url.password
    ) throw new Error('Unexpected Cloudflare API destination');
    calls += 1;
    let response;
    try {
      response = await fetcher(url, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + apiToken.trim(),
          Accept: 'application/json',
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return { status: 'unavailable' };
    }
    if (response?.status !== 200) return { status: unavailable(response) };
    try {
      const payload = await response.json();
      if (!isObject(payload) || payload.success !== true || !Object.hasOwn(payload, 'result')) {
        return { status: 'incomplete' };
      }
      return { status: 'available', payload };
    } catch {
      return { status: 'incomplete' };
    }
  }

  const root = '/accounts/' + accountId;
  const workersReply = await get(root + '/workers/scripts');
  const workerPresence = Object.fromEntries(WORKERS.map((name) => [name, 'unverified']));
  let workerInventoryStatus = workersReply.status;
  if (workersReply.status === 'available') {
    const workers = workersReply.payload.result;
    if (Array.isArray(workers) && workers.every((worker) => isObject(worker) && typeof worker.id === 'string')) {
      const page = pageStatus(workersReply.payload, workers.length, 1, 1);
      workerInventoryStatus = page.status === 'complete' ? 'complete' : 'incomplete';
      if (workerInventoryStatus === 'complete') {
        for (const name of WORKERS) {
          workerPresence[name] = workers.some((worker) => worker.id === name) ? 'present' : 'absent';
        }
      }
    } else workerInventoryStatus = 'incomplete';
  }

  let namespaceInventoryStatus = 'unverified';
  let coordinatorNamespaces = null;
  const collected = [];
  for (let page = 1; page <= MAX_NAMESPACE_PAGES; page += 1) {
    const reply = await get(root + '/workers/durable_objects/namespaces?page=' +
      String(page) + '&per_page=' + String(PAGE_SIZE));
    if (reply.status !== 'available') {
      namespaceInventoryStatus = reply.status;
      break;
    }
    const items = reply.payload.result;
    if (!Array.isArray(items) || !items.every(isObject)) {
      namespaceInventoryStatus = 'incomplete';
      break;
    }
    collected.push(...items);
    const pagination = pageStatus(reply.payload, items.length, page, MAX_NAMESPACE_PAGES);
    namespaceInventoryStatus = pagination.status;
    if (pagination.status !== 'next') break;
  }
  if (namespaceInventoryStatus === 'next') namespaceInventoryStatus = 'incomplete';
  if (namespaceInventoryStatus === 'complete') {
    // Only names/class labels are inspected; DO IDs and object state are never exported.
    coordinatorNamespaces = collected.filter((item) =>
      item.name === COORDINATOR || item.class === COORDINATOR
    ).length;
  }

  const workerDev = {};
  for (const name of WORKERS) {
    if (workerPresence[name] !== 'present') {
      workerDev[name] = { status: workerPresence[name] === 'absent' ? 'not_deployed' : 'unverified' };
      continue;
    }
    const reply = await get(root + '/workers/scripts/' + name + '/subdomain');
    if (reply.status !== 'available') {
      workerDev[name] = { status: reply.status };
      continue;
    }
    const value = reply.payload.result;
    workerDev[name] = isObject(value) && typeof value.enabled === 'boolean'
      ? { status: 'observed', enabled: value.enabled }
      : { status: 'incomplete' };
  }

  // Inspect each traffic-serving version, not the latest-uploaded version.
  // Only the presence of a specific DO binding name is reported; never values.
  const liveBinding = {};
  for (const name of WORKERS.slice(0, 2)) {
    if (workerPresence[name] !== 'present') {
      liveBinding[name] = { status: 'unverified' };
      continue;
    }
    const reply = await get(root + '/workers/scripts/' + name + '/deployments');
    if (reply.status !== 'available') {
      liveBinding[name] = { status: reply.status };
      continue;
    }
    const deployments = reply.payload.result?.deployments;
    const versions = deployments?.[0]?.versions;
    if (
      !Array.isArray(deployments) || !Array.isArray(versions) ||
      versions.length < 1 || versions.length > MAX_VERSION_READS ||
      !versions.every((v) => isObject(v) && UUID.test(v.version_id ?? '') &&
        typeof v.percentage === 'number' && v.percentage > 0)
    ) {
      liveBinding[name] = { status: 'incomplete' };
      continue;
    }
    let seen = false;
    let complete = true;
    for (const v of versions) {
      const detail = await get(root + '/workers/scripts/' + name + '/versions/' + v.version_id);
      if (detail.status !== 'available') {
        complete = false;
        break;
      }
      const found = budgetBindingPresent(detail.payload.result?.resources?.bindings);
      if (found === null) {
        complete = false;
        break;
      }
      seen ||= found;
    }
    liveBinding[name] = complete
      ? { status: 'observed', globalBudgetBindingInServingVersions: seen }
      : { status: 'incomplete' };
  }

  const domainReply = await get(root + '/workers/domains');
  let domainInventoryStatus = domainReply.status;
  const domains = Object.fromEntries(DOMAINS.map((host) => [host, { status: 'unverified' }]));
  if (domainReply.status === 'available') {
    const items = domainReply.payload.result;
    if (Array.isArray(items) && items.every(isObject)) {
      domainInventoryStatus = pageStatus(domainReply.payload, items.length, 1, 1).status;
      if (domainInventoryStatus === 'complete') {
        for (const host of DOMAINS) {
          const matches = items.filter((item) => item.hostname === host);
          domains[host] = matches.length === 1 &&
            typeof matches[0].enabled === 'boolean'
            ? {
                status: 'observed',
                enabled: matches[0].enabled,
                expectedProductionWorker: matches[0].service === 'vellira-website',
              }
            : { status: matches.length === 0 ? 'absent' : 'incomplete' };
        }
      }
    } else domainInventoryStatus = 'incomplete';
  }

  const zonesReply = await get('/zones?name=vellira.dev&account.id=' + accountId);
  let zoneStatus = zonesReply.status;
  let zoneId;
  if (zonesReply.status === 'available') {
    const list = zonesReply.payload.result;
    if (
      Array.isArray(list) && list.length === 1 &&
      ACCOUNT_ID.test(list[0]?.id ?? '') &&
      list[0].name === 'vellira.dev' &&
      list[0].account?.id === accountId
    ) {
      zoneStatus = 'observed';
      zoneId = list[0].id;
    } else zoneStatus = 'incomplete';
  }

  let zoneRoutes = { status: zoneStatus === 'observed' ? 'unverified' : zoneStatus };
  if (zoneId) {
    const reply = await get('/zones/' + zoneId + '/workers/routes');
    if (reply.status !== 'available') zoneRoutes = { status: reply.status };
    else {
      const items = reply.payload.result;
      zoneRoutes = Array.isArray(items) && items.every(isObject) &&
        pageStatus(reply.payload, items.length, 1, 1).status === 'complete'
        ? {
            status: 'observed',
            hasNewsletterWebsiteRoute: items.some((item) =>
              item.script === 'vellira-website' && typeof item.pattern === 'string' &&
              /vellira\.dev/.test(item.pattern)
            ),
          }
        : { status: 'incomplete' };
    }
  }

  async function ruleset(scope, phase) {
    const reply = await get(scope + '/rulesets/phases/' + phase + '/entrypoint');
    if (reply.status === 'not_found') return { status: 'not_configured' };
    if (reply.status !== 'available') return { status: reply.status };
    const rules = reply.payload.result?.rules;
    return Array.isArray(rules)
      ? {
          status: 'observed',
          enabledRules: rules.filter((rule) => rule?.enabled !== false).length,
        }
      : { status: 'incomplete' };
  }

  const zoneWaf = {};
  const accountWaf = {};
  for (const phase of PHASES) {
    zoneWaf[phase] = zoneId
      ? await ruleset('/zones/' + zoneId, phase)
      : { status: 'unverified' };
    accountWaf[phase] = await ruleset(root, phase);
  }

  return {
    schemaVersion: 1,
    source: 'cloudflare-account-readonly-graphql-free',
    calls,
    workerInventoryStatus,
    workerPresence,
    namespaceInventoryStatus,
    coordinatorClassNamespaceCount: coordinatorNamespaces,
    workerDev,
    liveBinding,
    domainInventoryStatus,
    domains,
    zoneStatus,
    zoneRoutes,
    zoneWaf,
    accountWaf,
    // Matching names or WAF-rule counts never prove effective URL/path coverage.
    sharedNamespaceIdentity: 'unverified',
    newsletterWafCoverage: 'unverified',
    buttondownQuota: 'unverified',
    remoteWrites: 0,
    providerWrites: 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await auditCloudflareNewsletterAccount({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    });
    console.log(JSON.stringify(report, null, 2));
  } catch {
    console.error('Cloudflare read-only infrastructure audit could not complete');
    process.exitCode = 1;
  }
}
