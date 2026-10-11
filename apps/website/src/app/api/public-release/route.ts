import { createPublicReleaseHandler } from '@/server/publicRelease';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = createPublicReleaseHandler();

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
}
