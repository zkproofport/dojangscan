// Bounded GET-only check through the exact production adapters. No chain RPC or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import https from 'node:https';
const tunneled=process.argv.includes('--ssh-loopback');
const transport: typeof fetch=tunneled ? async(input,init)=>new Promise((resolve,reject)=>{
 const url=new URL(String(input));
 const r=https.request({hostname:'127.0.0.1',port:18444,servername:url.hostname,rejectUnauthorized:true,path:url.pathname+url.search,method:'GET',headers:{Host:url.hostname,Origin:'https://dojangscan.com'},signal:init?.signal??undefined},res=>{
  const chunks: Buffer[]=[];let bytes=0;res.on('data',c=>{bytes+=c.length;if(bytes>4194304){res.destroy(new Error('RESPONSE_TOO_LARGE'));return;}chunks.push(c)});res.on('error',reject);res.on('end',()=>{const headers=new Headers();for(const [k,v] of Object.entries(res.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}))});
 });r.on('error',reject);r.end();
}) : fetch;
import {createBackendClient, BackendError, backendPage} from '../lib/backend-api';
import {adaptProjection} from '../lib/backend-adapter';
import {createHistoricalClient, HistoricalError} from '../lib/historical-api';
const p=JSON.parse(fs.readFileSync(new URL('../deployment/public-explorer.json',import.meta.url),'utf8'));
let requests=0;
const checks: {path:string,status:number}[]=[];
const request: typeof fetch=async(input,init)=>{
 const url=new URL(String(input));assert.equal(url.origin,'https://api.dojangscan.com');assert.equal(init?.method,'GET');assert.equal(init?.credentials,'omit');
 assert(++requests<=16,'GET verification request bound');
 const r=await transport(input,{...init,redirect:'error',headers:{Origin:p.frontendOrigin}});
 assert.equal(r.headers.get('access-control-allow-origin'),p.frontendOrigin);
 assert.equal(r.headers.get('access-control-allow-credentials'),null);
 checks.push({path:url.pathname,status:r.status});return r;
};
const live=createBackendClient(p.network,request,p.liveAPIBase);
const history=createHistoricalClient(p.network,request,p.historicalAPIBase);
const status=await live.status();assert.equal(status.meta.stateEvaluationReady,false);
const first=await live.list({},undefined,1);assert(first.data.length);assert(first.next);
const detail=await live.detail(first.data[0].uid);assert.equal(detail.data.uid,first.data[0].uid);
assert.equal(adaptProjection(detail.data).currentDecision,'UNKNOWN');assert.equal(detail.meta.coverage.raw_complete,false);
const next=await backendPage(live,{},first.next!,1);if(!next.reset)assert.notEqual(next.page.data[0]?.uid,first.data[0].uid);
const coverage=await history.coverage();assert.equal(coverage.summary.payloads,1304);assert.equal(coverage.summary.uniqueUIDs,1377);assert.equal(coverage.receiptVerifiedBlocks.length,1295);
assert.equal(coverage.discovery.reduce((n,r)=>n+r.through-r.from+1,0),100000);
const events=await history.events();assert(events.next);const following=await history.events({},events.next!);assert.notEqual(events.data[0].id,following.data[0].id);
for(const event of ['Attested','Revoked','AttestationIndexed'])assert.equal((await history.events({event})).data[0].event,event);
const historicalDetail=await history.uid('0x001e9914b158ba59a3acef826ba49081adc757a13484a56e0e8f67a1245cb162');assert.equal(historicalDetail.issuanceEvidence?.proofComplete,false);
await assert.rejects(history.events({},'invalid'),e=>e instanceof HistoricalError&&e.status===400);
await assert.rejects(live.detail('0x'+'0'.repeat(64)),e=>e instanceof BackendError&&e.status===503&&e.code==='NOT_FOUND_IN_COVERAGE');
console.log(JSON.stringify({pass:true,transport:tunneled?'SSH forward to installed public Caddy (not independent external proof)':'direct public HTTPS',requests,checks,rawAsOf:status.meta.asOfBlock,evaluated:status.meta.evaluatedBlock,livePaginationReset:next.reset,historicalUIDs:coverage.summary.uniqueUIDs,payloads:coverage.summary.payloads,discoveryBlocks:100000,receiptVerifiedBlocks:1295,currentDecision:'UNKNOWN',newRPC:0,databaseWrites:0},null,2));
