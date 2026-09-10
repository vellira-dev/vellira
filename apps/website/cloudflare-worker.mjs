// OpenNext generates the handler. The deployment gate writes the build seal
// only after immutable archive verification; an unprepared build cannot bundle.
import handler from './.open-next/worker.js';
import build from './.open-next/vellira-build.json' with { type: 'json' };
import { createWebsiteWorker } from './cloudflare/cache-policy.mjs';

export default createWebsiteWorker(handler, build.buildId);
