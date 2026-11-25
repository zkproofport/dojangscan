import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, AbiCoder, ZeroAddress } from 'ethers';
import { attestationAtCatalog, queryScan, cached, invalidateScanCache, type catalog } from '../lib/scan-data';
import { publicReadURL } from '../lib/public-read-transport';
import { CONTRACTS, NETWORK, ZERO } from '../lib/giwa';
const uid='0x'+'1'.repeat(64), schema='0x'+'2'.repeat(64), foreign='0x'+'3'.repeat(64);
const eas=new Interface(['function getAttestation(bytes32) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))']);
const registry=new Interface(['function getSchema(bytes32) view returns ((bytes32 uid,address resolver,bool revocable,string schema))']);
const cat: Awaited<ReturnType<typeof catalog>>={block:123,checkedAt:'2026-11-25T00:00:00Z',schemas:[],issuers:[],governance:{roles:[],complete:true,block:123},issuerDiscoveryComplete:true,warnings:[]};
const tuple=(id:string)=>[id,schema,1n,0n,0n,ZERO,ZeroAddress,ZeroAddress,true,AbiCoder.defaultAbiCoder().encode(['string'],['uninterpreted code'])];

test('actual UID reader keeps EAS and Registry at the catalog block without fetching a second catalog',async()=>{
 const old=globalThis.fetch;const calls:any[]=[];
 globalThis.fetch=async(input,init)=>{assert.equal(input,NETWORK.rpc);const req=JSON.parse(String(init?.body));calls.push(...req);return Response.json(req.map((r:any)=>{assert.equal(r.method,'eth_call');assert.equal(r.params[1],'0x7b');return {jsonrpc:'2.0',id:r.id,result:r.params[0].to===CONTRACTS.EAS?eas.encodeFunctionResult('getAttestation',[tuple(uid)]):registry.encodeFunctionResult('getSchema',[[schema,ZeroAddress,true,'string code']])};}));};
 try {const value=await attestationAtCatalog(uid,cat);assert.equal(value?.checkedBlock,123);assert.deepEqual(value?.fields,[{name:'code',type:'string',value:'uninterpreted code'}]);assert.equal(value?.dojang,false);assert.equal(calls.length,2);}finally{globalThis.fetch=old;}
});
test('UID mismatch and RPC errors are errors; absent EAS remains absent; Registry mismatch cannot decode',async()=>{
 const old=globalThis.fetch;
 try{for(const scenario of ['foreign','absent','error','wrong-schema']){
 let calls=0;
 globalThis.fetch=async(_input,init)=>{calls++;const req=JSON.parse(String(init?.body));return Response.json(req.map((r:any)=>scenario==='error'?{id:r.id,error:{code:-1,message:'read failed'}}:{id:r.id,result:calls===1?eas.encodeFunctionResult('getAttestation',[tuple(scenario==='foreign'?foreign:scenario==='absent'?ZERO:uid)]):registry.encodeFunctionResult('getSchema',[[foreign,ZeroAddress,true,'string code']])}));};
 if(scenario==='foreign')await assert.rejects(attestationAtCatalog(uid,cat),/EAS_UID_MISMATCH/);
 else if(scenario==='error')await assert.rejects(attestationAtCatalog(uid,cat),/read failed/);
 else if(scenario==='absent')assert.equal(await attestationAtCatalog(uid,cat),null);
 else assert.deepEqual((await attestationAtCatalog(uid,cat))?.fields,[]);
 assert.equal(calls,scenario==='wrong-schema'?2:1);
 }}finally{globalThis.fetch=old;}
});
test('catalog menu reuses only the checked catalog and does not hydrate an unrelated issuance feed',async()=>{
 const old=globalThis.fetch;invalidateScanCache();
 await cached('head-block',10000,async()=>123);await cached('catalog:123',10000,async()=>cat);
 globalThis.fetch=async()=>{throw Error('Unexpected request');};
 try{const data=await queryScan('catalog-view');assert.equal(data.catalogOnly,true);assert.deepEqual(data.schemas,cat.schemas);assert.deepEqual(data.attestations,[]);assert.equal(data.next,null);assert.match(data.coverage,/no issuance query/);}finally{globalThis.fetch=old;invalidateScanCache();}
});
test('development GET transport preserves the official Explorer path without changing production or RPC source',()=>{
 const url=NETWORK.explorer+'/api/v2/addresses/'+ZeroAddress+'/logs?topic='+uid;
 assert.equal(publicReadURL(url,true),'/api/public-explorer/api/v2/addresses/'+ZeroAddress+'/logs?topic='+uid);
 assert.equal(publicReadURL(url,false),url);
 for(const other of [NETWORK.rpc,NETWORK.explorer+'/address/'+ZeroAddress,'https://evil.test/api/v2/addresses/a'])assert.equal(publicReadURL(other,true),other);
});
