/**
 * Public-facing proposed numeric obligations, NOT executable Component Grammar.
 *
 * Keep these declarations OUT of componentGrammarV1 and Component Intent until
 * separate implementation, independent proof, and compatibility review.
 * The default grammar fingerprint must remain unchanged for existing programs.
 * The exact wording is a candidate semantic contract, not a runtime validator.
 */
type ProposedNumericObligation = Readonly<{
  id: string;
  statement: string;
  dimension: 'behavior' | 'accessibility' | 'tests';
  evaluation: 'human-review';
  ruleId: null;
}>;

type ProposedNumericModule = Readonly<{
  id: 'bounded-numeric-series' | 'numeric-data-geometry';
  platforms: readonly ['react'];
  requires: readonly ('bounded-numeric-series' | 'numeric-data-geometry')[];
  obligations: readonly ProposedNumericObligation[];
}>;

const proof = (
  id: string,
  statement: string,
  dimension: ProposedNumericObligation['dimension'] = 'behavior'
): ProposedNumericObligation => ({
  id,
  statement,
  dimension,
  evaluation: 'human-review',
  ruleId: null,
});

export const proposedNumericGrammarModulesV1 = [
  {
    id: 'bounded-numeric-series',
    platforms: ['react'],
    requires: [],
    obligations: [
      proof(
        'bounded-finite-input',
        'Accept only finite, bounded, ordered numeric observations with explicit null gaps.'
      ),
      proof(
        'exact-series-alignment',
        'Declared series identities and each row of own value keys match exactly.'
      ),
      proof(
        'deterministic-domains',
        'Handle signed, zero-range, empty and single-row numeric domains truthfully.'
      ),
    ],
  },
  {
    id: 'numeric-data-geometry',
    platforms: ['react'],
    requires: ['bounded-numeric-series'],
    obligations: [
      proof(
        'irregular-x-scale',
        'Numeric x positions preserve irregular spacing rather than row index.'
      ),
      proof(
        'signed-y-scale',
        'Signed y mapping preserves negative values and axis direction.'
      ),
      proof(
        'truthful-ticks',
        'Finite axis ticks retain reviewed values and readable, noncolliding labels.'
      ),
      proof(
        'null-gap-segmentation',
        'A null observation interrupts its series path without inventing a connection.'
      ),
      proof(
        'stable-series-binding',
        'Each series retains its declared value, label and semantic style identity.'
      ),
      proof(
        'semantic-table-parity',
        'A discoverable native data table preserves every row, series and null marker.',
        'accessibility'
      ),
    ],
  },
] as const satisfies readonly ProposedNumericModule[];
