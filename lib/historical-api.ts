import { historicalAPIBase } from "./api-endpoints";
export type HistoricalEvent = {
  id: string;
  uid: string | null;
  event: string;
  kind: string;
  contract: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
  schema: string | null;
  issuer: string | null;
  recipient: string | null;
  indexKey: string | null;
  receiptVerified: boolean;
};
export type HistoricalMeta = {
  network: string;
  observedAt: string;
  snapshot: string;
};
export type HistoricalPage = {
  meta: HistoricalMeta;
  data: HistoricalEvent[];
  next: string | null;
  issuanceEvidence?: {
    payload: Record<string, string | boolean>;
    observation: { atIssuance: boolean };
    proofComplete: boolean;
    proofKind: string | null;
    unknownReasons: string[];
  } | null;
};
export type HistoricalCoverage = {
  meta: HistoricalMeta;
  discovery: { from: number; through: number }[];
  receiptVerifiedBlocks: { number: number; hash: string }[];
  checkpoint: { nextBlock: number };
  bookEvents: number;
  summary: {
    events: Record<string, number>;
    uniqueUIDs: number;
    payloads: number;
    existingProofs: number;
    unknownReasons: Record<string, number>;
  };
};
export type HistoricalFilters = {
  uid?: string;
  event?: string;
  schema?: string;
  issuer?: string;
};
export class HistoricalError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function createHistoricalClient(
  network: string,
  request: typeof fetch = fetch,
  base = historicalAPIBase,
) {
  const prefix = `${base}/v1/networks/${encodeURIComponent(network)}/historical`;
  async function get<T>(
    path: string,
    params: Record<string, string | undefined> = {},
  ): Promise<T> {
    if (!/^[a-z0-9-]+$/.test(network))
      throw new HistoricalError(0, "NETWORK_NOT_CONFIGURED");
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) query.set(k, v);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const r = await request(prefix + path + (query.size ? "?" + query : ""), {
        method: "GET",
        credentials: "omit",
        signal: abort.signal,
        cache: "no-store",
      });
      const v = await r.json();
      if (!r.ok) throw new HistoricalError(r.status, v.error ?? "UNAVAILABLE");
      if (v.meta?.network !== network)
        throw new HistoricalError(0, "NETWORK_MISMATCH");
      return v;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    coverage: () => get<HistoricalCoverage>("/coverage"),
    events: (filters: HistoricalFilters = {}, cursor?: string) =>
      get<HistoricalPage>("/events", { ...filters, cursor, limit: "20" }),
    uid: (uid: string, cursor?: string) => {
      if (!/^0x[0-9a-fA-F]{64}$/.test(uid))
        return Promise.reject(new HistoricalError(400, "INVALID_UID"));
      return get<HistoricalPage>("/uids/" + uid.toLowerCase(), {
        cursor,
        limit: "20",
      });
    },
  };
}
export function historicalReason(reason: string, ko: boolean) {
  const labels: Record<string, [string, string]> = {
    MISSING_BOOK_INDEXER_IMPLEMENTATION_AT_ISSUANCE: [
      "발급 당시 Book·Indexer·implementation 근거 부족",
      "Missing issuance-time Book, Indexer and implementation evidence",
    ],
    RECOVERY_EXEC_INDEXER_EVENT_NOT_UNIQUE: [
      "같은 발급 트랜잭션에서 유일한 Indexer 이벤트를 확인하지 못함",
      "No unique matching Indexer event in the issuance transaction",
    ],
    HISTORICAL_RECEIPT_REQUIRES_REVIEW: [
      "발급 호출 경로에 대한 Receipt 검토 필요",
      "Issuance call path requires receipt review",
    ],
  };
  return labels[reason]?.[ko ? 0 : 1] ?? reason;
}
