import { Interface, AbiCoder } from 'ethers';
import { CONTRACTS, NETWORK } from './giwa';
export const EAS_WRITE_ABI=['function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data) request) payable returns (bytes32)','function revoke((bytes32 schema,(bytes32 uid,uint256 value) data) request) payable'];
export function inspectTransaction(to: string, chainId: number, data: string, schemaDefinition?: string) {
 if(chainId!==NETWORK.chainId || to.toLowerCase()!==CONTRACTS.EAS.toLowerCase())throw new Error('GIWA Sepolia EAS로 보내는 트랜잭션만 해석합니다.');
 const tx=new Interface(EAS_WRITE_ABI).parseTransaction({data});if(!tx)throw new Error('attest 또는 revoke calldata가 필요합니다.');const request=tx.args[0];
 if(tx.name==='revoke')return {action:'revoke',schema:request.schema,uid:request.data.uid,value:String(request.data.value)};
 const r=request.data;let fields:{name:string;value:string}[]=[];
 if(schemaDefinition){const parts=schemaDefinition.split(',').map(s=>s.trim().split(/\s+/));const values=AbiCoder.defaultAbiCoder().decode(parts.map(p=>p[0]),r.data);fields=parts.map((p,i)=>({name:p[1],value:String(values[i])}));}
 return {action:'attest',schema:request.schema,recipient:r.recipient,expirationTime:String(r.expirationTime),revocable:r.revocable,refUID:r.refUID,data:r.data,value:String(r.value),fields};
}
