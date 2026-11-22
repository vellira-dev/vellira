// Retry-only compiled-source regression tests for exact Next.js 16.4.5.
// This does NOT prove real browser HTTP204/beforeunload behavior or #2130 Safari S5.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const repo = fileURLToPath(new URL('..',import.meta.url));
const websiteRequire = createRequire(path.join(repo,'apps/website/package.json'));
const nextPkg = websiteRequire.resolve('next/package.json');
const nextRoot = path.dirname(nextPkg);
const packageJSON = JSON.parse(fs.readFileSync(nextPkg,'utf8'));
assert.equal(packageJSON.version,'16.4.5','Exact published Next 16.4.5 required');
const variants=['client','esm/client'];
const readDist=(v,p)=>fs.readFileSync(path.join(nextRoot,'dist',v,'components',p),'utf8');
const targetHref='http://next2130.example/target/fresh';
const sourceHref='http://next2130.example/target/prefetched';

function getOneFunction(v,name) {
  const filename=path.join(nextRoot,'dist',v,'components/app-router.js');
  const src=fs.readFileSync(filename,'utf8');
  const ast=ts.createSourceFile(filename,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const nodes=[];
  function visit(node){
    if (ts.isFunctionDeclaration(node)&&node.name?.text===name) nodes.push(node);
    ts.forEachChild(node,visit);
  }
  visit(ast);
  assert.equal(nodes.length,1,`Expected one compiled ${name} in ${v}`);
  return nodes[0].getText(ast);
}

function getOneMpaBlock(v){
  const filename=path.join(nextRoot,'dist',v,'components/app-router.js');
  const src=fs.readFileSync(filename,'utf8');
  const ast=ts.createSourceFile(filename,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const nodes=[];
  function visit(node){
    if(ts.isIfStatement(node) && node.expression.getText(ast)==='pushRef.mpaNavigation') nodes.push(node);
    ts.forEachChild(node,visit);
  }
  visit(ast);
  assert.equal(nodes.length,1,`Expected exactly one compiled hard-MPA branch in ${v}`);
  return nodes[0].getText(ast);
}

function makeRouter(v){
  const calls=[],restored=[];
  const suspense=Symbol('unresolved-Next-router-suspension');
  const location={href:sourceHref,
    assign(url){calls.push({kind:'assign',url});},
    replace(url){calls.push({kind:'replace',url});}
  };
  const sandbox={
    pushRef:null,canonicalUrl:targetHref,globalMutable:{},URL,
    window:{location,history:{state:{__PRIVATE_NEXTJS_INTERNALS_TREE:{root:'old'}}}},
    _navigator:{restore:(...args)=>restored.push(args)},
    restore:(...args)=>restored.push(args),
    _unresolvedthenable:{unresolvedThenable:suspense},unresolvedThenable:suspense,
  };
  vm.createContext(sandbox);
  const block=getOneMpaBlock(v);
  const handlePageShow=vm.runInContext(`(${getOneFunction(v,'handlePageShow')})`,sandbox);
  return {
    calls,restored,sandbox,location,suspense,
    render(ref,url=targetHref){
      sandbox.pushRef=ref;sandbox.canonicalUrl=url;
      try{ vm.runInContext(block,sandbox); }
      catch(e){if(e!==suspense) throw e; return 'SUSPENDED';}
      throw Error('MPA branch must suspend');
    },
    pageShow(persisted){handlePageShow({persisted});},
  };
}

test('Exact version resolved using website manifest',()=>{
  assert.equal(packageJSON.version,'16.4.5');
  assert.equal(path.basename(nextRoot),'next');
});

for(const v of variants){
  test(`${v}: published transport keeps no-store and original prefetch semantics`,()=>{
    const src=readDist(v,'router-reducer/fetch-server-response.js');
    assert.match(src,/cache:\s*['"]no-store['"]/);
    assert.doesNotMatch(src,/vellira\.next2130|isVelliraNext2130|assertVelliraNext2130/);
  });

  test(`${v}: exactly one retry-only block and no destination guard`,()=>{
    const src=readDist(v,'app-router.js');
    const block=getOneMpaBlock(v);
    assert.match(block,/globalMutable\.pendingMpaNavigation\s*!==\s*pushRef/);
    assert.match(block,/globalMutable\.pendingMpaNavigation\s*=\s*pushRef/);
    assert.doesNotMatch(src,/pendingMpaPath|vellira\.next2130|isVelliraNext2130/);
    assert.match(src,/globalMutable\.pendingMpaNavigation\s*=\s*undefined/);
    assert.match(block,/location\.assign\(canonicalUrl\)/);
    assert.match(block,/location\.replace\(canonicalUrl\)/);
  });

  test(`${v}: same pushRef is deduplicated across re-renders`,()=>{
    const x=makeRouter(v),ref={mpaNavigation:true,pendingPush:true};
    assert.equal(x.render(ref),'SUSPENDED');
    assert.equal(x.render(ref),'SUSPENDED');
    assert.deepEqual(x.calls,[{kind:'assign',url:targetHref}]);
    assert.strictEqual(x.sandbox.globalMutable.pendingMpaNavigation,ref);
  });

  test(`${v}: canceled HTTP204 allows a fresh same-Link pushRef, same URL`,()=>{
    const x=makeRouter(v),first={mpaNavigation:true,pendingPush:true},second={mpaNavigation:true,pendingPush:true};
    x.render(first); // HTTP204 leaves the document alive and href unchanged.
    assert.equal(x.location.href,sourceHref);
    x.render(second);
    assert.deepEqual(x.calls,[{kind:'assign',url:targetHref},{kind:'assign',url:targetHref}]);
    assert.strictEqual(x.sandbox.globalMutable.pendingMpaNavigation,second);
  });

  test(`${v}: dismissed beforeunload allows a fresh same-Link replace`,()=>{
    const x=makeRouter(v),first={mpaNavigation:true,pendingPush:false},second={mpaNavigation:true,pendingPush:false};
    x.render(first);x.render(first); // canceled native dialog; source document survives
    x.render(second);
    assert.deepEqual(x.calls,[{kind:'replace',url:targetHref},{kind:'replace',url:targetHref}]);
  });

  test(`${v}: new pushRef to a different URL is not spuriously suppressed`,()=>{
    const x=makeRouter(v),first={mpaNavigation:true,pendingPush:true},second={mpaNavigation:true,pendingPush:true};
    x.render(first);
    x.render(second,'http://next2130.example/target/other');
    assert.deepEqual(x.calls,[
      {kind:'assign',url:targetHref},
      {kind:'assign',url:'http://next2130.example/target/other'}
    ]);
  });

  test(`${v}: synchronous assign error does not poison the retry identity`,()=>{
    const x=makeRouter(v),first={mpaNavigation:true,pendingPush:true},second={mpaNavigation:true,pendingPush:true};
    x.render(first);
    x.location.assign=()=>{throw Error('synthetic location failure');};
    assert.throws(()=>x.render(second),/synthetic location failure/);
    assert.strictEqual(x.sandbox.globalMutable.pendingMpaNavigation,first);
    x.location.assign=(url)=>x.calls.push({kind:'assign',url});
    x.render(second);
    assert.equal(x.calls.length,2);
  });

  test(`${v}: BFCache restored document clears prior navigation identity`,()=>{
    const x=makeRouter(v),ref={mpaNavigation:true,pendingPush:true};
    x.render(ref);
    x.pageShow(true);
    assert.equal(x.sandbox.globalMutable.pendingMpaNavigation,undefined);
    assert.equal(x.restored.length,1);
  });

  test(`${v}: ordinary pageshow leaves pending state untouched`,()=>{
    const x=makeRouter(v),ref={mpaNavigation:true,pendingPush:true};
    x.render(ref);
    x.pageShow(false);
    assert.strictEqual(x.sandbox.globalMutable.pendingMpaNavigation,ref);
    assert.equal(x.restored.length,0);
  });

  test(`${v}: BFCache with no Next history tree does not invoke restore`,()=>{
    const x=makeRouter(v),ref={mpaNavigation:true,pendingPush:true};
    x.render(ref);
    x.sandbox.window.history.state=null;
    x.pageShow(true);
    assert.equal(x.restored.length,0);
    // Scope decision: same Link retry still works because a new pushRef is created.
    x.render({mpaNavigation:true,pendingPush:true});
    assert.equal(x.calls.length,2);
  });
}
