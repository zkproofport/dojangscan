import { historyRequest, historyEvents, historyCursor, schemaHistoryRequest, schemaHistoryEvents, type HistoryRole, type LogCursor } from "./history";
import { issuerMetadata, PLAYGROUND_ATTESTER_ID } from "./issuer-metadata";
import { AbiCoder, Interface, id, isAddress, getAddress, ZeroAddress } from 'ethers';
import { CONTRACTS, TEST_ATTESTER, NETWORK, SCHEMAS, UPBIT_ID, ZERO, type Attestation, type SchemaRecord, type Issuer, type GovernanceRole } from './giwa';
import { classifyIssuer } from './trust';
const eas = new Interface(['function getAttestation(bytes32 uid) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))']);
const registry = new Interface(['function getSchema(bytes32 uid) view returns ((bytes32 uid,address resolver,bool revocable,string schema))']);
const book = new Interface(['function getSchemaUid(bytes32 id) view returns (bytes32)']);
const issuersABI = new Interface(['function getAttester(bytes32 id) view returns (address)']);
const scroll = new Interface(['function isVerified(address addr,bytes32 attesterId) view returns (bool)']);
const coder = AbiCoder.defaultAbiCoder();
type Log = { topics: (string | null)[]; data: string; transaction_hash: string; block_number: number; block_timestamp: string; decoded?: { method_call: string; parameters: { name: string; value: string }[] } };
type Page = { items: Log[]; next_page_params: Record<string, number> | null };
const cache = new Map<string, { expiry: number; value: unknown }>(); const pending = new Map<string, Promise<unknown>>();
let cacheEpoch = 0;
export function invalidateScanCache() { cacheEpoch++; cache.clear(); pending.clear(); }
export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
 const existing = cache.get(key); if (existing && existing.expiry > Date.now()) return existing.value as T; if (pending.has(key)) return pending.get(key) as Promise<T>;
 const epoch=cacheEpoch;
 const task = fn().then(value => { if(epoch===cacheEpoch){cache.set(key, { expiry: Date.now() + ttl, value }); if (cache.size > 200) cache.delete(cache.keys().next().value!);} return value; }).finally(() => {if(pending.get(key)===task)pending.delete(key);}); pending.set(key, task); return task;
}
let rpcQueue:Promise<unknown>=Promise.resolve();
let rpcStartedAt=0;
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function json(url:string,options?:RequestInit):Promise<any>{
 const request=async()=>{
  for(let attempt=0;attempt<4;attempt++){
   if(url===NETWORK.rpc){await pause(Math.max(0,650-(Date.now()-rpcStartedAt)));rpcStartedAt=Date.now();}
   const response=await fetch(url,{...options,signal:AbortSignal.timeout(18000)});
   if(response.status===429&&attempt<3){const seconds=Number(response.headers.get('retry-after'));await pause(Math.min(5000,Math.max(1000,Number.isFinite(seconds)?seconds*1000:1000)*(attempt+1)));continue;}
   if(!response.ok)throw new Error(response.status===429?'공개 RPC의 조회 한도에 도달했습니다. 잠시 후 다시 조회하세요.':`공개 데이터 서비스 응답 오류 (${response.status}). 잠시 후 다시 시도해 주세요.`);
   const body=await response.json();
   const entries=Array.isArray(body)?body:[body];
   const limited=entries.some((entry:{error?:{code:number;message?:string}})=>entry.error&&(entry.error.code===429||entry.error.code===-32005||/rate.?limit|too many|exceed.*request|request.*limit/i.test(entry.error.message??'')));
   if(url===NETWORK.rpc&&limited&&attempt<3){await pause(2000*(attempt+1));continue;}
   return body;
  }
 };
 if(url!==NETWORK.rpc)return request();
 const task=rpcQueue.then(request,request);rpcQueue=task.catch(()=>{});return task;
}
export async function rpc(method:string,params:unknown[]){const result=await json(NETWORK.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(result.error)throw new Error(`GIWA RPC: ${result.error.message}`);return result.result;}
async function headBlock(){return cached('head-block',10000,async()=>parseInt(await rpc('eth_blockNumber',[]),16));}
async function batchCalls(calls:{target:string;abi:Interface;method:string;args:unknown[]}[],block:number){
 const results:(ReturnType<Interface['decodeFunctionResult']>|null)[]=[];
 for(let offset=0;offset<calls.length;offset+=3){
  const part=calls.slice(offset,offset+3);
  const output=await json(NETWORK.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(part.map((c,i)=>({jsonrpc:'2.0',id:i,method:'eth_call',params:[{to:c.target,data:c.abi.encodeFunctionData(c.method,c.args)},'0x'+block.toString(16)]})))});
  if(!Array.isArray(output))throw new Error('RPC 일괄 조회 응답을 읽을 수 없습니다.');
  results.push(...part.map((c,i)=>{const item=output.find(r=>r.id===i);if(!item)return null;if(item.error)throw new Error(`GIWA ${c.method}: ${item.error.message??'RPC 조회 실패'}`);try{return c.abi.decodeFunctionResult(c.method,item.result);}catch{return null;}}));
 }
 return results;
}
function cursorParams(cursor: Record<string, number> | null) { const params = new URLSearchParams(); if (cursor) for (const [key, value] of Object.entries(cursor)) if (['index', 'block_number', 'items_count'].includes(key) && Number.isSafeInteger(value) && value >= 0) params.set(key, String(value)); return params; }
async function logs(address: string, cursor: Record<string, number> | null = null): Promise<Page> { return json(`${NETWORK.explorer}/api/v2/addresses/${address}/logs?${cursorParams(cursor)}`); }
async function discovery(address: string) { const items: Log[] = []; let next: Record<string, number> | null = null; for (let i = 0; i < 6; i++) { const page = await logs(address, next); items.push(...page.items); next = page.next_page_params; if (!next) break; } return { items, complete: !next }; }
const eventABI = new Interface(['event SchemaRegistered(bytes32 indexed schemaId,bytes32 indexed easSchemaUid)','event AttesterRegistered(bytes32 indexed attesterId,address indexed attester)','event AttesterUnregistered(bytes32 indexed attesterId)','event RoleGranted(bytes32 indexed role,address indexed account,address indexed sender)','event RoleRevoked(bytes32 indexed role,address indexed account,address indexed sender)']);
function getParam(log: Log, name: string): string | undefined {
 try { const event = eventABI.parseLog({topics: log.topics.filter((t): t is string => !!t),data:log.data}); if(event?.args[name] !== undefined) return String(event.args[name]); } catch {}
 return log.decoded?.parameters.find(p => p.name === name)?.value;
}
const access = new Interface(['function hasRole(bytes32 role,address account) view returns (bool)']);
async function governanceAt(schemaLogs: Awaited<ReturnType<typeof discovery>>, issuerLogs: Awaited<ReturnType<typeof discovery>>, height: number, issuerAddresses: string[]) {
 const pairs = new Map<string,{contract:'SchemaBook'|'DojangAttesterBook';address:string;roleId:string;tx:string}>();
 for (const [contract, history] of [['SchemaBook',schemaLogs],['DojangAttesterBook',issuerLogs]] as const) {
  const upgrader = id(contract === 'SchemaBook' ? 'dojang.schemabook.upgrader' : 'dojang.dojangattesterbook.upgrader');
  for (const log of history.items) {
   const roleId = getParam(log,'role'); const account = getParam(log,'account');
   if(!account || !roleId || ![ZERO,upgrader].includes(roleId)) continue;
   const key=contract+roleId+account.toLowerCase(); if(!pairs.has(key))pairs.set(key,{contract,address:getAddress(account),roleId,tx:log.transaction_hash});
  }
  // Verify registered publishers explicitly, even when older role events are outside discovery coverage.
  for(const address of issuerAddresses){const key=contract+ZERO+address.toLowerCase();if(!pairs.has(key))pairs.set(key,{contract,address,roleId:ZERO,tx:''});}
 }
 const candidates=[...pairs.values()];
 const values=await batchCalls(candidates.map(c=>({target:CONTRACTS[c.contract],abi:access,method:'hasRole',args:[c.roleId,c.address]})),height);
 const roles:GovernanceRole[]=candidates.map((c,i)=>({...c,role:c.roleId===ZERO?'admin':'upgrader',active:values[i]?Boolean(values[i]![0]):null}));
 return {roles,complete:schemaLogs.complete&&issuerLogs.complete&&values.every(Boolean),block:height};
}
function formatFields(definition: string, data: string) { try { const fields = definition.split(',').map(v => v.trim().split(/\s+/)); const values = coder.decode(fields.map(v => v[0]), data); return fields.map(([type, name], i) => ({ name, type, value: Array.isArray(values[i]) ? JSON.stringify(Array.from(values[i], String)) : String(values[i]) })); } catch { return []; } }
export async function catalog(block?: number) {
 const height=block??await headBlock();
 return cached(`catalog:${height}`,60000,async()=>{
  const [schemaLogs, issuerLogs] = await Promise.all([cached('schema-discovery', 600000, () => discovery(CONTRACTS.SchemaBook)), cached('issuer-discovery', 600000, () => discovery(CONTRACTS.DojangAttesterBook))]);
  const schemaIDs = [...new Set<string>([...SCHEMAS.map(s => s.id), ...schemaLogs.items.map(l => getParam(l, 'schemaId')).filter((v): v is string => !!v)])];
  const issuerIDs = [...new Set([UPBIT_ID, PLAYGROUND_ATTESTER_ID, ...issuerLogs.items.map(l => getParam(l, 'attesterId')).filter((v): v is string => !!v)])];
  const current = await batchCalls([...schemaIDs.map(key => ({ target: CONTRACTS.SchemaBook, abi: book, method: 'getSchemaUid', args: [key] })), ...issuerIDs.map(key => ({ target: CONTRACTS.DojangAttesterBook, abi: issuersABI, method: 'getAttester', args: [key] }))], height);
  const warnings: string[] = []; if (!schemaLogs.complete || !issuerLogs.complete) warnings.push('관리 컨트랙트의 최근 300개 로그에서 발견한 목록입니다. 전체 등록 목록이 아닐 수 있습니다.'); if (current.some(v => !v)) warnings.push('일부 관리 컨트랙트 조회에 실패했습니다. 확인되지 않은 발행자는 등록 여부를 보장하지 않습니다.');
  const uidMap = new Map<string, { id?: string; current: boolean }>(); schemaIDs.forEach((schemaID, i) => { const uid = current[i]?.[0]; if (uid && uid !== ZERO) uidMap.set(uid.toLowerCase(), { id: schemaID, current: true }); });
  for (const s of SCHEMAS) if (!uidMap.has(s.uid)) uidMap.set(s.uid, { id: s.id, current: false });
  for (const l of schemaLogs.items) { const uid = getParam(l, 'easSchemaUid'); if (uid && !uidMap.has(uid.toLowerCase())) uidMap.set(uid.toLowerCase(), { id: getParam(l, 'schemaId'), current: false }); }
  const uids = [...uidMap.keys()]; const schemaValues = await batchCalls(uids.map(uid => ({ target: CONTRACTS.SchemaRegistry, abi: registry, method: 'getSchema', args: [uid] })), height);
  const schemas: SchemaRecord[] = uids.map((uid, i) => { const info = SCHEMAS.find(s => s.id === uidMap.get(uid)?.id || s.uid === uid); const value = schemaValues[i]?.[0]; return { uid, ...uidMap.get(uid)!, name: info?.name ?? 'Custom Dojang', label: info?.label ?? '확장 스키마', category: info?.category ?? 'Custom', color: info?.color ?? 'blue', description: info?.description ?? 'SchemaBook에서 발견한 확장 스키마입니다.', definition: value?.schema ?? '', resolver: value?.resolver ?? ZeroAddress, revocable: !!value?.revocable, registered: !!value && value.uid !== ZERO }; });
  const issuers: Issuer[] = issuerIDs.flatMap((attesterID, i) => { const address = current[schemaIDs.length + i]?.[0]; if (!address || address === ZeroAddress) return []; const log = issuerLogs.items.find(l => getParam(l, 'attesterId') === attesterID); return [{ id: attesterID, address, name: issuerMetadata(attesterID)?.name ?? '등록 발행자', tx: log?.transaction_hash ?? '' }]; });
  const governance=await governanceAt(schemaLogs,issuerLogs,height,issuers.map(i=>i.address));
  if(!governance.complete)warnings.push('관리 역할의 발견 또는 조회가 불완전합니다. 확인된 권한만 표시합니다.');
  return { block: height, schemas, issuers, governance, issuerDiscoveryComplete:issuerLogs.complete&&current.slice(schemaIDs.length).every(Boolean), warnings, checkedAt: new Date().toISOString() };
 });
}
// The EAS tuple is decoded by ethers from the fixed contract ABI.
function normalize(raw: { uid: string; schema: string; recipient: string; attester: string; time: bigint; expirationTime: bigint; revocationTime: bigint; revocable: boolean; refUID: string; data: string }, cat: Awaited<ReturnType<typeof catalog>>, at = Date.now() / 1000): Attestation {
 const schema = cat.schemas.find(s => s.uid === String(raw.schema).toLowerCase()); const issuer = cat.issuers.find(i => i.address.toLowerCase() === raw.attester.toLowerCase()); const expirationTime = Number(raw.expirationTime); const revocationTime = Number(raw.revocationTime);
 return { uid: raw.uid, schema: raw.schema, recipient: raw.recipient, attester: raw.attester, time: Number(raw.time), expirationTime, revocationTime, revocable: raw.revocable, refUID: raw.refUID, data: raw.data, status: revocationTime > 0 ? 'revoked' : expirationTime > 0 && expirationTime <= at ? 'expired' : 'active', fields: schema ? formatFields(schema.definition, raw.data) : [], schemaName: schema?.name ?? 'EAS Schema', schemaLabel: schema?.label ?? '사용자 도장', schemaCurrent:!!schema?.current, dojang: !!schema, ...classifyIssuer(raw.attester,cat.issuers,cat.governance,cat.issuerDiscoveryComplete), issuerId: issuer?.id, issuerName: issuer?.name ?? (raw.attester.toLowerCase()===TEST_ATTESTER.toLowerCase()?'ZKProofport 테스트':'개별 발행자') };
}

// A code-specific event stream, pinned to one block across pagination. Domain
// is not an indexed event topic: only claim coverage of the pages actually read.
export async function codeHistory(cursor: LogCursor | null = null, snapshot?: number) {
 if (snapshot !== undefined && (!Number.isSafeInteger(snapshot) || snapshot < 0)) throw new Error('Invalid snapshot block.');
 const height = snapshot ?? Number(BigInt(await rpc('eth_blockNumber', [])));
 const cat = await catalog(height);
 const schema = cat.schemas.find(s => s.id === SCHEMAS[3].id && s.current && s.registered);
 if (!schema || schema.definition !== SCHEMAS[3].definition) throw new Error('현재 코드 인증 스키마를 확인할 수 없습니다.');
 const page: Page = await json(schemaHistoryRequest(schema.uid, cursor));
 if (!Array.isArray(page.items) || !Object.hasOwn(page, 'next_page_params')) throw new Error('공개 데이터 서비스 응답 오류. 잠시 후 다시 시도해 주세요.');
 const block = await rpc('eth_getBlockByNumber', ['0x'+height.toString(16), false]);
 if (!block?.timestamp) throw new Error('조회 기준 블록을 확인할 수 없습니다.');
 const at = Number(BigInt(block.timestamp));
 const events = schemaHistoryEvents(page.items, schema.uid, height);
 const values = await batchCalls(events.map(l => ({target: CONTRACTS.EAS, abi: eas, method: 'getAttestation', args: [l.data]})), height);
 const attestations = values.map((v,i) => {
  if (!v || v[0].uid.toLowerCase() !== events[i].data.toLowerCase() || v[0].schema.toLowerCase() !== schema.uid.toLowerCase())
   throw new Error('일부 코드 인증 기록을 확인하지 못했습니다. 다시 조회하세요.');
  const record = normalize(v[0], cat, at);
  if (record.fields.length !== 2) throw new Error('코드 인증 데이터 형식을 확인할 수 없습니다.');
  return {...record, tx: events[i].transaction_hash, block: events[i].block_number};
 });
 return {...cat, checkedAt: new Date(at * 1000).toISOString(), schemaUID: schema.uid, attestations,
  next: historyCursor(page.next_page_params), coverage: '현재 코드 인증 스키마의 불러온 기록만 표시합니다. 전체 발급량이 아닙니다.'};
}
export async function recent(cursor: Record<string, number> | null = null, filter = '') {
 // Read the head after the explorer page so a just-issued record is not queried before its block.
 const page = await logs(CONTRACTS.EAS, cursor);
 let height=await headBlock();if(page.items.some(l=>l.block_number>height))height=parseInt(await rpc('eth_blockNumber',[]),16);const cat=await catalog(height);
 const events = page.items.filter(l => l.topics[0] === id('Attested(address,address,bytes32,bytes32)'));
 const subset = filter ? events.filter(l => l.topics.some(t => t?.toLowerCase().endsWith(filter.toLowerCase().replace(/^0x/, '')))) : events;
 const results = await batchCalls(subset.map(l => ({ target: CONTRACTS.EAS, abi: eas, method: 'getAttestation', args: [l.data] })), cat.block);
 const warnings = [...cat.warnings]; if (results.some(r => !r)) warnings.push('일부 도장의 현재 상태 조회에 실패하여 목록에서 제외했습니다.');
 const attestations = results.flatMap((r, i) => r && r[0].uid !== ZERO ? [{ ...normalize(r[0], cat), tx: subset[i].transaction_hash, block: subset[i].block_number, timestamp: subset[i].block_timestamp }] : []);
 return { ...cat, attestations, next: page.next_page_params, warnings, coverage: '최신 EAS 로그 50개를 조회합니다. 숫자는 조회 범위 내 집계이며 네트워크 전체 통계가 아닙니다.' };
}
export async function attestation(uid: string) {
 if (!/^0x[0-9a-fA-F]{64}$/.test(uid)) throw new Error('32바이트 UID가 필요합니다.'); const cat = await catalog(await headBlock()); const result = await batchCalls([{ target: CONTRACTS.EAS, abi: eas, method: 'getAttestation', args: [uid] }], cat.block); if (!result[0]) throw new Error('EAS에서 도장을 조회하지 못했습니다.'); const raw = result[0][0]; if (raw.uid === ZERO) return null;
 let detail = normalize(raw, cat); if (!detail.fields.length) { const schema = await getSchema(detail.schema, cat.block); if (schema) detail = { ...detail, fields: formatFields(schema.definition, detail.data) }; } return { ...detail, checkedAt: cat.checkedAt, checkedBlock: cat.block };
}
export async function getSchema(uid: string, block?: number) {
 if (!/^0x[0-9a-fA-F]{64}$/.test(uid)) throw new Error('유효한 스키마 UID가 필요합니다.'); const cat = await catalog(block); const found = cat.schemas.find(s => s.uid.toLowerCase() === uid.toLowerCase()); if (found) return found;
 const value = (await batchCalls([{ target: CONTRACTS.SchemaRegistry, abi: registry, method: 'getSchema', args: [uid] }], cat.block))[0]?.[0]; if (!value || value.uid === ZERO) return null;
 return { uid, name: 'EAS Schema', label: '사용자 스키마', category: 'Custom', color: 'blue', description: 'Dojang SchemaBook 외부의 EAS 스키마입니다.', definition: value.schema, resolver: value.resolver, revocable: value.revocable, current: false, registered: true };
}
export async function addressHistory(address: string, role: HistoryRole, cursor: LogCursor | null = null) {
 const request = historyRequest(address, role, cursor);
 const page = await json(request.url);
 if (!Array.isArray(page.items) || !Object.hasOwn(page, 'next_page_params')) throw new Error('공개 데이터 서비스 응답 오류. 잠시 후 다시 시도해 주세요.');
 const events = historyEvents(page.items, request.topic, role);
 let height = await headBlock();
 if (events.some(e => e.block_number > height)) height = parseInt(await rpc('eth_blockNumber', []), 16);
 const cat = await catalog(height);
 const records = await batchCalls(events.map(e => ({ target: CONTRACTS.EAS, abi: eas, method: 'getAttestation', args: [e.data] })), cat.block);
 // Do not advance past a record we failed to hydrate. A retry reuses this cursor.
 if (records.some(r => !r || r[0].uid === ZERO)) throw new Error('일부 도장의 현재 상태를 읽지 못했습니다. 다시 조회하세요.');
 const attestations = await Promise.all(records.map(async (r, i) => {
  let record = normalize(r![0], cat);
  if (record.uid.toLowerCase() !== events[i].data.toLowerCase() || (role === 'issuer' ? record.attester : record.recipient).toLowerCase() !== address.toLowerCase()) throw new Error('발급 기록이 조회한 주소·발행자·스키마와 일치하지 않습니다.');
  if (!record.fields.length) {
   const schema = await getSchema(record.schema, cat.block);
   if (schema) record = { ...record, fields: formatFields(schema.definition, record.data) };
  }
  return { ...record, tx: events[i].transaction_hash, block: events[i].block_number, timestamp: events[i].block_timestamp };
 }));
 return { ...cat, address: getAddress(address), attestations, next: historyCursor(page.next_page_params), coverage: 'EAS 발행 이벤트에서 찾은 기록입니다. 잔액·코드 인증과 과거 발급을 포함하며, 등록 여부와 유효 상태는 현재 기준입니다.' };
}
export async function wallet(address: string) {
 const history = await addressHistory(address, 'recipient');
 const verified = await batchCalls(history.issuers.map(i => ({ target: CONTRACTS.DojangScroll, abi: scroll, method: 'isVerified', args: [getAddress(address), i.id] })), history.block);
 return { ...history, verifiedBy: history.issuers.filter((_, i) => verified[i]?.[0] === true), warnings: [...history.warnings, ...(verified.some(v => !v) ? ['일부 지갑 조회에 실패했습니다.'] : [])] };
}
export async function transaction(hash: string) {
 if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('유효한 트랜잭션 해시가 필요합니다.'); const receipt = await rpc('eth_getTransactionReceipt', [hash]); if (!receipt) return null; const uids = receipt.logs.filter((l: { address: string; topics: string[] }) => l.address.toLowerCase() === CONTRACTS.EAS.toLowerCase() && l.topics[0] === id('Attested(address,address,bytes32,bytes32)')).map((l: { data: string }) => l.data); return { hash, block: parseInt(receipt.blockNumber, 16), success: receipt.status === '0x1', attestations: await Promise.all(uids.slice(0, 50).map(attestation)), truncated: uids.length > 50 };
}
export async function contracts() { const height = await headBlock(); const results = await Promise.allSettled(Object.entries(CONTRACTS).map(async ([name, address]) => ({ name, address, deployed: (await rpc('eth_getCode', [address, '0x' + height.toString(16)])) !== '0x' }))); return { block: height, checkedAt: new Date().toISOString(), contracts: results.map((r, i) => r.status === 'fulfilled' ? r.value : { name: Object.keys(CONTRACTS)[i], address: Object.values(CONTRACTS)[i], deployed: null }) }; }
export async function queryScan(kind: string, params: Record<string,string> = {}): Promise<any> {
 let result: unknown;
 switch(kind){
  case 'overview': result=await cached('overview',20000,()=>recent());break;
  case 'attestations': if((params.cursor?.length??0)>300)throw new Error('페이지 값이 잘못되었습니다.');result=await recent(params.cursor?JSON.parse(params.cursor):null,params.filter??'');break;
  case 'attestation':result=await attestation(params.uid??'');break;
  case 'schema':result=await getSchema(params.uid??'');break;
  case 'schemas':result=await catalog();break;
  case 'wallet':result=await wallet(params.address??'');break;
  case 'history': if((params.cursor?.length??0)>300)throw new Error('페이지 값이 잘못되었습니다.'); result=await addressHistory(params.address??'',params.role as HistoryRole,params.cursor?JSON.parse(params.cursor):null);break;
  case 'transaction':result=await transaction(params.hash??'');break;
  case 'contracts':result=await cached('contracts',60000,contracts);break;
  case 'search':{const value=params.value??'';const schema=await getSchema(value);if(schema)result={type:'schema',record:schema};else{const a=await attestation(value);if(a)result={type:'attestation',record:a};else{const tx=await transaction(value);result=tx?{type:'transaction',record:tx}:null;}}break;}
  default:throw new Error('지원하지 않는 조회입니다.');
 }
 if(result===null)throw new Error('GIWA Sepolia에서 해당 기록을 찾을 수 없습니다.');
 return result;
}
