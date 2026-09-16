const siteDescription =
  'Production-ready React and React Native UI components, design tokens, theming, accessibility, and TypeScript support for modern applications.';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://vellira.dev/#organization',
      name: 'Vellira',
      url: 'https://vellira.dev',
      logo: {
        '@type': 'ImageObject',
        url: 'https://vellira.dev/brand/logos/logo-gradient.svg',
      },
      sameAs: ['https://github.com/vellira-dev'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://vellira.dev/#website',
      url: 'https://vellira.dev/',
      name: 'Vellira',
      alternateName: ['vellira.dev'],
      description: siteDescription,
      publisher: {
        '@id': 'https://vellira.dev/#organization',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://vellira.dev/#software',
      name: 'Vellira',
      url: 'https://vellira.dev',
      description: siteDescription,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cross-platform',
      programmingLanguage: ['TypeScript', 'JavaScript'],
      codeRepository: 'https://github.com/vellira-dev/vellira',
      license: 'https://opensource.org/license/mit',
      publisher: {
        '@id': 'https://vellira.dev/#organization',
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
      },
    },
  ],
};

export function JsonLd() {
  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      }}
    />
  );
}
