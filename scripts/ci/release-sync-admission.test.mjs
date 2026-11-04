import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE_CHECKS, STARTER_CHECKS, classifyAdmission, assessCheckRuns }
  from './release-sync-admission.mjs';

const fileSet = [
  'package.json',
  ...['core','icons','react-native','react','tokens','types']
    .map(x => 'packages/' + x + '/package.json'),
  'examples/workspace-starter/README.md',
  ...['native','web'].flatMap(x => [
    'examples/workspace-starter/' + x + '/package.json',
    'examples/workspace-starter/' + x + '/package-lock.json'
  ])
];
const trusted = {
  title: 'chore(release): sync package versions',
  user: { login: 'vellira-release-sync[bot]' },
  head: { ref: 'chore/sync-release-2.190.12', sha: 'a'.repeat(40) },
  base: { ref: 'main', sha: 'b'.repeat(40) },
  draft: false
};
test('regular PR is cheap pass-through', () => {
  assert.deepEqual(classifyAdmission({...trusted, title: 'fix: docs',
    user:{login:'tester'}, head:{ref:'fix/docs'}}, ['README.md']),
    {kind:'other',checks:[]});
});
test('atomic release requires baseline plus Native/Starter proofs', () => {
  const got = classifyAdmission(trusted, fileSet);
  assert.equal(got.kind, 'release');
  assert.deepEqual(got.checks, [...BASELINE_CHECKS,...STARTER_CHECKS]);
});
test('seven manifest release path has no path-filtered Native requirement', () => {
  const got = classifyAdmission(trusted, fileSet.slice(0,7));
  assert.deepEqual(got.checks, BASELINE_CHECKS);
});
test('untrusted, draft, extra files and partial native are denied', () => {
  assert.throws(() => classifyAdmission({...trusted,user:{login:'attacker'}}, fileSet));
  assert.throws(() => classifyAdmission({...trusted,draft:true}, fileSet));
  assert.throws(() => classifyAdmission(trusted,[...fileSet,'.github/workflows/release.yml']));
  assert.throws(() => classifyAdmission(trusted,fileSet.filter(x => !x.includes('/web/'))));
});
test('starter candidate scope requires both starter manifests and integrity locks', () => {
  const p={...trusted,title:'chore(starter): sync Vellira to v2.190.12',
    head:{ref:'chore/workspace-starter-release-sync'}};
  const candidate=fileSet.slice(7);
  assert.deepEqual(classifyAdmission(p,candidate).checks,[...BASELINE_CHECKS,...STARTER_CHECKS]);
  assert.throws(() => classifyAdmission(p,[...candidate,'package.json']));
});
test('missing, skipped, neutral, failure and pending never admit', () => {
  const names=['migration-preflight','package-exact-proof'];
  const complete=names.map((name,id)=>({name,id:id+1,status:'completed',conclusion:'success',
    started_at:'2026-11-04T10:00:00Z'}));
  assert.equal(assessCheckRuns(complete,names).success,true);
  assert.deepEqual(assessCheckRuns(complete.slice(0,1),names).pending,['package-exact-proof']);
  for (const conclusion of ['failure','cancelled','skipped','neutral']) {
    assert.equal(assessCheckRuns([{...complete[0],conclusion},complete[1]],names).success,false);
  }
  assert.deepEqual(assessCheckRuns([{...complete[0],status:'in_progress'},complete[1]],names)
    .pending,['migration-preflight']);
});
test('latest failed attempt defeats older green same exact SHA', () => {
  const name='migration-preflight';
  const old={name,id:1,status:'completed',conclusion:'success',
    started_at:'2026-11-04T10:00:00Z'};
  const latest={...old,id:2,conclusion:'failure',started_at:'2026-11-04T10:01:00Z'};
  assert.equal(assessCheckRuns([old,latest],[name]).success,false);
});
