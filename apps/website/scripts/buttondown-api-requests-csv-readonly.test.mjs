import assert from 'node:assert/strict';
import test from 'node:test';

import {
  summarizeButtondownApiRequestsCsv,
} from './buttondown-api-requests-csv-readonly.mjs';

const now = new Date('2026-10-19T10:00:00.000Z');
const header = 'id,path,ip_address,creation_date,status_code,latency\n';

test('documented dashboard CSV format is read locally without exposing raw fields', () => {
  const csv = header + [
    'req_1,/v1/subscribers,198.51.100.9,2026-10-18 10:00:00.123456+00:00,201,0.1',
    'req_2,/v1/subscribers,198.51.100.10,2026-10-17 11:00:00+00:00,400,0.2',
    'req_3,/v1/emails,198.51.100.11,2026-10-18 11:00:00+00:00,200,0.1',
    'req_old,/v1/subscribers,198.51.100.12,2026-10-10 11:00:00+00:00,201,0.1',
  ].join('\n') + '\n';

  const report = summarizeButtondownApiRequestsCsv(csv, { now });
  assert.equal(report.scannedRows, 4);
  assert.equal(report.matchingRequests, 2);
  assert.equal(report.methodColumnPresent, false);
  assert.match(report.scope, /NOT proven subscriber-create attempts/);
  assert.deepEqual(report.byUtcDay, {
    '2026-10-17': 1,
    '2026-10-18': 1,
  });
  assert.equal(report.byStatus.success2xx, 1);
  assert.equal(report.byStatus.http400, 1);
  assert.equal(report.actualDailyQuota, 'unverified');
  assert.equal(report.completenessOfProviderHistory, 'unverified');
  assert.equal(report.subscriberWrites, 0);
  assert.equal(report.rawRowsExported, 0);
  const output = JSON.stringify(report);
  for (const raw of ['req_1', '198.51.100.9', '198.51.100.10']) {
    assert.equal(output.includes(raw), false);
  }
});

test('when the CSV provides method, only POST on the exact path is counted', () => {
  const csv = [
    'path,method,creation_date,status_code,subscriber_email',
    '/v1/subscribers,GET,2026-10-18T13:00:00+00:00,200,private@example.com',
    '/v1/subscribers,POST,2026-10-18T14:00:00+00:00,201,private@example.com',
    '/v1/subscribers?user=private@example.com,POST,2026-10-18T15:00:00+00:00,201,private@example.com',
  ].join('\n');
  const report = summarizeButtondownApiRequestsCsv(csv, { now });
  assert.equal(report.methodColumnPresent, true);
  assert.equal(report.scope, 'POST /v1/subscribers');
  assert.equal(report.matchingRequests, 1);
  assert.equal(JSON.stringify(report).includes('private@example.com'), false);
});

test('CSV supports BOM, CRLF, escaped quotes, quoted multiline cells and UTC offsets', () => {
  const csv =
    '\uFEFFid,path,ip_address,creation_date,status_code,latency\r\n' +
    '"request ""private""","/v1/subscribers","line 1\r\nline 2",2026-10-19T01:30:00+02:00,429,0.3\r\n';
  const report = summarizeButtondownApiRequestsCsv(csv, { now });
  assert.equal(report.matchingRequests, 1);
  assert.deepEqual(report.byUtcDay, { '2026-10-18': 1 });
  assert.equal(report.byStatus.http429, 1);
  assert.equal(JSON.stringify(report).includes('line 1'), false);
});

test('CSV parser rejects ambiguous or corrupted records without printing them', () => {
  const invalid = [
    '',
    'id,path\n1,/v1/subscribers',
    'path,creation_date,status_code\n/v1/subscribers,2026-10-18T14:00:00,201',
    'path,creation_date,status_code\n/v1/subscribers,2026-10-18T14:00:00Z,secret',
    'path,creation_date,status_code\n/v1/subscribers,2026-10-18T14:00:00Z,201,extra',
    'path,path,creation_date,status_code\n/v1/subscribers,/v1/subscribers,2026-10-18T14:00:00Z,201',
    'path,creation_date,status_code\n"/v1/subscribers,2026-10-18T14:00:00Z,201',
    'path,creation_date,status_code\n/v1/subscribers,2026-10-18T14:00:00Z,201bad',
  ];
  for (const csv of invalid) {
    assert.throws(
      () => summarizeButtondownApiRequestsCsv(csv, { now }),
      (error) => {
        assert.equal(error.message, 'Unsupported or incomplete Buttondown API-requests CSV');
        assert.equal(error.message.includes('secret'), false);
        return true;
      }
    );
  }
});

test('CSV cannot claim daily quota or request completeness even when empty within window', () => {
  const csv = header +
    'old,/v1/subscribers,198.51.100.1,2026-01-01T10:00:00Z,201,0.1\n';
  const report = summarizeButtondownApiRequestsCsv(csv, { now });
  assert.equal(report.matchingRequests, 0);
  assert.equal(report.actualDailyQuota, 'unverified');
  assert.equal(report.resetRule, 'unverified');
  assert.equal(report.completenessOfProviderHistory, 'unverified');
});
