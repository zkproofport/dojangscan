import type { OnTransactionHandler } from '@metamask/snaps-sdk';
import { Box,Heading,Text,Copyable,Divider,type GenericSnapElement } from '@metamask/snaps-sdk/jsx';
import { Interface } from 'ethers';
import { inspectTransaction } from '../../../lib/transaction-insight';
import { CONTRACTS, NETWORK } from '../../../lib/giwa';
const text=(value:string)=>Text({children:value});
const heading=(value:string)=>Heading({children:value});
const copyable=(value:string)=>Copyable({value});
const divider=()=>Divider({});
const panel=(children:GenericSnapElement[])=>Box({children});
export const onTransaction: OnTransactionHandler = async ({ transaction, chainId }) => {
 const noInsight = (message: string) => ({ content: panel([heading('Dojang Scan · GIWA'), text(message)]) });
 const numericChain = Number(BigInt(chainId.split(':')[1] ?? '0'));
 if(numericChain !== NETWORK.chainId || String(transaction.to).toLowerCase() !== CONTRACTS.EAS.toLowerCase()) return noInsight('This is not a direct GIWA Sepolia EAS call. No attestation insight is provided.');
 try {
  const data = String(transaction.data ?? '0x'); const first = inspectTransaction(CONTRACTS.EAS, numericChain, data);
  const abi = new Interface(['function getSchema(bytes32 uid) view returns ((bytes32 uid,address resolver,bool revocable,string schema))']);
  const response = await fetch(NETWORK.rpc, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:CONTRACTS.SchemaRegistry,data:abi.encodeFunctionData('getSchema',[first.schema])},'latest']}) });
  if(!response.ok) return noInsight('The schema could not be checked. Do not treat unparsed calldata as verified.');
  const rpc = await response.json() as { result?:string;error?:unknown }; if(!rpc.result || rpc.error)return noInsight('Schema lookup failed. Check the attestation before signing.');
  const schema = abi.decodeFunctionResult('getSchema',rpc.result)[0]; const decoded = inspectTransaction(CONTRACTS.EAS,numericChain,data,schema.schema);
  const content=[heading(decoded.action==='attest'?'Issue an attestation':'Revoke an attestation'),text('GIWA Sepolia · chain 91342'),divider(),text('Schema'),copyable(String(decoded.schema))];
  if(decoded.action==='attest') content.push(text('Recipient'),copyable(String(decoded.recipient)),text('Expiration'),text(decoded.expirationTime==='0'?'No expiration':new Date(Number(decoded.expirationTime)*1000).toISOString()),text('Revocable'),text(String(decoded.revocable)),...((decoded.fields??[]).flatMap(f=>[text(f.name),copyable(f.value)])));
  else content.push(text('Attestation UID'),copyable(String(decoded.uid)));
  content.push(divider(),text('Public onchain data. Schema decoding does not establish issuer trust or verify a ZK proof.'));
  return {content:panel(content)};
 } catch { return noInsight('Unsupported or invalid EAS call. Direct attest and revoke are supported; batch, delegated, and resolver calls are not.'); }
};
