import { describe, expect, it } from 'vitest';
import {
  hasActiveProjectFilters,
  nextUniqueDuplicateName,
} from '../../examples/workspace-starter/native/projectUx';

describe('Native Starter project filter UX', () => {
  it('does not claim filters are active when search is collapsed', () => {
    expect(hasActiveProjectFilters(false, 'hidden query', 'all')).toBe(false);
    expect(hasActiveProjectFilters(false, '', 'all')).toBe(false);
  });

  it('announces an active status filter even when its controls are hidden', () => {
    expect(hasActiveProjectFilters(false, '', 'planned')).toBe(true);
    expect(hasActiveProjectFilters(true, '', 'shipped')).toBe(true);
  });

  it('announces a visible nonempty search as an active filter', () => {
    expect(hasActiveProjectFilters(true, '  ', 'all')).toBe(false);
    expect(hasActiveProjectFilters(true, ' mobile ', 'all')).toBe(true);
  });
});

describe('Native Starter duplicate names', () => {
  it('generates a readable first copy name', () => {
    expect(
      nextUniqueDuplicateName('Mobile onboarding', ['Mobile onboarding'])
    ).toBe('Mobile onboarding copy');
  });

  it('increments copy numbers instead of creating duplicate names', () => {
    const names = ['Mobile onboarding', 'Mobile onboarding copy'];
    expect(nextUniqueDuplicateName('Mobile onboarding', names)).toBe(
      'Mobile onboarding copy 2'
    );
    expect(nextUniqueDuplicateName('Mobile onboarding copy', names)).toBe(
      'Mobile onboarding copy 2'
    );
  });

  it('handles numbered copies and existing names case-insensitively', () => {
    const names = [
      'Design token refresh',
      'design token refresh COPY',
      'Design token refresh copy 2',
    ];
    expect(nextUniqueDuplicateName('Design token refresh copy 2', names)).toBe(
      'Design token refresh copy 3'
    );
  });

  it('uses the first free number after a missing previous copy', () => {
    expect(
      nextUniqueDuplicateName('Dashboard rollout', [
        'Dashboard rollout',
        'Dashboard rollout copy 2',
      ])
    ).toBe('Dashboard rollout copy');
  });

  it('normalizes legacy repeated-copy suffixes', () => {
    const existing = [
      'Mobile onboarding',
      'Mobile onboarding copy',
      'Mobile onboarding copy 2',
    ];
    expect(
      nextUniqueDuplicateName('Mobile onboarding copy copy', existing)
    ).toBe('Mobile onboarding copy 3');
  });

  it('trims saved names and handles empty legacy project titles', () => {
    expect(nextUniqueDuplicateName('  Demo  ', ['Demo', ' Demo COPY '])).toBe(
      'Demo copy 2'
    );
    expect(nextUniqueDuplicateName(' ', ['Untitled project'])).toBe(
      'Untitled project copy'
    );
  });
});
