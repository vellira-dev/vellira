import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';

import { ArrowRight } from '@vellira-ui/icons';

export default function NotFound() {
  return (
    <main className='not-found-page'>
      <section className='not-found-panel' aria-labelledby='not-found-title'>
        <span className='not-found-eyebrow'>404</span>

        <h1 id='not-found-title'>Page not found</h1>

        <p>
          The page may have moved, or the URL does not match a Vellira route.
        </p>

        <DesignSystemLink className='not-found-home-link' href='/' appearance='bare'>
          Back to home
          <ArrowRight size={16} aria-hidden='true' />
        </DesignSystemLink>
      </section>
    </main>
  );
}
