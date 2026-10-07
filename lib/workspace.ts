import { AbiCoder, Interface, ParamType, ZeroAddress, ZeroHash, getAddress, isHexString, solidityPackedKeccak256, type Signer, Signature, toUtf8Bytes } from 'ethers';
import { CONTRACTS, NETWORK } from './giwa';
import { rpc } from './scan-data';
import { inspectOffchain } from './offchain';

export const BOOK_ABI = ['function register(bytes32,address)', 'function unregister(bytes32)', 'function getAttester(bytes32) view returns(address)', 'function hasRole(bytes32,address) view returns(bool)', 'function getRoleAdmin(bytes32) view returns(bytes32)', 'function grantRole(bytes32,address)'];
const schemaBook = new Interface(['function register(bytes32,bytes32)']);
const book = new Interface(BOOK_ABI);
const registry = new Interface(['function register(string,address,bool) returns(bytes32)']);
const eas = new Interface(['function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) payable returns(bytes32)', 'function revoke((bytes32 schema,(bytes32 uid,uint256 value) data)) payable']);
export type PreparedCall = { chainId: number; to: string; data: string; value: string; operation: string };
function uid(v:string) { if(!isHexString(v,32)||v===ZeroHash)throw new Error('Enter a nonzero bytes32 ID.');return v; }
function address(v:string) { const a=getAddress(v);if(a===ZeroAddress)throw new Error('Enter a nonzero address.');return a; }
function uint64(v:string) { if(!/^\d+$/.test(v)||BigInt(v)>2n**64n-1n)throw new Error('Enter a uint64 timestamp.');return BigInt(v); }
export function encodeFields(definition:string, values:string) { const types=definition.split(',').map(s=>ParamType.from(s.trim()));if(!types.length||types.some(t=>!t.name))throw new Error('Use named ABI fields.'); const parsed:unknown=JSON.parse(values);if(!Array.isArray(parsed)||parsed.length!==types.length)throw new Error('Provide one JSON array value per schema field.');return AbiCoder.defaultAbiCoder().encode(types,parsed); }
export function prepareCall(operation:string, input:{definition:string;values:string;recipient:string;schema:string;id:string;target:string;role:string;expiration:string;book:string}):PreparedCall {
 let to:string=CONTRACTS.EAS,data:string;
 switch(operation){
 case 'schema':to=CONTRACTS.SchemaRegistry;encodeFields(input.definition,input.values);data=registry.encodeFunctionData('register',[input.definition,ZeroAddress,true]);break;
 case 'attest':data=eas.encodeFunctionData('attest',[{schema:uid(input.schema),data:{recipient:address(input.recipient),expirationTime:uint64(input.expiration),revocable:true,refUID:ZeroHash,data:encodeFields(input.definition,input.values),value:0}}]);break;
 case 'revoke':data=eas.encodeFunctionData('revoke',[{schema:uid(input.schema),data:{uid:uid(input.id),value:0}}]);break;
 case 'issuer':to=CONTRACTS.DojangAttesterBook;data=book.encodeFunctionData('register',[uid(input.id),address(input.target)]);break;
 case 'book-schema':to=CONTRACTS.SchemaBook;data=schemaBook.encodeFunctionData('register',[uid(input.id),uid(input.schema)]);break;
 case 'grant':to=input.book==='SchemaBook'?CONTRACTS.SchemaBook:CONTRACTS.DojangAttesterBook;data=book.encodeFunctionData('grantRole',[isHexString(input.role,32)?input.role:uid(input.role),address(input.target)]);break;
 default:throw new Error('Unsupported operation.');
 }
 return {chainId:NETWORK.chainId,to,data,value:'0x0',operation};
}
export async function inspectCapabilities(caller:string, attesterId:string, role=ZeroHash) {
 caller=address(caller);if(!isHexString(role,32))throw new Error('Enter a bytes32 role.');
 const block=await rpc('eth_blockNumber',[]);const results=[];
 for(const [name,to] of [['SchemaBook',CONTRACTS.SchemaBook],['DojangAttesterBook',CONTRACTS.DojangAttesterBook]]){
  const read=async(fn:string,args:unknown[])=>book.decodeFunctionResult(fn,await rpc('eth_call',[{to,data:book.encodeFunctionData(fn,args)},block]))[0];
  const roleAdmin=String(await read('getRoleAdmin',[role]));
  results.push({contract:name,address:to,registrationAdmin:Boolean(await read('hasRole',[ZeroHash,caller])),role,roleAdmin,canGrantRole:Boolean(await read('hasRole',[roleAdmin,caller]))});
 }
 const registered=attesterId?String(book.decodeFunctionResult('getAttester',await rpc('eth_call',[{to:CONTRACTS.DojangAttesterBook,data:book.encodeFunctionData('getAttester',[uid(attesterId)])},block]))[0]):null;
 return {caller,block:Number(BigInt(block)),callerIsContract:await rpc('eth_getCode',[caller,block])!=='0x',books:results,registeredAddress:registered,registeredAddressMatches:registered?.toLowerCase()===caller.toLowerCase()};
}
export async function simulateCall(call:PreparedCall, caller:string) {
 caller=address(caller);const block=await rpc('eth_blockNumber',[]);
 // eth_call can impersonate a contract; do not present that as wallet authority.
 if(await rpc('eth_getCode',[caller,block])!=='0x')throw new Error('This address is a contract. Prepare calldata for its own execution flow; a wallet cannot send from this address.');
 const result=await rpc('eth_call',[{from:caller,to:call.to,data:call.data,value:call.value},block]);
 return {success:true,block:Number(BigInt(block)),from:caller,result,sent:false};
}
export async function signOffchain(signer:Signer, definition:string, values:string, recipient:string, expiration:string) {
 const version=2;const time=Math.floor(Date.now()/1000);const expirationTime=uint64(expiration);if(expirationTime!==0n&&expirationTime<=BigInt(time))throw new Error('Expiration must be in the future.');
 const schema=solidityPackedKeccak256(['string','address','bool'],[definition,ZeroAddress,true]);const data=encodeFields(definition,values);const schemaVersion=new Interface(['function version() view returns(string)']);
 const raw=await rpc('eth_call',[{to:CONTRACTS.EAS,data:schemaVersion.encodeFunctionData('version')},'latest']);
 const domain={name:'EAS Attestation',version:String(schemaVersion.decodeFunctionResult('version',raw)[0]),chainId:NETWORK.chainId,verifyingContract:CONTRACTS.EAS};
 const types={Attest:[{name:'version',type:'uint16'},{name:'schema',type:'bytes32'},{name:'recipient',type:'address'},{name:'time',type:'uint64'},{name:'expirationTime',type:'uint64'},{name:'revocable',type:'bool'},{name:'refUID',type:'bytes32'},{name:'data',type:'bytes'},{name:'salt',type:'bytes32'}]};
 const message={version,schema,recipient:address(recipient),time,expirationTime:expirationTime.toString(),revocable:true,refUID:ZeroHash,data,salt:'0x'+Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')};
 const attester=await signer.getAddress();const signature=Signature.from(await signer.signTypedData(domain,types,message)).toJSON();
 const signedUid=solidityPackedKeccak256(['uint16','bytes','address','address','uint64','uint64','bool','bytes32','bytes','bytes32','uint32'],[version,toUtf8Bytes(schema),message.recipient,ZeroAddress,time,expirationTime,true,ZeroHash,data,message.salt,0]);
 return {version,uid:signedUid,domain,primaryType:'Attest',types,message,signature,attester};
}
export function evaluateBalancePlan(json:string, issuer:string, threshold:string, scope:string) {
 if(!issuer.trim())throw new Error('Choose the issuer you intend to trust.');if(!/^\d+$/.test(threshold)||BigInt(threshold)<=0n)throw new Error('Enter a positive threshold.');if(!scope.trim())throw new Error('Enter a scope.');
 const source=inspectOffchain(JSON.parse(json),address(issuer));
 const definition='uint256 balanceKRW';const expected=solidityPackedKeccak256(['string','address','bool'],[definition,ZeroAddress,true]);
 if(String(source.message.schema).toLowerCase()!==expected.toLowerCase())throw new Error('This example requires the uint256 balanceKRW schema.');
 if(source.expired||source.futureIssued)throw new Error('The source is expired or has a future issue time.');
 const amount=BigInt(AbiCoder.defaultAbiCoder().decode(['uint256'],String(source.message.data))[0]);
 return {localConditionMet:amount>=BigInt(threshold),zkProofGenerated:false,onchainRegistered:false,sourceRevocationChecked:false,plan:{version:1,chainId:NETWORK.chainId,pattern:'offchain-proof-onchain',predicate:{field:'balanceKRW',operator:'>=',threshold},scope,sourceSchema:expected,issuerPolicy:{expectedSigner:issuer,authorizationRootRequired:true},privateInputs:['signedCredential','holderAuthorization'],publicInputs:['predicate','scope','recipient','issuerRoot','revocationRoot','epoch','nullifier','validUntil'],requiredChecks:['EIP-712 signature and domain','trusted issuer membership','holder authorization','predicate','expiration','fresh non-revocation root','chain and registry binding','scope-bound nullifier'],derivedSchema:'bytes32 profileId,bytes32 predicateHash,bytes32 scope,bytes32 nullifier,uint64 revocationEpoch',implementation:{circuit:'missing',adapter:'missing',registry:'draft-not-deployed'}}};
}
