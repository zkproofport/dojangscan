import { AbiCoder, Interface, id, isAddress, getAddress, ZeroAddress } from 'ethers';
import { CONTRACTS, NETWORK, SCHEMAS, UPBIT_ID, ZERO, type Attestation, type SchemaRecord, type Issuer } from './giwa';
const eas = new Interface(['function getAttestation(bytes32 uid) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))','function getRevokeOffchain(address revoker,bytes32 uid) view returns (uint64)','function getTimestamp(bytes32 uid) view returns (uint64)','function version() view returns (string)']);
const registry = new Interface(['function getSchema(bytes32 uid) view returns ((bytes32 uid,address resolver,bool revocable,string schema))']);
const book = new Interface(['function getSchemaUid(bytes32 id) view returns (bytes32)']);
const issuersABI = new Interface(['function getAttester(bytes32 id) view returns (address)']);
const scroll = new Interface(['function isVerified(address addr,bytes32 attesterId) view returns (bool)']);
const coder = AbiCoder.defaultAbiCoder();
type Log = { topics: (string | null)[]; data: string; transaction_hash: string; block_number: number; block_timestamp: string; decoded?: { method_call: string; parameters: { name: string; value: string }[] } };
type Page = { items: Log[]; next_page_params: Record<string, number> | null };
const cache = new Map<string, { expiry: number; value: unknown }>(); const pending = new Map<string, Promise<unknown>>();
export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
 const existing = cache.get(key); if (existing && existing.expiry > Date.now()) return existing.value as T; if (pending.has(key)) return pending.get(key) as Promise<T>;
 const task = fn().then(value => { cache.set(key, { expiry: Date.now() + ttl, value }); if (cache.size > 200) cache.delete(cache.keys().next().value!); return value; }).finally(() => pending.delete(key)); pending.set(key, task); return task;
}
async function json(url: string, options?: RequestInit): Promise<any> { const response = await fetch(url, { ...options, signal: AbortSignal.timeout(18000) }); if (!response.ok) throw new Error(`공개 데이터 서비스 응답 오류 (${response.status}). 잠시 후 다시 시도해 주세요.`); return response.json(); }
export async function rpc(method: string, params: unknown[]) { const result = await json(NETWORK.rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); if (result.error) throw new Error(`GIWA RPC: ${result.error.message}`); return result.result; }
async function batchCalls(calls: { target: string; abi: Interface; method: string; args: unknown[] }[], block: number) {
 if (!calls.length) return [];
 const output = await json(NETWORK.rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: 'eth_call', params: [{ to: c.target, data: c.abi.encodeFunctionData(c.method, c.args) }, '0x' + block.toString(16)] }))) });
 if (!Array.isArray(output)) throw new Error('RPC 일괄 조회 응답을 읽을 수 없습니다.');
 return calls.map((c, i) => { const item = output.find(r => r.id === i); if (!item || item.error) return null; try { return c.abi.decodeFunctionResult(c.method, item.result); } catch { return null; } });
}
function cursorParams(cursor: Record<string, number> | null) { const params = new URLSearchParams(); if (cursor) for (const [key, value] of Object.entries(cursor)) if (['index', 'block_number', 'items_count'].includes(key) && Number.isSafeInteger(value) && value >= 0) params.set(key, String(value)); return params; }
async function logs(address: string, cursor: Record<string, number> | null = null): Promise<Page> { return json(`${NETWORK.explorer}/api/v2/addresses/${address}/logs?${cursorParams(cursor)}`); }
async function discovery(address: string) { const items: Log[] = []; let next: Record<string, number> | null = null; for (let i = 0; i < 6; i++) { const page = await logs(address, next); items.push(...page.items); next = page.next_page_params; if (!next) break; } return { items, complete: !next }; }
function getParam(log: Log, name: string) { return log.decoded?.parameters.find(p => p.name === name)?.value; }
function formatFields(definition: string, data: string) { try { const fields = definition.split(',').map(v => v.trim().split(/\s+/)); const values = coder.decode(fields.map(v => v[0]), data); return fields.map(([type, name], i) => ({ name, type, value: Array.isArray(values[i]) ? JSON.stringify(Array.from(values[i], String)) : String(values[i]) })); } catch { return []; } }
export async function catalog(block?: number) {
 return cached(`catalog:${block ?? 'latest'}`, 60000, async () => {
  const height = block ?? parseInt(await rpc('eth_blockNumber', []), 16);
  const [schemaLogs, issuerLogs] = await Promise.all([discovery(CONTRACTS.SchemaBook), discovery(CONTRACTS.DojangAttesterBook)]);
  const schemaIDs = [...new Set<string>([...SCHEMAS.map(s => s.id), ...schemaLogs.items.map(l => getParam(l, 'schemaId')).filter((v): v is string => !!v)])];
  const issuerIDs = [...new Set([UPBIT_ID, ...issuerLogs.items.map(l => getParam(l, 'attesterId')).filter((v): v is string => !!v)])];
  const current = await batchCalls([...schemaIDs.map(key => ({ target: CONTRACTS.SchemaBook, abi: book, method: 'getSchemaUid', args: [key] })), ...issuerIDs.map(key => ({ target: CONTRACTS.DojangAttesterBook, abi: issuersABI, method: 'getAttester', args: [key] }))], height);
  const warnings: string[] = []; if (!schemaLogs.complete || !issuerLogs.complete) warnings.push('관리 컨트랙트의 최근 300개 로그에서 발견한 목록입니다. 전체 등록 목록이 아닐 수 있습니다.'); if (current.some(v => !v)) warnings.push('일부 관리 컨트랙트 조회에 실패했습니다. 확인되지 않은 발행자는 등록 여부를 보장하지 않습니다.');
  const uidMap = new Map<string, { id?: string; current: boolean }>(); schemaIDs.forEach((schemaID, i) => { const uid = current[i]?.[0]; if (uid && uid !== ZERO) uidMap.set(uid.toLowerCase(), { id: schemaID, current: true }); });
  for (const s of SCHEMAS) if (!uidMap.has(s.uid)) uidMap.set(s.uid, { id: s.id, current: false });
  for (const l of schemaLogs.items) { const uid = getParam(l, 'easSchemaUid'); if (uid && !uidMap.has(uid.toLowerCase())) uidMap.set(uid.toLowerCase(), { id: getParam(l, 'schemaId'), current: false }); }
  const uids = [...uidMap.keys()]; const schemaValues = await batchCalls(uids.map(uid => ({ target: CONTRACTS.SchemaRegistry, abi: registry, method: 'getSchema', args: [uid] })), height);
  const schemas: SchemaRecord[] = uids.map((uid, i) => { const info = SCHEMAS.find(s => s.id === uidMap.get(uid)?.id || s.uid === uid); const value = schemaValues[i]?.[0]; return { uid, ...uidMap.get(uid)!, name: info?.name ?? 'Custom Dojang', label: info?.label ?? '확장 스키마', category: info?.category ?? 'Custom', color: info?.color ?? 'blue', description: info?.description ?? 'SchemaBook에서 발견한 확장 스키마입니다.', definition: value?.schema ?? '', resolver: value?.resolver ?? ZeroAddress, revocable: !!value?.revocable, registered: !!value && value.uid !== ZERO }; });
  const issuers: Issuer[] = issuerIDs.flatMap((attesterID, i) => { const address = current[schemaIDs.length + i]?.[0]; if (!address || address === ZeroAddress) return []; const log = issuerLogs.items.find(l => getParam(l, 'attesterId') === attesterID); return [{ id: attesterID, address, name: attesterID === UPBIT_ID ? 'UPbit Korea' : 'Registered attester', tx: log?.transaction_hash ?? '' }]; });
  return { block: height, schemas, issuers, warnings, checkedAt: new Date().toISOString() };
 });
}
// The EAS tuple is decoded by ethers from the fixed contract ABI.
function normalize(raw: { uid: string; schema: string; recipient: string; attester: string; time: bigint; expirationTime: bigint; revocationTime: bigint; revocable: boolean; refUID: string; data: string }, cat: Awaited<ReturnType<typeof catalog>>): Attestation {
 const schema = cat.schemas.find(s => s.uid === String(raw.schema).toLowerCase()); const issuer = cat.issuers.find(i => i.address.toLowerCase() === raw.attester.toLowerCase()); const expirationTime = Number(raw.expirationTime); const revocationTime = Number(raw.revocationTime);
 return { uid: raw.uid, schema: raw.schema, recipient: raw.recipient, attester: raw.attester, time: Number(raw.time), expirationTime, revocationTime, revocable: raw.revocable, refUID: raw.refUID, data: raw.data, status: revocationTime > 0 ? 'revoked' : expirationTime > 0 && expirationTime <= Date.now() / 1000 ? 'expired' : 'active', fields: schema ? formatFields(schema.definition, raw.data) : [], schemaName: schema?.name ?? 'Other EAS', dojang: !!schema, registeredIssuer: !!issuer, issuerName: issuer?.name ?? 'Unlisted issuer' };
}
export async function recent(cursor: Record<string, number> | null = null, filter = '') {
 // Read the head after the explorer page so a just-issued record is not queried before its block.
 const [base, page] = await Promise.all([catalog(), logs(CONTRACTS.EAS, cursor)]);
 const height = parseInt(await rpc('eth_blockNumber', []), 16); const cat = { ...base, block: height, checkedAt: new Date().toISOString() };
 const events = page.items.filter(l => l.topics[0] === id('Attested(address,address,bytes32,bytes32)'));
 const subset = filter ? events.filter(l => l.topics.some(t => t?.toLowerCase().endsWith(filter.toLowerCase().replace(/^0x/, '')))) : events;
 const results = await batchCalls(subset.map(l => ({ target: CONTRACTS.EAS, abi: eas, method: 'getAttestation', args: [l.data] })), cat.block);
 const warnings = [...cat.warnings]; if (results.some(r => !r)) warnings.push('일부 도장의 현재 상태 조회에 실패하여 목록에서 제외했습니다.');
 const attestations = results.flatMap((r, i) => r && r[0].uid !== ZERO ? [{ ...normalize(r[0], cat), tx: subset[i].transaction_hash, block: subset[i].block_number, timestamp: subset[i].block_timestamp }] : []);
 return { ...cat, attestations, next: page.next_page_params, warnings, coverage: '최신 EAS 로그 50개를 조회합니다. 숫자는 조회 범위 내 집계이며 네트워크 전체 통계가 아닙니다.' };
}
export async function attestation(uid: string) {
 if (!/^0x[0-9a-fA-F]{64}$/.test(uid)) throw new Error('32바이트 UID가 필요합니다.'); const cat = await catalog(); const result = await batchCalls([{ target: CONTRACTS.EAS, abi: eas, method: 'getAttestation', args: [uid] }], cat.block); if (!result[0]) throw new Error('EAS에서 도장을 조회하지 못했습니다.'); const raw = result[0][0]; if (raw.uid === ZERO) return null;
 let detail = normalize(raw, cat); if (!detail.fields.length) { const schema = await getSchema(detail.schema, cat.block); if (schema) detail = { ...detail, fields: formatFields(schema.definition, detail.data) }; } return { ...detail, checkedAt: cat.checkedAt, checkedBlock: cat.block };
}
export async function getSchema(uid: string, block?: number) {
 if (!/^0x[0-9a-fA-F]{64}$/.test(uid)) throw new Error('유효한 스키마 UID가 필요합니다.'); const cat = await catalog(block); const found = cat.schemas.find(s => s.uid.toLowerCase() === uid.toLowerCase()); if (found) return found;
 const value = (await batchCalls([{ target: CONTRACTS.SchemaRegistry, abi: registry, method: 'getSchema', args: [uid] }], cat.block))[0]?.[0]; if (!value || value.uid === ZERO) return null;
 return { uid, name: 'EAS Schema', label: '사용자 스키마', category: 'Custom', color: 'blue', description: 'Dojang SchemaBook 외부의 EAS 스키마입니다.', definition: value.schema, resolver: value.resolver, revocable: value.revocable, current: false, registered: true };
}
export async function wallet(address: string) {
 if (!isAddress(address)) throw new Error('유효한 지갑 주소를 입력해 주세요.'); const cat = await catalog(); const verified = await batchCalls(cat.issuers.map(i => ({ target: CONTRACTS.DojangScroll, abi: scroll, method: 'isVerified', args: [getAddress(address), i.id] })), cat.block);
 const indexer = new Interface(['function getAttestationUid(bytes32 schemaUid,address attester,address recipient) view returns (bytes32)']); const schemas = cat.schemas.filter(s => s.current && s.registered); const lookups = schemas.flatMap(s => cat.issuers.map(i => ({ target: CONTRACTS.AttestationIndexer, abi: indexer, method: 'getAttestationUid', args: [s.uid, i.address, getAddress(address)] }))); const found = await batchCalls(lookups, cat.block); const uids = [...new Set(found.flatMap(v => v && v[0] !== ZERO ? [String(v[0])] : []))]; const records = await batchCalls(uids.map(uid => ({ target: CONTRACTS.EAS, abi: eas, method: 'getAttestation', args: [uid] })), cat.block);
 return { ...cat, address: getAddress(address), attestations: records.flatMap(v => v ? [normalize(v[0], cat)] : []), verifiedBy: cat.issuers.filter((_, i) => verified[i]?.[0] === true), warnings: [...cat.warnings, ...(found.some(v => !v) || verified.some(v => !v) ? ['일부 지갑 조회에 실패했습니다.'] : [])], coverage: '현재 스키마·등록 발행자의 key=0인 최신 도장입니다. 별도 key를 사용하는 잔액 도장과 이전 이력은 제외됩니다.' };
}
export async function transaction(hash: string) {
 if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('유효한 트랜잭션 해시가 필요합니다.'); const receipt = await rpc('eth_getTransactionReceipt', [hash]); if (!receipt) return null; const uids = receipt.logs.filter((l: { address: string; topics: string[] }) => l.address.toLowerCase() === CONTRACTS.EAS.toLowerCase() && l.topics[0] === id('Attested(address,address,bytes32,bytes32)')).map((l: { data: string }) => l.data); return { hash, block: parseInt(receipt.blockNumber, 16), success: receipt.status === '0x1', attestations: await Promise.all(uids.slice(0, 50).map(attestation)), truncated: uids.length > 50 };
}
export async function contracts() { const height = parseInt(await rpc('eth_blockNumber', []), 16); const results = await Promise.allSettled(Object.entries(CONTRACTS).map(async ([name, address]) => ({ name, address, deployed: (await rpc('eth_getCode', [address, '0x' + height.toString(16)])) !== '0x' }))); return { block: height, checkedAt: new Date().toISOString(), contracts: results.map((r, i) => r.status === 'fulfilled' ? r.value : { name: Object.keys(CONTRACTS)[i], address: Object.values(CONTRACTS)[i], deployed: null }) }; }
export async function offchainStatus(issuer: string, uid: string) {
 if (!isAddress(issuer) || !/^0x[0-9a-fA-F]{64}$/.test(uid)) throw new Error('발행자 주소와 UID를 확인해 주세요.'); const cat = await catalog(); const values = await batchCalls([{ target: CONTRACTS.EAS, abi: eas, method: 'getRevokeOffchain', args: [issuer, uid] }, { target: CONTRACTS.EAS, abi: eas, method: 'getTimestamp', args: [uid] }, { target: CONTRACTS.EAS, abi: eas, method: 'version', args: [] }], cat.block); if (values.some(v => !v)) throw new Error('오프체인 취소 상태를 조회하지 못했습니다.'); return { block: cat.block, checkedAt: cat.checkedAt, revocationTime: Number(values[0]![0]), timestamp: Number(values[1]![0]), easVersion: String(values[2]![0]), registeredIssuer: cat.issuers.some(i => i.address.toLowerCase() === issuer.toLowerCase()) };
}
