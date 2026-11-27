import { getAddress, id, isAddress, isHexString, zeroPadValue } from "ethers";
import { CONTRACTS, NETWORK } from "./giwa";

export type HistoryRole = "recipient" | "issuer";
export type LogCursor = Record<string, number>;
export type HistoryLog = {
  topics: (string | null)[];
  data: string;
  transaction_hash: string;
  block_number: number;
  block_timestamp: string;
};
export const ATTESTED_TOPIC = id("Attested(address,address,bytes32,bytes32)");

export function schemaHistoryRequest(
  schema: string,
  cursor?: LogCursor | null,
) {
  if (!isHexString(schema, 32)) throw new Error("Invalid schema UID.");
  const params = new URLSearchParams({ topic: schema });
  if (cursor)
    for (const [key, value] of Object.entries(historyCursor(cursor)!))
      params.set(key, String(value));
  return `${NETWORK.explorer}/api/v2/addresses/${CONTRACTS.EAS}/logs?${params}`;
}

export function schemaHistoryEvents(
  logs: HistoryLog[],
  schema: string,
  block: number,
) {
  return logs.filter(
    (log) =>
      log.topics[0]?.toLowerCase() === ATTESTED_TOPIC &&
      log.topics[3]?.toLowerCase() === schema.toLowerCase() &&
      log.block_number <= block &&
      /^0x[0-9a-fA-F]{64}$/.test(log.data),
  );
}

export function historyRequest(
  address: string,
  role: HistoryRole,
  cursor?: LogCursor | null,
) {
  if (!isAddress(address)) throw new Error("유효한 지갑 주소를 입력해 주세요.");
  if (role !== "recipient" && role !== "issuer")
    throw new Error("지원하지 않는 조회입니다.");
  const topic = zeroPadValue(getAddress(address), 32).toLowerCase();
  const params = new URLSearchParams({ topic });
  if (cursor) {
    if (typeof cursor !== "object" || Array.isArray(cursor))
      throw new Error("페이지 값이 잘못되었습니다.");
    for (const key of ["block_number", "index", "items_count"]) {
      const value = cursor[key];
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error("페이지 값이 잘못되었습니다.");
      params.set(key, String(value));
    }
  }
  return {
    topic,
    url: `${NETWORK.explorer}/api/v2/addresses/${CONTRACTS.EAS}/logs?${params}`,
  };
}

// Blockscout's topic search matches ANY indexed position. Check the exact
// recipient/attester position locally; never confuse received and issued records.
export function historyEvents(
  logs: HistoryLog[],
  topic: string,
  role: HistoryRole,
) {
  return logs.filter(
    (log) =>
      log.topics[0]?.toLowerCase() === ATTESTED_TOPIC &&
      log.topics[role === "recipient" ? 1 : 2]?.toLowerCase() === topic &&
      /^0x[0-9a-fA-F]{64}$/.test(log.data),
  );
}

export function historyCursor(
  raw: Record<string, unknown> | null,
): LogCursor | null {
  if (!raw) return null;
  const cursor: LogCursor = {};
  for (const key of ["block_number", "index", "items_count"]) {
    if (!Number.isSafeInteger(raw[key]) || Number(raw[key]) < 0)
      throw new Error("페이지 값이 잘못되었습니다.");
    cursor[key] = Number(raw[key]);
  }
  return cursor;
}
