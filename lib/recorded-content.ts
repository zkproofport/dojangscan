/** Read-only presentation contract. These fields never replace projection fields or status. */
export type RecordedContent = {
  version: "recorded-content-v1";
  purpose: "recorded_content_only";
  status: "decoded" | "unavailable" | "invalid" | "limited";
  schema: string;
  fields: { name: string; type: string; value: string }[];
  reasons: string[];
  limitations: string[];
  observation: {
    blockHash: string;
    blockNumber: number;
    observedAt: string;
  } | null;
  definitionEvidence: {
    kind: string;
    chainId: string;
    genesisHash: string;
    registry: string;
    blockHash: string;
    sourceSHA256: string;
    receiptRootVerified: false;
    independentProvider: false;
  };
};
const hash = /^0x[0-9a-f]{64}$/;
const limitations = [
  "CONTENT_NOT_TRUTH_VERIFIED",
  "DOJANG_APPLICABILITY_NOT_ESTABLISHED",
  "NOT_CURRENT_ELIGIBILITY",
];
const reasons = [
  "STORED_PAYLOAD_UNAVAILABLE",
  "PAYLOAD_IDENTITY_OR_FORMAT_MISMATCH",
  "OBSERVATION_CONTEXT_INVALID",
  "CONTENT_SIZE_LIMIT",
  "PAYLOAD_ABI_INVALID",
];
export function recordedContentView(
  value: unknown,
  schema: string,
):
  | { state: "not-provided" | "contract-error"; content?: never }
  | { state: "available"; content: RecordedContent } {
  if (value === undefined) return { state: "not-provided" };
  const v = value as RecordedContent;
  const e = v?.definitionEvidence,
    o = v?.observation;
  if (
    !v ||
    v.version !== "recorded-content-v1" ||
    v.purpose !== "recorded_content_only" ||
    v.schema !== schema ||
    !hash.test(v.schema) ||
    !["decoded", "unavailable", "invalid", "limited"].includes(v.status) ||
    !Array.isArray(v.fields) ||
    v.fields.length > 32 ||
    !v.fields.every(
      (f) =>
        f &&
        typeof f.name === "string" &&
        /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(f.name) &&
        typeof f.type === "string" &&
        /^(string|uint(?:8|16|32|64|128|192|256)|bytes32)$/.test(f.type) &&
        typeof f.value === "string" &&
        new TextEncoder().encode(f.value).length <= 2048,
    ) ||
    new Set(v.fields.map((f) => f.name)).size !== v.fields.length ||
    !Array.isArray(v.reasons) ||
    v.reasons.some((r) => !reasons.includes(r)) ||
    JSON.stringify(v.limitations) !== JSON.stringify(limitations) ||
    !e ||
    ![
      "stored-canonical-Registered-and-receipt-set",
      "previously-saved-fixed-block-getSchema",
    ].includes(e.kind) ||
    e.chainId !== "91342" ||
    e.genesisHash !==
      "0xca1b5fee64a196abfca007b3a4d4e3ec2b37be83a452d452bf4e45937004cab2" ||
    e.registry !== "0x4200000000000000000000000000000000000020" ||
    !hash.test(e.blockHash) ||
    !/^[0-9a-f]{64}$/.test(e.sourceSHA256) ||
    e.receiptRootVerified !== false ||
    e.independentProvider !== false ||
    (o !== null &&
      (!o ||
        !hash.test(o.blockHash) ||
        !Number.isSafeInteger(o.blockNumber) ||
        o.blockNumber < 0 ||
        typeof o.observedAt !== "string" ||
        !Number.isFinite(Date.parse(o.observedAt)))) ||
    (v.status === "decoded"
      ? !v.fields.length || v.reasons.length !== 0 || o === null
      : v.fields.length !== 0 || v.reasons.length !== 1)
  )
    return { state: "contract-error" };
  return { state: "available", content: v };
}
export function contentFieldLabel(name: string, ko: boolean) {
  const labels: Record<string, [string, string]> = {
    session: ["기록된 세션", "Recorded session"],
    day: ["기록된 day 값", "Recorded day value"],
    venue: ["기록된 장소", "Recorded venue"],
    swaps: ["기록된 교환 횟수", "Recorded swap count"],
    focus: ["기록 주제", "Recorded focus"],
    note: ["기록 메모", "Recorded note"],
    seq: ["기록 순번", "Recorded sequence"],
    mode: ["기록 방식", "Recorded mode"],
    tag: ["기록 태그", "Recorded tag"],
    week: ["기록된 week 값", "Recorded week value"],
    phase: ["기록된 단계", "Recorded phase"],
    finalize: ["기록된 finalize 값", "Recorded finalize value"],
    revision: ["기록 개정 번호", "Recorded revision"],
    actionCode: ["작업 코드", "Action code"],
    schemaVersion: ["스키마 버전", "Schema version"],
    policyVersion: ["기록된 정책 버전", "Recorded policy version"],
    occurredDay: ["기록된 occurredDay 값", "Recorded occurredDay value"],
    origin: ["출처 코드", "Origin code"],
  };
  return labels[name]?.[ko ? 0 : 1] ?? name;
}
