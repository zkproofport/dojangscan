import assert from 'node:assert/strict';
import {queryScan} from '../lib/scan-data.ts';
import {prepareProof} from '../lib/proof-policy.ts';
import {createOffchainExample} from '../lib/examples.ts';
import {inspectOffchain} from '../lib/offchain.ts';
import {NETWORK,CONTRACTS} from '../lib/giwa.ts';
import {Interface} from 'ethers';
import {inspectCapabilities,prepareCall,simulateCall,signOffchain} from '../lib/workspace.ts';
import {Wallet} from 'ethers';
const overview=await queryScan('overview');assert(overview.block>0);assert(overview.attestations.length>0);assert(overview.schemas.some(s=>s.current));assert(overview.issuers.length>0);assert.equal(overview.governance.block,overview.block);
const first=overview.attestations[0];
const [detail,schema,tx,wallet,contracts,search,older,example,page]=await Promise.all([
queryScan('attestation',{uid:first.uid}),queryScan('schema',{uid:first.schema}),queryScan('transaction',{hash:first.tx}),queryScan('wallet',{address:first.recipient}),queryScan('contracts'),queryScan('search',{value:first.uid}),overview.next?queryScan('attestations',{cursor:JSON.stringify(overview.next)}):null,createOffchainExample(),fetch('http://127.0.0.1:4317/')
]);
assert.equal(detail.uid,first.uid);assert(detail.fields.length>0);assert.equal(schema.uid.toLowerCase(),first.schema.toLowerCase());assert(tx.attestations.some(a=>a?.uid===first.uid));assert.equal(wallet.address.toLowerCase(),first.recipient.toLowerCase());assert(contracts.contracts.every(c=>c.deployed===true));assert.equal(search.type,'attestation');if(older){assert(older.attestations.length>0);assert(!older.attestations.some(a=>a.uid===first.uid));}assert.equal(page.status,200);assert((await page.text()).includes('/src/main.tsx'));
const local=inspectOffchain(example,example.attester);assert.equal(local.signatureValid,true);const offchain=await queryScan('offchain',{issuer:local.signer,uid:local.uid});assert.equal(offchain.easVersion,local.domainVersion);assert.equal(offchain.registeredIssuer,false);
const roleABI=new Interface(['function hasRole(bytes32,address) view returns (bool)']);const roles=overview.governance.roles.filter(r=>r.active===true);assert(roles.some(r=>r.role==='admin'));for(const role of roles){const response=await fetch(NETWORK.rpc,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:4317'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:CONTRACTS[role.contract],data:roleABI.encodeFunctionData('hasRole',[role.roleId,role.address])},'0x'+overview.block.toString(16)]})});assert.equal(response.headers.get('access-control-allow-origin'),'*');const body=await response.json();assert.equal(roleABI.decodeFunctionResult('hasRole',body.result)[0],true);}
assert.throws(()=>prepareProof({circuit:'giwa_attestation',chainId:1},'x'),/프로필/);
const admin=roles.find(r=>r.contract==='DojangAttesterBook'&&r.role==='admin').address;
const permissions=await inspectCapabilities(admin,'');assert(permissions.books.every(b=>b.registrationAdmin&&b.canGrantRole));
const ordinary=await inspectCapabilities('0x1111111111111111111111111111111111111111','');assert(ordinary.books.every(b=>!b.registrationAdmin&&!b.canGrantRole));
const definition='bool completedCourse'+crypto.randomUUID().replaceAll('-','');
const prepared=prepareCall('schema',{definition,values:'[true]',recipient:admin,schema:'',id:'',target:'',role:'',expiration:'0',book:'SchemaBook'});
const dryRun=await simulateCall(prepared,admin);assert.equal(dryRun.success,true);assert.equal(dryRun.sent,false);
const localSigner=Wallet.createRandom();const custom=await signOffchain(localSigner,'uint256 balanceKRW','["1000000"]',localSigner.address,String(Math.floor(Date.now()/1000)+3600));assert.equal(inspectOffchain(custom,localSigner.address).signatureValid,true);
console.log(JSON.stringify({currentRoleAdmin:true,unauthorizedRoleFalse:true,schemaSimulation:true,customOffchainSignature:true,checkedBlock:overview.block,records:overview.attestations.length,schemas:overview.schemas.filter(s=>s.current).length,registeredIssuers:overview.issuers.length,managementRoles:roles.map(r=>({contract:r.contract,role:r.role,address:r.address})),detail:true,schema:true,transaction:true,wallet:true,contracts:contracts.contracts.length,pagination:!!older,offchainExample:true,rpcCors:true,staticHtml:page.status,rejectWrongChain:true}));
