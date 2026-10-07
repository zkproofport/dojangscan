import { Interface, ZeroAddress, getAddress, id } from "ethers";
import { rpc } from "./scan-data";
import { CONTRACTS, NETWORK } from "./giwa";
import {
  BALANCE_PROFILE,
  validateProofEnvelope,
  type BalanceProof,
} from "./balance-proof";
import type { PreparedCall } from "./workspace";
export const RECEIPT_DEFINITION =
  "bytes32 profileId,address sourceIssuer,uint128 threshold,bytes32 scope,bytes32 nullifier,bool sourceRevocationProven";
const abi = new Interface([
  "function PROFILE() view returns(bytes32)",
  "function expectedIssuer() view returns(address)",
  "function expectedDomain() view returns(bytes32)",
  "function expectedScope() view returns(bytes32)",
  "function minimumThreshold() view returns(uint128)",
  "function vkHash() view returns(bytes32)",
  "function circuitHash() view returns(bytes32)",
  "function eas() view returns(address)",
  "function receiptSchema() view returns(bytes32)",
  "function receipts(bytes32) view returns(bytes32)",
  "function registerProof(bytes,bytes32[]) returns(bytes32)",
]);
export async function prepareBalanceRegistration(
  proof: BalanceProof,
  caller: string,
): Promise<PreparedCall> {
  validateProofEnvelope(proof);
  const s = proof.statement,
    to = getAddress(s.registry);
  if (to === ZeroAddress)
    throw new Error(
      "Generate the proof again with a deployed BalanceProofReceipt address.",
    );
  if (getAddress(caller) !== getAddress(s.recipient))
    throw new Error(
      "Only the source recipient wallet can register this proof.",
    );
  if ((await rpc("eth_getCode", [to, "latest"])) === "0x")
    throw new Error("Receipt contract is not deployed on GIWA Sepolia.");
  const read = async (fn: string) =>
    abi.decodeFunctionResult(
      fn,
      await rpc("eth_call", [
        { to, data: abi.encodeFunctionData(fn) },
        "latest",
      ]),
    )[0];
  for (const [fn, expected] of [
    ["PROFILE", id(BALANCE_PROFILE)],
    ["expectedIssuer", s.issuer],
    ["expectedDomain", s.domainSeparator],
    ["expectedScope", s.scope],
    ["vkHash", proof.vkHash],
    ["circuitHash", proof.circuitHash],
    ["eas", CONTRACTS.EAS],
  ]) {
    if (String(await read(fn)).toLowerCase() !== expected.toLowerCase())
      throw new Error(`Receipt policy mismatch: ${fn}`);
  }
  if (BigInt(await read("minimumThreshold")) > BigInt(s.threshold))
    throw new Error("Proof threshold is below the registry policy.");
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (
    BigInt(s.expiration) <= now ||
    BigInt(s.issuedAt) > now ||
    BigInt(s.expiration) - BigInt(s.issuedAt) > 86400n
  )
    throw new Error(
      "Receipt requires a current source valid for at most one day.",
    );
  const schema = String(await read("receiptSchema"));
  const schemaABI = new Interface([
    "function getSchema(bytes32) view returns((bytes32 uid,address resolver,bool revocable,string schema))",
  ]);
  const [record] = schemaABI.decodeFunctionResult(
    "getSchema",
    await rpc("eth_call", [
      {
        to: CONTRACTS.SchemaRegistry,
        data: schemaABI.encodeFunctionData("getSchema", [schema]),
      },
      "latest",
    ]),
  );
  if (
    record.schema !== RECEIPT_DEFINITION ||
    record.resolver !== ZeroAddress ||
    record.revocable
  )
    throw new Error("Receipt schema configuration mismatch.");
  return {
    chainId: NETWORK.chainId,
    to,
    data: abi.encodeFunctionData("registerProof", [
      proof.proof,
      proof.publicInputs,
    ]),
    value: "0x0",
    operation: "registerProof",
  };
}
