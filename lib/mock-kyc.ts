import { Interface, getAddress, isAddress, zeroPadValue } from "ethers";
import { CONTRACTS, TEST_ATTESTER, ZERO } from "./giwa";
import {
  historyRequest,
  historyEvents,
  historyCursor,
  type LogCursor,
} from "./history";
import { playgroundStatus, type PlaygroundResult } from "./playground";
import { rpc } from "./scan-data";

export const MOCK_KYC_SCHEMA =
  "0xbda8dd64efa4c537514cfe4c96ab5d5f14a8ec0c9105b799b47a010e89c0c72d";
export const MOCK_KYC_SIGNER = "0xEE099845CDfF93e73aDcBcB36A9B93578bcCed4b";
const abi = new Interface([
  "function attester() view returns (address)",
  "function verifiedAccountSchema() view returns (bytes32)",
  "function getAttestation(bytes32) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))",
]);

/** This mock is outside the official Dojang Books. Read its exact schema and issuer. */
export async function checkMockKycAttestation(
  input: string,
): Promise<PlaygroundResult> {
  if (!isAddress(input.trim()))
    throw new Error("유효한 지갑 주소를 입력해 주세요.");
  const address = getAddress(input.trim());
  const blockTag: string = await rpc("eth_blockNumber", []);
  async function read(target: string, method: string, args: unknown[] = []) {
    const raw = await rpc("eth_call", [
      { to: target, data: abi.encodeFunctionData(method, args) },
      blockTag,
    ]);
    return abi.decodeFunctionResult(method, raw)[0];
  }
  const signer: string = await read(TEST_ATTESTER, "attester");
  const schema: string = await read(TEST_ATTESTER, "verifiedAccountSchema");
  if (
    signer.toLowerCase() !== MOCK_KYC_SIGNER.toLowerCase() ||
    schema.toLowerCase() !== MOCK_KYC_SCHEMA
  )
    throw new Error("목업 발급자 설정이 지원하는 서킷과 일치하지 않습니다.");
  const base = {
    address,
    issuer: TEST_ATTESTER,
    schema: MOCK_KYC_SCHEMA,
    uid: ZERO,
    block: parseInt(blockTag, 16),
  };
  let cursor: LogCursor | null = null;
  for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
    const request = historyRequest(address, "recipient", cursor);
    const response = await fetch(request.url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(
        "목업 등록 기록을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    const page = await response.json();
    if (!Array.isArray(page.items) || !Object.hasOwn(page, "next_page_params"))
      throw new Error(
        "목업 등록 기록을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    const matches = historyEvents(page.items, request.topic, "recipient")
      .filter(
        (event) =>
          event.topics[2]?.toLowerCase() === zeroPadValue(TEST_ATTESTER, 32) &&
          event.topics[3]?.toLowerCase() === MOCK_KYC_SCHEMA &&
          event.block_number <= base.block,
      )
      .sort((a, b) => b.block_number - a.block_number);
    if (matches.length) {
      const uid = matches[0].data;
      const record = await read(CONTRACTS.EAS, "getAttestation", [uid]);
      return {
        ...base,
        uid,
        status: playgroundStatus(
          record,
          { ...base, uid },
          Math.floor(Date.now() / 1000),
        ),
      };
    }
    const next = historyCursor(page.next_page_params);
    if (!next) return { ...base, status: "not-found" };
    if (JSON.stringify(next) === JSON.stringify(cursor)) break;
    cursor = next;
  }
  // A bounded search must never present an incomplete history as an unregistered wallet.
  throw new Error(
    "등록 기록 조회 범위를 초과했습니다. 관리자에게 등록 내역을 확인해 주세요.",
  );
}
