import { keccak256, toUtf8Bytes, zeroPadValue } from 'ethers';
import { GIWA_PROOF, NETWORK } from './giwa';
export const GIWA_SIGNER_ROOT=keccak256('0xee099845cdff93e73adcbcb36a9b93578bcced4b');
export function prepareProof(input: unknown, expectedScope: string) {
 const a=input as {circuit?:string;chainId?:number;verifierAddress?:string;proof?:string;publicInputs?:string[];status?:string};
 if(!expectedScope || expectedScope.length>500)throw new Error('검증할 scope를 입력해 주세요.');
 if(a?.circuit!=='giwa_attestation' || a.chainId!==NETWORK.chainId || a.verifierAddress?.toLowerCase()!==GIWA_PROOF.verifier.toLowerCase())throw new Error('고정된 CIP-4 128-input GIWA Sepolia 프로필과 일치하지 않습니다.');
 if(a.status!=='completed' || !a.proof || !/^0x(?:[0-9a-f]{2})+$/i.test(a.proof) || a.proof.length>200000)throw new Error('완료된 proof가 필요합니다.');
 if(!Array.isArray(a.publicInputs) || a.publicInputs.length!==128)throw new Error('이 프로필은 공개 입력 128개를 사용합니다. 다른 GIWA 회로 버전은 별도 프로필이 필요합니다.');
 const values=a.publicInputs.map(v=>{if(typeof v!=='string'||!/^0x[0-9a-f]{1,64}$/i.test(v)||BigInt(v)>BigInt(255))throw new Error('공개 입력에 유효한 byte 값이 아닌 항목이 있습니다.');return zeroPadValue('0x'+BigInt(v).toString(16).padStart(2,'0'),32);});
 const bytes=(offset:number)=>'0x'+values.slice(offset,offset+32).map(v=>v.slice(-2)).join('');
 if(bytes(32)!==GIWA_SIGNER_ROOT)throw new Error('현재 테스트 발행자 signer root와 일치하지 않습니다.');
 if(bytes(64)!==keccak256(toUtf8Bytes(expectedScope)))throw new Error('증명이 요청한 scope와 다릅니다.');
 return {proof:a.proof,publicInputs:values,signal:bytes(0),signerRoot:bytes(32),scope:bytes(64),nullifier:bytes(96)};
}
