import type { BackendDetail } from "./backend-api";
export type RecordProvenance = {
  source:
    | "live-observation"
    | "live-evaluation"
    | "historical-issuance"
    | "classification";
  blockNumber: number | null;
  blockHash: string | null;
  observedAt: string | null;
};
export type RecordInformation = {
  version: "record-information-v1";
  recordIdentity: {
    uid: string;
    network: string;
    chainId: string;
    schema: string;
  };
  issuance: {
    status: "historical-proof" | "stored-record" | "not-established";
    issuer: string;
    recipient: string;
    issuedAt: string | null;
    blockNumber: number | null;
    blockHash: string | null;
    transactionHash: string | null;
  };
  content: {
    status: "decoded" | "not-stored" | "unsupported" | "invalid";
    fields: { name: string; value: string; type?: string }[];
    provenance: RecordProvenance | null;
  };
  observedChanges: {
    kind: "revoked" | "expired-at-observation" | "not-selected-at-evaluation";
    effectiveAt: string | null;
    provenance: RecordProvenance;
  }[];
  dojangEvidence: {
    level: "verified-issuance" | "related" | "external-eas" | "unknown";
    scope: "historical-only";
    provenance: RecordProvenance | null;
  };
  limitations: string[];
  provenance: RecordProvenance[];
  currentEligibility: "UNKNOWN";
};
/** Absent is compatible with the old API. Malformed/misbound information must not be shown. */
export function readRecordInformation(
  detail?: BackendDetail,
): RecordInformation | undefined | null {
  const r = detail?.recordInformation;
  if (r === undefined) return undefined;
  try {
    const p = detail!.data,
      id = r.recordIdentity;
    const hash = (s: unknown) =>
      typeof s === "string" && /^0x[0-9a-f]{64}$/.test(s);
    const provenance = (v: RecordProvenance | null) =>
      v === null ||
      ([
        "live-observation",
        "live-evaluation",
        "historical-issuance",
        "classification",
      ].includes(v.source) &&
        (v.blockHash === null || hash(v.blockHash)) &&
        (v.blockNumber === null ||
          (Number.isSafeInteger(v.blockNumber) && v.blockNumber >= 0)) &&
        (v.observedAt === null || Number.isFinite(Date.parse(v.observedAt))));
    if (
      r.version !== "record-information-v1" ||
      id.uid !== p.uid ||
      id.schema !== p.schema ||
      id.network !== detail!.meta.network ||
      id.chainId !== detail!.meta.chainId ||
      r.issuance.issuer !== p.issuer ||
      r.issuance.recipient !== p.recipient ||
      r.currentEligibility !== "UNKNOWN" ||
      r.dojangEvidence.scope !== "historical-only" ||
      !["verified-issuance", "related", "external-eas", "unknown"].includes(
        r.dojangEvidence.level,
      ) ||
      !["historical-proof", "stored-record", "not-established"].includes(
        r.issuance.status,
      ) ||
      !["decoded", "not-stored", "unsupported", "invalid"].includes(
        r.content.status,
      ) ||
      r.content.fields.length > 32 ||
      r.content.fields.some(
        (f) =>
          typeof f.name !== "string" ||
          typeof f.value !== "string" ||
          f.name.length > 64 ||
          f.value.length > 2048,
      ) ||
      r.observedChanges.length > 3 ||
      r.observedChanges.some(
        (c) =>
          ![
            "revoked",
            "expired-at-observation",
            "not-selected-at-evaluation",
          ].includes(c.kind) || !provenance(c.provenance),
      ) ||
      !provenance(r.content.provenance) ||
      !provenance(r.dojangEvidence.provenance) ||
      r.provenance.some((v) => !provenance(v))
    )
      return null;
    if (
      r.dojangEvidence.level === "verified-issuance" &&
      (r.issuance.status !== "historical-proof" ||
        !hash(r.issuance.blockHash) ||
        !hash(r.issuance.transactionHash) ||
        r.dojangEvidence.provenance?.source !== "historical-issuance")
    )
      return null;
    return r;
  } catch {
    return null;
  }
}
export function dojangEvidenceLabel(
  level: RecordInformation["dojangEvidence"]["level"],
  ko: boolean,
) {
  return {
    "verified-issuance": ko
      ? "Dojang 발급 근거 확인"
      : "Dojang issuance evidence confirmed",
    related: ko
      ? "Dojang 관련성 확인 · 발급 근거 부족"
      : "Dojang relation found · issuance evidence incomplete",
    "external-eas": ko
      ? "일반 EAS 기록 · 저장된 분류"
      : "General EAS record · stored classification",
    unknown: ko ? "Dojang 분류 미확인" : "Dojang classification unconfirmed",
  }[level];
}
export function observedChangeLabel(
  kind: RecordInformation["observedChanges"][number]["kind"],
  ko: boolean,
) {
  return {
    revoked: ko ? "철회 사실 확인" : "Revocation observed",
    "expired-at-observation": ko
      ? "관측 시점에 만료"
      : "Expired at observation",
    "not-selected-at-evaluation": ko
      ? "평가 시점에 조회 대상으로 선택되지 않음"
      : "Not selected for lookup at evaluation",
  }[kind];
}
