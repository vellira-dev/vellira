import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE_CHECKS } from './release-sync-admission.mjs';
import { rulesetGrantsSafeAdmission } from './release-sync-automerge.mjs';

const rule = {
  name:'Protect Main',target:'branch',source_type:'Repository',
  enforcement:'active',current_user_can_bypass:'never',
  conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},
  bypass_actors:[],
  rules:[
    {type:'pull_request',parameters:{required_approving_review_count:0}},
    {type:'required_status_checks',parameters:{
      strict_required_status_checks_policy:true,
      required_status_checks:[...BASELINE_CHECKS,'Release Sync Admission']
        .map(context=>({context,integration_id:15368}))
    }}
  ]
};
test('strict exact-head required admission grants scoped auto-merge',()=>{
  assert.equal(rulesetGrantsSafeAdmission(rule),true);
});
test('missing admission, existing security gap, or relaxed ruleset fails closed',()=>{
  assert.equal(rulesetGrantsSafeAdmission({...rule,rules:[
    rule.rules[0],{...rule.rules[1],parameters:{...rule.rules[1].parameters,
      required_status_checks:BASELINE_CHECKS.map(context=>({context}))}}]}),false);
  for (const name of BASELINE_CHECKS) {
    const p=rule.rules[1].parameters;
    assert.equal(rulesetGrantsSafeAdmission({...rule,rules:[rule.rules[0],
      {...rule.rules[1],parameters:{...p,required_status_checks:
        p.required_status_checks.filter(x=>x.context!==name)}}]}),false);
  }
  assert.equal(rulesetGrantsSafeAdmission({...rule,bypass_actors:[{actor_id:1}]}),false);
  assert.equal(rulesetGrantsSafeAdmission({...rule,enforcement:'evaluate'}),false);
  assert.equal(rulesetGrantsSafeAdmission({...rule,current_user_can_bypass:'always'}),false);
  assert.equal(rulesetGrantsSafeAdmission({...rule,rules:[rule.rules[0],
    {...rule.rules[1],parameters:{...rule.rules[1].parameters,
      strict_required_status_checks_policy:false}}]}),false);
});
