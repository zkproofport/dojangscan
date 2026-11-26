import { historicalAPIBase, recentAPIBase } from "./api-endpoints";
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
  verification?: "receipt-verified" | "discovery-only";
  refUID?: string | null;
  eventFields?: Record<string, unknown>;
};
export type HistoricalMeta = {
  sync?: {
    workerState: "running" | "stopped" | "unknown";
    workerObservedAt: string | null;
    lastSuccessfulCollectionAt: string | null;
    finalizedObservedAt: string | null;
    observationStale: boolean;
    currentLatestnessConfirmed: false;
  };
  network: string;
  observedAt: string;
  snapshot: string;
  source?: string;
  window?: {
    requestedRange: { from: number; through: number };
    finalizedAnchor: { number: number; hash: string; observedAt: string };
    collectionStatus: string;
    completedThrough: number;
    unscannedGap: { from: number; through: number } | null;
    tailing?: { phase: string; cursor: number; finalizedHead: number; gap: number; observedAt: string };
  };
};
export function recentCollectionLabel(meta: HistoricalMeta, ko: boolean, now = Date.now()) {
  const sync = meta.sync;
  const age = now - Date.parse(sync?.workerObservedAt ?? "");
  if (!sync || !Number.isFinite(age) || age < 0 || age > 90000 || sync.workerState === "unknown")
    return ko ? "자동 수집 상태 확인 불가 · 최신 기록 반영 여부 확인 불가" : "Collection status unavailable · latest coverage unconfirmed";
  if (sync.workerState === "stopped")
    return ko ? "자동 수집 일시 중단 · 최신 기록 반영 여부 확인 불가" : "Automatic collection stopped · latest coverage unconfirmed";
  if (sync.observationStale)
    return ko ? "자동 수집 중 · 최신 기록 반영 여부 확인 불가" : "Automatic collection running · latest coverage unconfirmed";
  return ko ? "자동 수집 중 · 마지막 관측 기준" : "Automatic collection running · as last observed";
}
export type HistoricalPage = {
  meta: HistoricalMeta;
  data: HistoricalEvent[];
  next: string | null;
  content?: import("./recorded-content").RecordedContent;
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
  recipient?: string;
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
  kind: "historical" | "recent" = "historical",
) {
  const prefix = `${base}/v1/networks/${encodeURIComponent(network)}/${kind}`;
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
      if (
        kind === "recent" &&
        (v.meta?.source !== "recent-finalized-events" ||
          v.meta?.realTime !== false ||
          v.meta?.currentDecision !== "UNKNOWN" ||
          v.meta?.window?.collectionStatus !== "complete")
      )
        throw new HistoricalError(0, "RECENT_SCOPE_MISMATCH");
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
export function createRecentClient(
  network: string,
  request: typeof fetch = fetch,
  base = recentAPIBase,
) {
  return createHistoricalClient(network, request, base, "recent");
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
