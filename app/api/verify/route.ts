import { Interface } from 'ethers';
import { prepareProof } from '@/lib/proof-policy';
import { GIWA_PROOF } from '@/lib/giwa';
import { rpc } from '@/lib/scan-server';
export async function POST(request: Request) {
 try { if(Number(request.headers.get('content-length')??0)>250000)return Response.json({error:'증명 파일이 너무 큽니다.'},{status:413});const text=await request.text();if(text.length>250000)return Response.json({error:'증명 파일이 너무 큽니다.'},{status:413});const body=JSON.parse(text);const prepared=prepareProof(body.response,body.scope);const abi=new Interface(['function verify(bytes proof,bytes32[] publicInputs) view returns (bool)']);const block=await rpc('eth_blockNumber',[]);const raw=await rpc('eth_call',[{to:GIWA_PROOF.verifier,data:abi.encodeFunctionData('verify',[prepared.proof,prepared.publicInputs])},block]);const valid=!!abi.decodeFunctionResult('verify',raw)[0];return Response.json({valid,block:parseInt(block,16),verifier:GIWA_PROOF.verifier,signal:prepared.signal,scope:prepared.scope,nullifier:prepared.nullifier,profile:'CIP-4 test MockGiwaAttester / 128 public inputs',warning:'실제 Dojang 등록, 체인 포함 여부, freshness, 취소 상태를 증명하는 회로가 아닙니다.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:(e as Error).message},{status:400});}
}
