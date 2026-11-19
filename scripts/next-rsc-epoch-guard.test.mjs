// Compiled Next 16.4.5 CJS and ESM route-context regression controls.
// The real-browser scheduler/MPA proof is a separate acceptance gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const repository = fileURLToPath(new URL('..', import.meta.url));
const installedRequire = createRequire(path.join(repository, 'apps/website/package.json'));
const root = process.env.NEXT2130_DIST_ROOT ??
  path.dirname(installedRequire.resolve('next/package.json'));
assert.ok(fs.existsSync(path.join(root, 'package.json')), 'Installed Next manifest missing');
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  '16.4.5', 'Next #2130 compiled tests must target exactly Next 16.4.5');
const variants=['client','esm/client'];
const KEY=Symbol.for('vellira.next2130.mpaEpoch.v1');
const sourceHref='http://next2130.example/target/prefetched';
const targetHref='http://next2130.example/target/fresh';

function extract(file,name) {
  const ast=ts.createSourceFile(path.basename(file),fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const declarations=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
  assert.equal(declarations.length,1,`Exactly one ${name} from ${file}`);
  return declarations[0].getText(ast).replace(/^export\s+/, '');
}
function source(v,file){return fs.readFileSync(path.join(root,'dist',v,'components',file),'utf8');}
function make(v,{redirect=false}={}) {
  const filename=path.join(root,'dist',v,'components/router-reducer/fetch-server-response.js');
  let released=[];
  const calls=[];
  const sandbox={ Symbol, URL, DOMException, Headers, Response, Error, setTimeout,
    location: {href:sourceHref},
    process:{env:{__NEXT_CLIENT_VALIDATE_RSC_REQUEST_HEADERS:redirect}},
    _deploymentid:{getDeploymentId:()=>null}, getDeploymentId:()=>null,
    _approuterheaders:{NEXT_RSC_UNION_QUERY:'_rsc',NEXT_HTML_REQUEST_ID_HEADER:'x-next-html-request-id',NEXT_REQUEST_ID_HEADER:'x-next-request-id'},
    NEXT_RSC_UNION_QUERY:'_rsc', processFetch:async response=>({response,cacheData:null}),
    decodeFlightResponse:()=>{throw Error('Unexpected Flight decode')},
  };
  const digest=(url,headers)=>new Promise(resolve=>{released.push(()=>{
    url.searchParams.set('_rsc','syntheticHashOnlyInsideOfflineVm');resolve();
  })});
  const fetch=async(url,opts)=>{
    calls.push({url:String(url),headers:{...opts.headers},cache:opts.cache});
    const redirected=redirect&&calls.length===1;
    return {ok:true,status:200,redirected,
      url:redirected?'http://next2130.example/other-target':String(url),
      headers:new Headers({'content-type':'text/x-component'}),body:null};
  };
  sandbox._setcachebustingsearchparam={setCacheBustingSearchParam:digest};
  sandbox.setCacheBustingSearchParam=digest;
  sandbox._fetch={fetch};sandbox.fetch=fetch;
  vm.createContext(sandbox);
  vm.runInContext([
    'let isPageUnloading = false;',
    "const velliraNext2130MpaEpochKey = Symbol.for('vellira.next2130.mpaEpoch.v1');",
    extract(filename,'isVelliraNext2130StaleDestinationPrefetch'),
    extract(filename,'assertVelliraNext2130PrefetchMayDispatch'),
    extract(filename,'createFetch'),
    'globalThis.__vm = {createFetch, setUnloading: x=>{isPageUnloading=x}};'
  ].join('\n'),sandbox);
  return {
    sandbox,calls,
    start:(headers={'rsc':'1','next-router-prefetch':'1','next-url':'/target/prefetched'})=>
      sandbox.__vm.createFetch(new URL(sourceHref),headers,'low',false),
    mark:(target=targetHref)=>{sandbox[KEY]={sourceHref,targetHref:target};},
    clear:()=>{sandbox[KEY]=undefined;},
    move:(href)=>{sandbox.location.href=href;},
    unloading:(flag)=>sandbox.__vm.setUnloading(flag),
    wait:async(n)=>{for(let i=0;i<15 && released.length<n;i++)await new Promise(res=>setImmediate(res));
      assert.ok(released.length>=n,`No awaited SHA continuation ${n}`);},
    release:(i)=>{assert.ok(released[i]);released[i]();},
    check:(headers)=>sandbox.isVelliraNext2130StaleDestinationPrefetch?.(headers,sandbox[KEY]),
  };
}
function mpaHeaders(route='/target/fresh') {return {'rsc':'1','next-router-prefetch':'1','next-url':route};}
for (const v of variants){
  test(`${v}: compiled source maintains two transport guards, no-store, and no runtime logging`,()=>{
    const s=source(v,'router-reducer/fetch-server-response.js');
    const app=source(v,'app-router.js');
    assert.equal(s.split("cache: 'no-store'").length-1,1);
    assert.equal(s.split('assertVelliraNext2130PrefetchMayDispatch(headers, velliraNext2130EpochAtStart);').length-1,2);
    assert.equal(app.split("globalThis[velliraMpaEpochKey] = {").length-1,1);
    assert.ok(app.indexOf('targetHref: new URL(canonicalUrl, location.href).href')<app.indexOf('location.assign(canonicalUrl)'));
    assert.ok(app.includes("globalThis[Symbol.for('vellira.next2130.mpaEpoch.v1')] = undefined;"));
    assert.ok(app.includes('globalThis[velliraMpaEpochKey] = velliraPreviousEpoch;'));
    assert.ok(!s.includes('console.debug('));
  });
  test(`${v}: published createFetch export ABI remains compatible`, () => {
    const transport = source(v, 'router-reducer/fetch-server-response.js');
    if (v === 'esm/client') {
      assert.match(transport, /^export async function createFetch\s*\(/m);
      assert.doesNotMatch(transport, /^export\s*function\s+(?:isVelliraNext2130StaleDestinationPrefetch|assertVelliraNext2130PrefetchMayDispatch)/m);
    } else {
      assert.match(transport, /createFetch:\s*function\s*\(\)\s*\{\s*return createFetch;/);
    }
  });
  test(`${v}: ordinary prefetch without MPA remains allowed`,async()=>{
    const t=make(v),p=t.start();await t.wait(1);t.release(0);
    assert.equal((await p).ok,true);assert.equal(t.calls.length,1);assert.equal(t.calls[0].cache,'no-store');
  });
  test(`${v}: preexisting A digest is invalidated by MPA rotation`,async()=>{
    const t=make(v),p=t.start();await t.wait(1);t.mark();t.release(0);
    await assert.rejects(p,{name:'AbortError'});assert.equal(t.calls.length,0);
  });
  test(`${v}: NEW B-context prefetch is blocked in old A document`,async()=>{
    const t=make(v);t.mark();const p=t.start(mpaHeaders());await t.wait(1);t.release(0);
    await assert.rejects(p,{name:'AbortError'});assert.equal(t.calls.length,0);
  });
  test(`${v}: canceled MPA (204/beforeunload) does not block NEW old-A prefetch`,async()=>{
    const t=make(v);t.mark();const p=t.start(mpaHeaders('/target/prefetched'));await t.wait(1);t.release(0);
    assert.equal((await p).status,200);assert.equal(t.calls.length,1);
  });
  test(`${v}: canceled MPA never blocks unrelated C-context prefetch`,async()=>{
    const t=make(v);t.mark();const p=t.start(mpaHeaders('/other'));await t.wait(1);t.release(0);
    assert.equal((await p).ok,true);assert.equal(t.calls.length,1);
  });
  test(`${v}: resumed SPA history at B allows B-context prefetch`,async()=>{
    const t=make(v);t.mark();t.move(targetHref);const p=t.start(mpaHeaders());await t.wait(1);t.release(0);
    assert.equal((await p).ok,true);assert.equal(t.calls.length,1);
  });
  test(`${v}: BFCache restore removes old MPA epoch without sticky block`,async()=>{
    const t=make(v);t.mark();t.unloading(true);t.unloading(false);t.clear();
    const p=t.start(mpaHeaders());await t.wait(1);t.release(0);
    assert.equal((await p).ok,true);assert.equal(t.calls.length,1);
  });
  test(`${v}: normal navigation RSC is never blocked`,async()=>{
    const t=make(v);t.mark();const p=t.start({'rsc':'1','next-url':'/target/fresh'});
    await t.wait(1);t.release(0);assert.equal((await p).ok,true);assert.equal(t.calls.length,1);
  });
  test(`${v}: pagehide prevents new A-context prefetch`,async()=>{
    const t=make(v);t.unloading(true);const p=t.start(mpaHeaders('/target/prefetched'));
    await t.wait(1);t.release(0);await assert.rejects(p,{name:'AbortError'});assert.equal(t.calls.length,0);
  });
  test(`${v}: URL-search mismatch is not overblocked`,async()=>{
    const t=make(v);t.mark('http://next2130.example/target/fresh?q=1');
    const p=t.start(mpaHeaders('/target/fresh?q=2'));await t.wait(1);t.release(0);
    assert.equal((await p).ok,true);assert.equal(t.calls.length,1);
  });
  test(`${v}: URL-search exact match is blocked`,async()=>{
    const t=make(v);t.mark('http://next2130.example/target/fresh?q=1');
    const p=t.start(mpaHeaders('/target/fresh?q=1'));await t.wait(1);t.release(0);
    await assert.rejects(p,{name:'AbortError'});assert.equal(t.calls.length,0);
  });
  test(`${v}: missing Next-Url header remains compatible`,async()=>{
    const t=make(v);t.mark();const p=t.start({'rsc':'1','next-router-prefetch':'1'});
    await t.wait(1);t.release(0);assert.equal((await p).ok,true);assert.equal(t.calls.length,1);
  });
  test(`${v}: canceled MPA and new navigation changes the epoch and rejects prior tasks`,async()=>{
    const t=make(v);t.mark();const p=t.start(mpaHeaders('/target/prefetched'));
    await t.wait(1);t.mark('http://next2130.example/target/other');t.release(0);
    await assert.rejects(p,{name:'AbortError'});assert.equal(t.calls.length,0);
  });
  test(`${v}: redirects recheck the target context before second network fetch`,async()=>{
    const t=make(v,{redirect:true});const p=t.start(mpaHeaders('/target/prefetched'));
    await t.wait(1);t.release(0);await t.wait(2);assert.equal(t.calls.length,1);
    t.mark(); t.release(1);
    await assert.rejects(p,{name:'AbortError'});assert.equal(t.calls.length,1);
  });
  test(`${v}: MPA target relative href URI is normalized`,async()=>{
    const t=make(v);t.mark('/target/fresh');const p=t.start(mpaHeaders());
    await t.wait(1);t.release(0);
    // Published app-router always stores an ABSOLUTE normalized target URL; this
    // deliberately malformed VM token cannot be mistaken for a valid MPA proof.
    assert.equal((await p).ok,true);assert.equal(t.calls.length,1);
  });
  test(`${v}: different-origin target cannot accidentally block same-origin context`,async()=>{
    const t=make(v);t.mark('https://elsewhere.example/target/fresh');const p=t.start(mpaHeaders());
    await t.wait(1);t.release(0);assert.equal((await p).ok,true);assert.equal(t.calls.length,1);
  });
}
for (const helper of ['isVelliraNext2130StaleDestinationPrefetch','assertVelliraNext2130PrefetchMayDispatch']){
 test(`CJS/ESM ${helper} compiled behavior is byte-identical`,()=>{
  const a=extract(path.join(root,'dist/client/components/router-reducer/fetch-server-response.js'),helper);
  const b=extract(path.join(root,'dist/esm/client/components/router-reducer/fetch-server-response.js'),helper);
  assert.equal(a,b);
 });
}
