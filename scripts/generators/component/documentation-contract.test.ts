import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateApiDocs } from '../../generate-api-docs';
import { generateComponentDocs } from '../component-docs/generate-component-docs';
import { createComponentDocsContractFromPlan } from './docs';
import { checkComponentDocumentationContract } from './documentation-contract';
import { createComponentGenerationPlan } from './plan';

vi.mock('../../generate-api-docs', async () => {
  const actual = await vi.importActual<
    typeof import('../../generate-api-docs')
  >('../../generate-api-docs');
  return { ...actual, generateApiDocs: vi.fn() };
});

vi.mock('../component-docs/generate-component-docs', async () => {
  const actual = await vi.importActual<
    typeof import('../component-docs/generate-component-docs')
  >('../component-docs/generate-component-docs');
  return { ...actual, generateComponentDocs: vi.fn() };
});

afterEach(() => vi.clearAllMocks());

function plan() {
  return createComponentGenerationPlan({
    root: '/repo',
    options: {
      componentName: 'ContractProbe',
      platform: 'both',
      layer: 'components',
      category: 'utility',
      profile: 'base',
      capabilities: [],
      parts: [],
      force: false,
    },
  });
}

describe('component documentation contract check', () => {
  it('derives distinct platform-specific search descriptions', () => {
    const contract = createComponentDocsContractFromPlan(plan());
    const react = contract.platforms.react;
    const native = contract.platforms['react-native'];

    expect(react?.description).toContain('for React with');
    expect(native?.description).toContain('for React Native with');
    expect(react?.description).not.toBe(native?.description);
  });

  it('checks dynamic API sections and generated docs without writing them', async () => {
    vi.mocked(generateApiDocs).mockResolvedValue({
      status: 'up-to-date',
      changedFiles: [],
    });
    vi.mocked(generateComponentDocs).mockResolvedValue({
      status: 'up-to-date',
      changedFiles: [],
      checkedFiles: [
        'apps/docs/src/react/contract-probe.md',
        'apps/docs/src/react-native/contract-probe.md',
      ],
    });

    expect(await checkComponentDocumentationContract(plan())).toEqual([]);
    expect(generateApiDocs).toHaveBeenCalledWith(
      expect.objectContaining({ rootDir: '/repo', check: true, silent: true })
    );
    expect(generateComponentDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        root: '/repo',
        check: true,
        componentName: 'ContractProbe',
      })
    );
  });

  it('reports API drift and the dependent generated docs page for that platform', async () => {
    vi.mocked(generateApiDocs).mockResolvedValue({
      status: 'stale',
      changedFiles: ['packages/react/API.md'],
    });
    vi.mocked(generateComponentDocs).mockResolvedValue({
      status: 'up-to-date',
      changedFiles: [],
      checkedFiles: [],
    });

    expect(await checkComponentDocumentationContract(plan())).toEqual([
      '/repo/apps/docs/src/react/contract-probe.md',
      '/repo/packages/react/API.md',
    ]);
  });

  it('reports generated docs drift directly', async () => {
    vi.mocked(generateApiDocs).mockResolvedValue({
      status: 'up-to-date',
      changedFiles: [],
    });
    vi.mocked(generateComponentDocs).mockResolvedValue({
      status: 'stale',
      changedFiles: ['apps/docs/src/react-native/contract-probe.md'],
      checkedFiles: [],
    });

    expect(await checkComponentDocumentationContract(plan())).toEqual([
      '/repo/apps/docs/src/react-native/contract-probe.md',
    ]);
  });
});
