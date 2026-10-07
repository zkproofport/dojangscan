import { Interface } from 'ethers';
import { prepareProof } from './proof-policy';
import { GIWA_PROOF } from './giwa';
import { rpc } from './scan-data';

export async function verifyProof(response: unknown, scope: string) {
 if (JSON.stringify(response).length > 250000) throw new Error('250KB 이하 proof를 사용해 주세요.');
 const prepared = prepareProof(response, scope);
 const abi = new Interface(['function verify(bytes proof,bytes32[] publicInputs) view returns (bool)']);
 const block = await rpc('eth_blockNumber', []);
 const raw = await rpc('eth_call', [{ to: GIWA_PROOF.verifier, data: abi.encodeFunctionData('verify', [prepared.proof, prepared.publicInputs]) }, block]);
 return { valid: !!abi.decodeFunctionResult('verify', raw)[0], block: parseInt(block,16), verifier: GIWA_PROOF.verifier, signal: prepared.signal, scope: prepared.scope, nullifier: prepared.nullifier, profile: 'CIP-4 test / 128 inputs', warning: '테스트 발행자의 서명과 비공개 주소의 소유를 증명합니다. 실제 Dojang 등록·체인 포함·만료·취소 여부는 증명하지 않습니다.' };
}
