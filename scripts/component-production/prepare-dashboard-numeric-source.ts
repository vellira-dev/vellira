/**
 * Non-authorizing generation of a proposed Dashboard numeric source/evidence pair.
 * Deliberately synthetic content. No Grammar, Chart, Factory or provider permission.
 */
import { parseComponentProductionInput } from './contracts';
import { compileComponentProgram } from '../component-program/compile';
import { componentProgramSource } from '../component-program/source';
import { prepareNumericBindingAuthorityV1 } from '../component-program/numeric-binding-authority';
import { fingerprintNumericSeriesBindingV1 } from '../component-program/numeric-series-fingerprint';
import { resolveNumericBindingReceiptsV1 } from '../component-program/numeric-binding-receipt-resolver';

const name = 'DashboardNumericSourceProbe';
const base = {
  schemaVersion: '1',
  componentName: name,
  platform: 'web',
  layer: 'components',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  semanticCapabilities: ['accessible-name'],
  parts: [],
  componentTokens: 'standard',
  componentProgram: {
    schemaVersion: '1',
    anatomy: [{ id: 'Root', role: 'root', parent: null }],
    states: [],
    transitions: [],
    modules: [
      { id: 'accessible-name', platforms: ['react'], bindings: {} },
    ],
  },
};
const parsed = parseComponentProductionInput(base);
const baseline = compileComponentProgram(
  componentProgramSource(parsed),
  parsed.componentProgram
);
if (baseline.disposition !== 'compiled' || !baseline.fingerprint) {
  throw new Error('Dashboard numeric-free baseline did not compile: ' + baseline.disposition);
}

const binding = {
  schemaVersion: '1',
  kind: 'bounded-numeric-series',
  data: {
    series: [{ id: 'sample-value', label: 'Synthetic sample value' }],
    rows: [
      { x: 0, xLabel: 'Example A', values: { 'sample-value': 2 } },
      { x: 1, xLabel: 'Example B', values: { 'sample-value': 4 } },
      { x: 2, xLabel: 'Example C', values: { 'sample-value': 3 } },
    ],
  },
};
const snapshot = fingerprintNumericSeriesBindingV1(binding);
if (!snapshot.ok) throw new Error('Numeric dataset validation rejected the synthetic fixture.');

const authority = prepareNumericBindingAuthorityV1(base, {
  schemaVersion: '1',
  ownerName: name,
  bindingId: 'sample-series',
  expectedProgramFingerprint: baseline.fingerprint,
  expectedBindingFingerprint: snapshot.fingerprint,
  binding,
});
if (!authority.ok) throw new Error('Numeric authority rejected source: ' + authority.code);

const source = {
  ...base,
  componentProgram: {
    ...base.componentProgram,
    numericBindingSlots: {
      schemaVersion: '1',
      baseProgramFingerprint: baseline.fingerprint,
      slots: [{
        id: 'sample-series',
        kind: 'bounded-numeric-series',
        platform: 'react',
        ownerRootId: authority.receipt.ownerRootId,
        bindingFingerprint: snapshot.fingerprint,
        authorityFingerprint: authority.receipt.authorityFingerprint,
      }],
    },
  },
};
const evidence = {
  schemaVersion: '1',
  entries: [{
    slotId: 'sample-series',
    binding,
    receipt: authority.receipt,
  }],
};
const result = resolveNumericBindingReceiptsV1(source, evidence);
if (!result.ok || result.grammarAdmitted !== false || result.resolved.length !== 1) {
  throw new Error('Independent Numeric Receipt Resolver rejected the proposed source.');
}
const blocked = compileComponentProgram(componentProgramSource(parseComponentProductionInput(source)), source.componentProgram);
if (blocked.disposition !== 'missing-grammar-capability' || blocked.program !== null) {
  throw new Error('Numeric Grammar must remain blocked.');
}
const encode = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8').toString('base64');
process.stdout.write('DASHBOARD_NUMERIC_SPEC_BASE64=' + encode(source) + '\n');
process.stdout.write('DASHBOARD_NUMERIC_EVIDENCE_BASE64=' + encode(evidence) + '\n');
process.stdout.write('DASHBOARD_NUMERIC_RESULT=content-only-review-required;grammar-admitted=false\n');
