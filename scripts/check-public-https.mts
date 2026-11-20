// Local-only TLS contract check. Always maps the approved hostname to Mac loopback.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import https from 'node:https';
import {createBackendClient, BackendError} from '../lib/backend-api';
import {createHistoricalClient, HistoricalError} from '../lib/historical-api';
import settings from '../deployment/public-explorer.json';
const ca=fs.readFileSync(process.argv[2]!);let requests=0;
const request:typeof fetch=async(input,init)=>{
 const url=new URL(String(input));assert.equal(url.origin,'https://api.dojangscan.com');requests++;
 return new Promise<Response>((resolve,reject)=>{
  const r=https.request({hostname:'127.0.0.1',port:18443,servername:'api.dojangscan.com',ca,rejectUnauthorized:true,path:url.pathname+url.search,method:init?.method??'GET',headers:{host:'api.dojangscan.com',origin:'https://dojangscan.com',...Object.fromEntries(new Headers(init?.headers))}},response=>{
   const parts:Buffer[]=[];response.on('data',b=>parts.push(b));response.on('error',reject);response.on('end',()=>{
    const headers=new Headers();for(const [k,v] of Object.entries(response.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
    resolve(new Response(Buffer.concat(parts),{status:response.statusCode,headers}));
   });
  });r.setTimeout(15000,()=>r.destroy(Error('TLS_TEST_TIMEOUT')));r.on('error',reject);r.end();
 });
};
const live=createBackendClient(settings.network,request,settings.liveAPIBase);
const history=createHistoricalClient(settings.network,request,settings.historicalAPIBase);
const status=await live.status();assert.equal(status.meta.stateEvaluationReady,false);
const page=await live.list();assert.ok(page.data.length);assert.ok(page.next);
const next=await live.list({},page.next);assert.notEqual(page.data[0]!.uid,next.data[0]!.uid);
const detail=await live.detail(page.data[0]!.uid);assert.equal(detail.data.uid,page.data[0]!.uid);
await assert.rejects(live.list({issuer:'0x'+'f'.repeat(40)}),e=>e instanceof BackendError&&e.status===503);
const coverage=await history.coverage();assert.equal(coverage.summary.payloads,1304);assert.equal(coverage.summary.uniqueUIDs,1377);assert.equal(coverage.receiptVerifiedBlocks.length,1295);
assert.equal((coverage.meta as any).currentDecision,'UNKNOWN');assert.equal((coverage.meta as any).rawCoverageCertified,false);
const events=await history.events();assert.ok(events.next);const events2=await history.events({},events.next);assert.notEqual(events.data[0]!.id,events2.data[0]!.id);
for(const event of ['Attested','Revoked','AttestationIndexed'])assert.equal((await history.events({event})).data[0]!.event,event);
const uid='0x001e9914b158ba59a3acef826ba49081adc757a13484a56e0e8f67a1245cb162';const h=await history.uid(uid);assert.equal(h.issuanceEvidence?.payload.uid,uid);
const absent=await history.uid('0x'+'0'.repeat(64));assert.equal((absent as any).definitiveNotFound,false);
await assert.rejects(history.events({},'bad-cursor'),e=>e instanceof HistoricalError&&e.status===400);
const path=settings.liveAPIBase+'/v1/networks/'+settings.network+'/status';
const response=await request(path);assert.equal(response.headers.get('access-control-allow-origin'),settings.frontendOrigin);assert.equal(response.headers.get('access-control-allow-credentials'),null);assert.equal(response.headers.get('set-cookie'),null);
const sanitized=await response.json();assert.equal(sanitized.operations.aggregateUsage,undefined);assert.equal(sanitized.operations.autonomy,undefined);assert.equal(sanitized.checkpoint,undefined);
assert.equal((await request(path,{headers:{origin:'https://evil.example'}})).status,403);
assert.equal((await request(path,{method:'POST'})).status,405);
assert.equal((await request(settings.liveAPIBase+'/v1/networks/not-allowed/status')).status,404);
assert.equal((await request(path+'?secret=denied')).status,400);
console.log(JSON.stringify({pass:true,HTTPSRequests:requests,TLSCertificateVerified:true,localOnly:true,live:'recorded read-only response; pagination fixture',historical:'fixed 100K snapshot',payloads:1304,receipts:1295,UNKNOWN:true,CORS:true,statusRedacted:true,NUCChanges:0,newRPC:0}));
