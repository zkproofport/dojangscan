import { Signature, TypedDataEncoder, getAddress, verifyTypedData, solidityPackedKeccak256, toUtf8Bytes, ZeroAddress, type TypedDataDomain } from 'ethers';
import { CONTRACTS, NETWORK } from './giwa';
const fields = [{ name:'schema',type:'bytes32' },{ name:'recipient',type:'address' },{ name:'time',type:'uint64' },{ name:'expirationTime',type:'uint64' },{ name:'revocable',type:'bool' },{ name:'refUID',type:'bytes32' },{ name:'data',type:'bytes' }];
export type OffchainExport = { version: number; uid: string; domain: TypedDataDomain; primaryType: string; types: Record<string,{name:string;type:string}[]>; message: Record<string,unknown>; signature: string | { r:string;s:string;v:number }; attester?: string };
export function inspectOffchain(input: unknown, expectedIssuer = '') {
 const outer = input as Record<string,unknown>; const a = (outer?.sig ?? input) as OffchainExport;
 if(!a || !a.domain || !a.message || !a.signature || !a.types || ![0,1,2].includes(a.version)) throw new Error('EAS SDK의 SignedOffchainAttestation JSON (version 0·1·2)이 필요합니다.');
 if(Number(a.domain.chainId)!==NETWORK.chainId || String(a.domain.verifyingContract).toLowerCase()!==CONTRACTS.EAS.toLowerCase()) throw new Error('GIWA Sepolia EAS에 서명된 도장만 확인할 수 있습니다. 다른 체인의 도장은 변환해서 사용할 수 없습니다.');
 if(a.domain.name!=='EAS Attestation' || !a.domain.version) throw new Error('EAS 서명 도메인이 잘못되었습니다.');
 const expectedFields = [...(a.version ? [{name:'version',type:'uint16'}]:[]),...fields,...(a.version===2 ? [{name:'salt',type:'bytes32'}]:[])];
 const primaryTypes=a.version===0 ? ['Attestation','Attest'] : ['Attest'];
 const typeKey=Object.keys(a.types).filter(k=>k!=='EIP712Domain');
 if(!primaryTypes.includes(a.primaryType) || typeKey.length!==1 || JSON.stringify(a.types[typeKey[0]])!==JSON.stringify(expectedFields)) throw new Error('지원하는 EAS 서명 구조와 다릅니다.');
 if(a.version!==0 && Number(a.message.version)!==a.version) throw new Error('도장 버전이 일치하지 않습니다.');
 const m=a.message; const time=BigInt(String(m.time)); const expires=BigInt(String(m.expirationTime));
 if(typeof m.revocable!=='boolean' || time<0 || expires<0) throw new Error('도장의 발급 시각·만료·취소 설정이 잘못되었습니다.');
 const uidTypes=[...(a.version?['uint16']:[]),'bytes','address','address','uint64','uint64','bool','bytes32','bytes',...(a.version===2?['bytes32']:[]),'uint32'];
 // Match EAS SDK Offchain.getOffchainUID, including UTF-8 schema UID and zero bump.
 const uidValues=[...(a.version?[a.version]:[]),toUtf8Bytes(String(m.schema)),m.recipient,ZeroAddress,time,expires,m.revocable,m.refUID,m.data,...(a.version===2?[m.salt]:[]),0];
 const uid=solidityPackedKeccak256(uidTypes,uidValues);
 if(uid.toLowerCase()!==a.uid?.toLowerCase()) throw new Error('EAS UID가 내용과 일치하지 않습니다. 데이터가 변경되었을 수 있습니다.');
 const types={ [typeKey[0]]: a.types[typeKey[0]] }; const sig=typeof a.signature==='string'?a.signature:Signature.from(a.signature).serialized;
 const signer=verifyTypedData(a.domain,types,a.message,sig);
 const claimed=expectedIssuer || a.attester || (typeof outer?.signer==='string'?outer.signer:'');
 if(claimed && getAddress(claimed)!==getAddress(signer)) throw new Error('서명자가 지정한 발행자와 일치하지 않습니다.');
 return {uid,signer,signatureValid:true,expectedIssuerChecked:!!claimed,expired:expires>BigInt(0)&&expires<=BigInt(Math.floor(Date.now()/1000)),futureIssued:time>BigInt(Math.floor(Date.now()/1000)+60),digest:TypedDataEncoder.hash(a.domain,types,a.message),domainVersion:String(a.domain.version),schema:String(m.schema),version:a.version,recipient:String(m.recipient),expirationTime:String(expires),message:a.message};
}
