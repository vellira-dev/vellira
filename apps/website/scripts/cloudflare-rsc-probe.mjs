import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  setCacheBustingSearchParam,
} = require('next/dist/client/components/router-reducer/set-cache-busting-search-param.js');
const {
  RSC_HEADER,
  NEXT_ROUTER_PREFETCH_HEADER,
} = require('next/dist/client/components/app-router-headers.js');

export async function rscProbe(pathname, origin) {
  // Diagnostics use Next's installed URL builder and real prefetch headers.
  // No application URL/protocol changes. Bare RSC:1 is not a router request:
  // its empty checksum currently loops through OpenNext's query normalization.
  const headers = { [RSC_HEADER]: '1', [NEXT_ROUTER_PREFETCH_HEADER]: '1' };
  const url = new URL(pathname, origin);
  await setCacheBustingSearchParam(url, headers);
  return { url, headers };
}
