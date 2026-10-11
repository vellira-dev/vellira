import '@vellira-ui/assets/styles';
import '@vellira-ui/tokens/css';

import './manager.css';

import React from 'react';

import {
  observePublicRelease,
  type PublishedRelease,
} from '../../../scripts/public-release/client';

import { addons } from 'storybook/manager-api';
import { types } from 'storybook/manager-api';
import { create } from 'storybook/theming';

const theme = create({
  base: 'light',
  brandTitle: 'Vellira Storybook',
  brandImage: '/logo.svg',
  brandUrl: 'https://vellira.dev',
});

addons.setConfig({
  theme,
});

function PublishedReleaseTool() {
  const [release, setRelease] = React.useState<PublishedRelease | null>(null);

  React.useEffect(() => observePublicRelease(setRelease), []);

  if (!release) return null;

  const label = `${release.stale ? 'Last verified' : 'Latest verified'} npm release v${release.version}`;

  return React.createElement(
    'a',
    {
      className: 'velliraToolbarVersion',
      href: 'https://www.npmjs.com/package/@vellira-ui/react',
      target: '_blank',
      rel: 'noreferrer noopener',
      'aria-label': label,
      title: label,
    },
    React.createElement('span', null, 'npm'),
    React.createElement(
      'strong',
      { 'aria-live': 'polite' },
      `v${release.version}`
    )
  );
}

const toolbarLinks = [
  {
    id: 'documentation',
    label: 'Documentation',
    href: 'https://docs.vellira.dev',
    icon: '/brand/navigation/documentation.svg',
    iconSize: '17px',
  },
  {
    id: 'github',
    label: 'GitHub',
    href: 'https://github.com/vellira-dev/vellira',
    icon: '/brand/navigation/github.svg',
    iconSize: '16px',
  },
] as const;

addons.register('vellira/navigation-links', () => {
  addons.add('vellira/navigation-links/latest-npm-release', {
    title: 'Latest verified npm release',
    type: types.TOOLEXTRA,
    render: () => React.createElement(PublishedReleaseTool),
  });

  toolbarLinks.forEach((link) => {
    addons.add(`vellira/navigation-links/${link.id}`, {
      title: link.label,
      type: types.TOOLEXTRA,
      render: () =>
        React.createElement(
          'a',
          {
            className: 'velliraToolbarLink',
            href: link.href,
            rel: 'noreferrer noopener',
            target: '_blank',
            title: link.label,
          },
          React.createElement('span', {
            'aria-hidden': 'true',
            className: 'velliraToolbarIcon',
            style: {
              '--vellira-toolbar-icon': `url(${link.icon})`,
              '--vellira-toolbar-icon-size': link.iconSize,
            } as React.CSSProperties & {
              '--vellira-toolbar-icon': string;
              '--vellira-toolbar-icon-size': string;
            },
          }),
          React.createElement(
            'span',
            { className: 'velliraToolbarLabel' },
            link.label
          )
        ),
    });
  });
});
