import { AbiCoder, Interface, Wallet, Signature, ZeroAddress, ZeroHash, solidityPackedKeccak256, toUtf8Bytes } from 'ethers';
import { CONTRACTS, NETWORK } from './giwa';
import { rpc } from './scan-data';
import { EAS_WRITE_ABI } from './eas-calldata';

export const TEST_SCHEMA = 'bool completedCourse';
export function testRecipe(recipient: string) {
 const schema = solidityPackedKeccak256(['string','address','bool'],[TEST_SCHEMA,ZeroAddress,true]);
 const registry = new Interface(['function register(string schema,address resolver,bool revocable) returns (bytes32)']);
 const eas = new Interface(EAS_WRITE_ABI);
 return {schema,definition:TEST_SCHEMA,register:{to:CONTRACTS.SchemaRegistry,data:registry.encodeFunctionData('register',[TEST_SCHEMA,ZeroAddress,true])},attest:{to:CONTRACTS.EAS,data:eas.encodeFunctionData('attest',[{schema,data:{recipient,expirationTime:0,revocable:true,refUID:ZeroHash,data:AbiCoder.defaultAbiCoder().encode(['bool'],[true]),value:0}}])}};
}
export async function createOffchainExample() {
 // Ephemeral demo signer. The private key is never exported or persisted.
 const signer=Wallet.createRandom();const abi=new Interface(['function version() view returns (string)']);
 const raw=await rpc('eth_call',[{to:CONTRACTS.EAS,data:abi.encodeFunctionData('version')},'latest']);
 const definition='uint256 balanceKRW';const schema=solidityPackedKeccak256(['string','address','bool'],[definition,ZeroAddress,true]);
 const now=Math.floor(Date.now()/1000);const version=2;
 const message={version,schema,recipient:signer.address,time:now,expirationTime:now+3600,revocable:true,refUID:ZeroHash,data:AbiCoder.defaultAbiCoder().encode(['uint256'],[1000000]),salt:'0x'+Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')};
 const types={Attest:[{name:'version',type:'uint16'},{name:'schema',type:'bytes32'},{name:'recipient',type:'address'},{name:'time',type:'uint64'},{name:'expirationTime',type:'uint64'},{name:'revocable',type:'bool'},{name:'refUID',type:'bytes32'},{name:'data',type:'bytes'},{name:'salt',type:'bytes32'}]};
 const domain={name:'EAS Attestation',version:String(abi.decodeFunctionResult('version',raw)[0]),chainId:NETWORK.chainId,verifyingContract:CONTRACTS.EAS};
 const uid=solidityPackedKeccak256(['uint16','bytes','address','address','uint64','uint64','bool','bytes32','bytes','bytes32','uint32'],[version,toUtf8Bytes(schema),message.recipient,ZeroAddress,now,message.expirationTime,true,ZeroHash,message.data,message.salt,0]);
 return {version,uid,domain,primaryType:'Attest',types,message,signature:Signature.from(await signer.signTypedData(domain,types,message)).toJSON(),attester:signer.address};
}
