'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFetch } from 'next/dist/client/components/router-reducer/fetch-server-response';
export default function Navigation() {
  const [lazy, setLazy] = useState('not-loaded');
  const [later, setLater] = useState('not-loaded');
  const router = useRouter();
  useEffect(() => {
    // Test-only access to the real bundled transport. No fetch interception,
    // protocol replacement or hand-written RequestInit stands in for Next.
    window.__migrationTransport = async (pathname, headers = { RSC: '1' }) => {
      const response = await createFetch(
        new URL(pathname, location.origin),
        headers,
        'auto',
        false
      );
      return {
        body: await new Response(response.body).text(),
        headers: Object.fromEntries(response.headers),
        status: response.status,
      };
    };
  }, []);
  return (
    <nav>
      <p id='client-generation'>Client __GENERATION__</p>
      <Link id='prefetched' href='/target/prefetched' prefetch={true}>
        Prefetched
      </Link>
      <Link id='fresh' href='/target/fresh' prefetch={false}>
        Fresh
      </Link>
      <Link id='expired' href='/target/expired' prefetch={true}>
        Expired
      </Link>
      <Link id='home' href='/' prefetch={false}>
        Home
      </Link>
      <button
        id='lazy'
        onClick={async () => setLazy((await import('./lazy')).value)}
      >
        Load lazy
      </button>
      <p id='lazy-result'>{lazy}</p>
      <button
        id='lazy-later'
        onClick={async () => setLater((await import('./lazy-later')).value)}
      >
        Load later lazy
      </button>
      <p id='later-result'>{later}</p>
      <button id='refresh' onClick={() => router.refresh()}>
        Refresh router
      </button>
    </nav>
  );
}
