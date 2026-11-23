import { liveAPIBase } from "./api-endpoints";
import type { RecordedContent } from "./recorded-content";
// Read-only API contract from dojangscan-backend/apps/api/server.ts.
export type TriState = boolean | null;
export type BackendMeta = {
  network: string;
  chainId: string;
  asOfBlock: number | null;
  evaluatedBlock: number | null;
  blockHash: string | null;
  observedAt: string | null;
  verifiedAt: string;
  freshness: string;
  projectionGeneration: string | null;
  stateEvaluationReady: boolean;
  range: {
    from: number | null;
    through: number | null;
    requestedRangeComplete: boolean;
  };
  coverage: {
    raw_complete: boolean;
    initialStateComplete?: boolean;
    hydration_complete: boolean;
    range_evaluation_ready?: boolean;
    certifiedBlocks?: number;
    classificationUnknown?: boolean;
    pending: number;
    exhausted: number;
  };
  finalizedHead?: { number: number; observedAt?: string } | null;
};
export type BackendProjection = {
  uid: string;
  schema: string;
  issuer: string;
  recipient: string;
  issuedAt: string | null;
  expiresAt?: string;
  issued: TriState;
  notRevoked: TriState;
  notExpired: TriState;
  currentIndexSelected: TriState;
  policyAccepted: TriState;
  dependencyValid: TriState;
  snapshotNotExpired?: TriState;
  snapshotDependencyValid?: TriState;
  issuerRegistered: TriState;
  issuerRegisteredAtIssuance: TriState;
  schemaRegistered: TriState;
  fields: Record<string, string>;
  reasons: string[];
  classification?: string;
  issuanceEventObserved?: boolean;
  observationBlockNumber?: number;
  evaluatedBlock?: number | null;
};
export type BackendPage = {
  meta: BackendMeta;
  data: BackendProjection[];
  next: string | null;
};
export type BackendDetail = {
  meta: BackendMeta;
  data: BackendProjection;
  content?: RecordedContent;
};
export type BackendHistory = {
  historicalOnly: true;
  currentDecision: "UNKNOWN";
  data: {
    block_number: string;
    block_hash: string;
    value: BackendProjection;
  }[];
};
export type BackendStatus = {
  meta: BackendMeta;
  operations?: {
    finalizedHead?: { number: number; observedAt?: string };
    headObservedAt?: string;
    finalizedToIndexedLag?: number;
    observationAgeMs?: number;
  };
};
export type BackendFilters = {
  recipient?: string;
  issuer?: string;
  schema?: string;
  domain?: string;
  from?: string;
  to?: string;
};
/** Match the deployed filter contract before making a GET; no source fallback. */
export function normalizeBackendFilters(
  filters: BackendFilters,
): BackendFilters {
  const result: BackendFilters = {};
  for (const key of [
    "recipient",
    "issuer",
    "schema",
    "domain",
    "from",
    "to",
  ] as const) {
    const value = filters[key]?.trim();
    if (!value) continue;
    if (
      (key === "recipient" || key === "issuer") &&
      !/^0x[0-9a-f]{40}$/i.test(value)
    )
      throw new BackendError(400, "INVALID_QUERY");
    if (key === "schema" && !/^0x[0-9a-f]{64}$/i.test(value))
      throw new BackendError(400, "INVALID_QUERY");
    result[key] = ["recipient", "issuer", "schema"].includes(key)
      ? value.toLowerCase()
      : value;
  }
  return result;
}
export class BackendError extends Error {
  constructor(
    public status: number,
    public code: string,
    public meta?: BackendMeta,
  ) {
    super(code);
    this.name = "BackendError";
  }
}
export function backendErrorKind(error: unknown) {
  if (!(error instanceof BackendError)) return "connection";
  if (error.status === 409 && error.code === "CURSOR_SNAPSHOT_CHANGED")
    return "snapshot";
  if (error.code === "NOT_FOUND_IN_COVERAGE")
    return error.status === 404 && error.meta?.stateEvaluationReady === true
      ? "absent"
      : "unknown";
  return error.status === 400 ? "query" : "connection";
}
export function createBackendClient(
  network: string,
  request: typeof fetch = fetch,
  base = liveAPIBase,
) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(network))
    throw new Error("Invalid backend network instance");
  const prefix = `${base}/v1/networks/${encodeURIComponent(network)}`;
  async function read<T>(
    path: string,
    params: Record<string, string> = {},
    audit = false,
  ): Promise<T> {
    const query = new URLSearchParams(params).toString();
    let response: Response;
    try {
      response = await request(
        (audit ? base : prefix) + path + (query ? "?" + query : ""),
        {
          method: "GET",
          credentials: "omit",
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        },
      );
    } catch {
      throw new BackendError(0, "CONNECTION_FAILED");
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new BackendError(response.status, "INVALID_RESPONSE");
    }
    if (!response.ok)
      throw new BackendError(
        response.status,
        body.error ?? "UNAVAILABLE",
        body.meta,
      );
    if (
      audit
        ? body?.historicalOnly !== true ||
          body.currentDecision !== "UNKNOWN" ||
          !Array.isArray(body.data)
        : body?.meta?.network !== network || body.meta.chainId !== "91342"
    )
      throw new BackendError(502, "UNEXPECTED_NETWORK");
    return body as T;
  }
  return {
    history: (uid: string) => {
      // Existing Phase21 audit helper only exposes its approved two UIDs, max 33 rows.
      if (
        network !== "giwa-sepolia-finalized21-r1" ||
        !/^0x[0-9a-fA-F]{64}$/.test(uid)
      )
        throw new BackendError(400, "HISTORY_UNSUPPORTED");
      return read<BackendHistory>(
        "/audit/history/" + uid.toLowerCase(),
        {},
        true,
      );
    },
    status: () => read<BackendStatus>("/status"),
    async list(filters: BackendFilters = {}, cursor?: string, limit = 20) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new BackendError(400, "INVALID_LIMIT");
      const params: Record<string, string> = { limit: String(limit) };
      for (const [key, value] of Object.entries(
        normalizeBackendFilters(filters),
      ))
        params[key] = value;
      if (cursor) params.cursor = cursor; // Opaque: never parse or repackage.
      const result = await read<BackendPage>("/attestations", params);
      if (
        !Array.isArray(result.data) ||
        !(result.next === null || typeof result.next === "string")
      )
        throw new BackendError(502, "INVALID_RESPONSE");
      return result;
    },
    detail: (uid: string) => {
      if (!/^0x[0-9a-fA-F]{64}$/.test(uid))
        throw new BackendError(400, "INVALID_UID");
      return read<BackendDetail>("/attestations/" + uid.toLowerCase());
    },
  };
}

// One recovery request, without the invalidated snapshot cursor. Never merges pages.
export async function backendPage(
  client: ReturnType<typeof createBackendClient>,
  filters: BackendFilters,
  cursor?: string,
  limit = 20,
) {
  try {
    return { page: await client.list(filters, cursor, limit), reset: false };
  } catch (error) {
    if (!cursor || backendErrorKind(error) !== "snapshot") throw error;
    return { page: await client.list(filters, undefined, limit), reset: true };
  }
}
