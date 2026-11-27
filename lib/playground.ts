import {
  Interface,
  ZeroAddress,
  getAddress,
  isAddress,
} from "ethers";
import { CONTRACTS, SCHEMAS, ZERO } from "./giwa";
import { PLAYGROUND_ATTESTER_ID } from "./issuer-metadata";
import { rpc } from "./scan-data";

export const PLAYGROUND_LINKS = {
  playground: "https://sepolia-playground.giwa.io/",
  guide: "https://docs.giwa.io/giwa-chain/en/get-started/giwa-playground",
  faucet: "https://docs.giwa.io/giwa-chain/en/get-started/faucets",
};
const abi = new Interface([
  "function getAttester(bytes32) view returns (address)",
  "function getSchemaUid(bytes32) view returns (bytes32)",
  "function getSchema(bytes32) view returns ((bytes32 uid,address resolver,bool revocable,string schema))",
  "function getAttestationUid(bytes32,address,address) view returns (bytes32)",
  "function getAttestation(bytes32) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))",
]);
type RawRecord = {
  uid: string;
  schema: string;
  recipient: string;
  attester: string;
  expirationTime: bigint;
  revocationTime: bigint;
  data: string;
};
export type PlaygroundStatus =
  | "confirmed"
  | "not-found"
  | "revoked"
  | "expired"
  | "unverified";
export type PlaygroundResult = {
  address: string;
  issuer: string;
  schema: string;
  uid: string;
  block: number;
  status: PlaygroundStatus;
};
// A successful lookup must match this recipient and the current Book entries.
// Issuer name, a nonzero UID, or a successful external link click are not evidence.
export function playgroundStatus(
  record: RawRecord,
  expected: { uid: string; address: string; issuer: string; schema: string },
  now: number,
): PlaygroundStatus {
  if (
    [
      [record.uid, expected.uid],
      [record.recipient, expected.address],
      [record.attester, expected.issuer],
      [record.schema, expected.schema],
    ].some(([actual, wanted]) => actual.toLowerCase() !== wanted.toLowerCase())
  ) {
    throw new Error(
      "발급 기록이 조회한 주소·발행자·스키마와 일치하지 않습니다.",
    );
  }
  if (record.revocationTime > 0n) return "revoked";
  if (record.expirationTime > 0n && record.expirationTime <= BigInt(now))
    return "expired";
  // A bool must be exactly one ABI word containing 0 or 1. ethers' decoder
  // otherwise accepts other nonzero words as true and ignores trailing data.
  if (!/^0x0{63}[01]$/.test(record.data))
    throw new Error("주소 인증 데이터를 해석할 수 없습니다.");
  return record.data.endsWith("1") ? "confirmed" : "unverified";
}
export async function checkPlaygroundAttestation(
  input: string,
): Promise<PlaygroundResult> {
  if (!isAddress(input.trim()))
    throw new Error("유효한 지갑 주소를 입력해 주세요.");
  const address = getAddress(input.trim());
  // Bypass cached catalog/head data after issuance. Pin all reads to this block.
  const blockTag: string = await rpc("eth_blockNumber", []);
  async function read(target: string, method: string, args: unknown[]) {
    const raw = await rpc("eth_call", [
      { to: target, data: abi.encodeFunctionData(method, args) },
      blockTag,
    ]);
    return abi.decodeFunctionResult(method, raw)[0];
  }
  const issuer: string = await read(
    CONTRACTS.DojangAttesterBook,
    "getAttester",
    [PLAYGROUND_ATTESTER_ID],
  );
  const schema: string = await read(CONTRACTS.SchemaBook, "getSchemaUid", [
    SCHEMAS[0].id,
  ]);
  if (issuer === ZeroAddress || schema === ZERO)
    throw new Error(
      "현재 Playground 발행자 또는 주소 인증 스키마 등록을 확인할 수 없습니다.",
    );
  const uid: string = await read(
    CONTRACTS.AttestationIndexer,
    "getAttestationUid",
    [schema, issuer, address],
  );
  const result = {
    address,
    issuer,
    schema,
    uid,
    block: parseInt(blockTag, 16),
  };
  if (uid === ZERO) return { ...result, status: "not-found" };
  const definition = await read(CONTRACTS.SchemaRegistry, "getSchema", [schema]);
  if (
    definition.uid.toLowerCase() !== schema.toLowerCase() ||
    definition.schema.trim().replace(/\s+/g, " ") !== SCHEMAS[0].definition
  )
    throw new Error("현재 스키마가 지원하는 주소 인증 형식과 다릅니다.");
  const record: RawRecord = await read(CONTRACTS.EAS, "getAttestation", [uid]);
  return {
    ...result,
    status: playgroundStatus(record, result, Math.floor(Date.now() / 1000)),
  };
}
