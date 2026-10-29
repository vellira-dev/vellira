import { describe, expect, it } from 'vitest';
import {
  canSubmitProjectEditor,
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

describe('Native Starter project editor submission', () => {
  const project = {
    name: 'Mobile onboarding',
    description: 'Bring the first-run experience to native.',
    team: 'mobile',
    status: 'planned',
  };

  it('disables Create when the required name is blank or whitespace', () => {
    expect(canSubmitProjectEditor({ ...project, name: '' })).toBe(false);
    expect(canSubmitProjectEditor({ ...project, name: '  ' })).toBe(false);
    expect(canSubmitProjectEditor({ ...project, name: ' New project ' })).toBe(
      true
    );
  });

  it('keeps Description optional and requires valid Team and Status', () => {
    expect(canSubmitProjectEditor({ ...project, description: '' })).toBe(true);
    expect(canSubmitProjectEditor({ ...project, team: '' })).toBe(false);
    expect(canSubmitProjectEditor({ ...project, status: '' })).toBe(false);
    expect(canSubmitProjectEditor({ ...project, team: 'other' })).toBe(false);
  });

  it('disables Save for unchanged or whitespace-only edits', () => {
    expect(canSubmitProjectEditor(project, project)).toBe(false);
    expect(
      canSubmitProjectEditor(
        { ...project, name: ' Mobile onboarding  ' },
        project
      )
    ).toBe(false);
    expect(canSubmitProjectEditor(project, null)).toBe(false);
  });

  it('enables Save for meaningful changes to any field', () => {
    expect(
      canSubmitProjectEditor({ ...project, name: 'Updated onboarding' }, project)
    ).toBe(true);
    expect(
      canSubmitProjectEditor({ ...project, description: 'Updated' }, project)
    ).toBe(true);
    expect(canSubmitProjectEditor({ ...project, team: 'design' }, project)).toBe(
      true
    );
    expect(canSubmitProjectEditor({ ...project, status: 'active' }, project)).toBe(
      true
    );
  });

  it('keeps Save disabled when the name becomes invalid despite other edits', () => {
    expect(
      canSubmitProjectEditor({ ...project, name: ' ', status: 'active' }, project)
    ).toBe(false);
  });
});
