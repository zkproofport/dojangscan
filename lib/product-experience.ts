import { SCHEMAS } from "./giwa";
import type { BackendDetail } from "./backend-api";
import type { HistoricalEvent } from "./historical-api";
import { adaptProjection } from "./backend-adapter";

export type LookupIntent = "record" | "wallet" | "issuer" | "schema";
export type LookupTarget = {
  href: string;
  source: "public" | "backend" | "history";
  kind: LookupIntent;
};
const uidPattern = /^0x[\da-f]{64}$/i;
const addressPattern = /^0x[\da-f]{40}$/i;
export const isIssuerAddress = (value: string) =>
  addressPattern.test(value.trim());
/** Explicit role switch: keep the address, discard the other role and cursor. */
export function addressRoleURL(value: string, recipient: boolean) {
  const params = new URLSearchParams({
    view: recipient ? "recipient-records" : "issuer-records",
    source: "backend",
  });
  if (isIssuerAddress(value))
    params.set(recipient ? "recipient" : "issuer", value.trim().toLowerCase());
  return "?" + params;
}

/** Show issuer-provided content, without inferring units or verification. */
export function recordSummaryFields(fields: { name: string; value: string }[]) {
  return fields
    .filter((f) => !["salt", "proofs", "root", "codeHash"].includes(f.name))
    .slice(0, 2);
}

export function recordFieldValue(name: string, value: string, ko: boolean) {
  if (name === "isVerified" && (value === "true" || value === "false"))
    return value === "true"
      ? ko
        ? "예 · 발행자가 기록한 값"
        : "Yes · recorded by issuer"
      : ko
        ? "아니요 · 발행자가 기록한 값"
        : "No · recorded by issuer";
  return value;
}
const route = (params: Record<string, string>) =>
  `?${new URLSearchParams(params)}`;

/** Pure routing: never fetch an ambiguous hash or follow an arbitrary pasted URL. */
export function resolveProductLookup(
  raw: string,
  intent: LookupIntent = "record",
): LookupTarget | null {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value) || value.startsWith("?")) {
    try {
      const url = new URL(value, "https://dojangscan.com");
      if (
        ![
          "dojangscan.com",
          "www.dojangscan.com",
          "127.0.0.1",
          "localhost",
        ].includes(url.hostname) ||
        url.username ||
        url.password
      )
        return null;
      const uid = url.searchParams.get("uid");
      if (!uid || !uidPattern.test(uid)) return null;
      const historical = url.searchParams.get("history") === "backfill";
      // Old links without a source were Public. Preserve their original meaning.
      const source =
        historical || url.searchParams.get("source") === "backend"
          ? "backend"
          : "public";
      return {
        kind: "record",
        source: historical ? "history" : source,
        href: route({
          view: "explore",
          source,
          ...(historical ? { history: "backfill" } : {}),
          uid: uid.toLowerCase(),
        }),
      };
    } catch {
      return null;
    }
  }
  if (addressPattern.test(value) && intent !== "schema") {
    const issuer = intent === "issuer";
    return {
      kind: issuer ? "issuer" : "wallet",
      source: "backend",
      href: route(
        issuer
          ? {
              view: "issuer-records",
              source: "backend",
              issuer: value.toLowerCase(),
            }
          : {
              view: "recipient-records",
              source: "backend",
              recipient: value.toLowerCase(),
            },
      ),
    };
  }
  if (intent === "wallet" || intent === "issuer") return null;
  const schema = SCHEMAS.find((s) =>
    [s.name, s.label, s.key].some(
      (n) => n.toLowerCase() === value.toLowerCase(),
    ),
  );
  if (schema || (intent === "schema" && uidPattern.test(value))) {
    return {
      kind: "schema",
      source: "backend",
      href: route({
        view: "explore",
        source: "backend",
        schema: schema?.uid ?? value.toLowerCase(),
      }),
    };
  }
  if (uidPattern.test(value))
    return {
      kind: "record",
      source: "backend",
      href: route({
        view: "explore",
        source: "backend",
        uid: value.toLowerCase(),
      }),
    };
  return null;
}

export function initialProductView(search: string) {
  const q = new URLSearchParams(search);
  if (q.get("view")) return q.get("view")!;
  return [
    "uid",
    "schema",
    "address",
    "tx",
    "issuer",
    "recipient",
    "source",
    "history",
  ].some((k) => q.has(k))
    ? "explore"
    : "home";
}

/** No eligibility inference, no fabricated receipt or revocation timestamp. */
export function recordEvidence(detail: BackendDetail) {
  const p = detail.data;
  return {
    status: adaptProjection(p).status,
    index: adaptProjection(p).indexStatus,
    issuance: p.issued === true ? "stored" : "unknown",
    event: p.issuanceEventObserved === true ? "observed" : "unknown",
    receipt: "not-exposed" as const,
    decision: "UNKNOWN" as const,
    partial:
      !detail.meta.range.requestedRangeComplete ||
      !detail.meta.coverage.raw_complete,
    reasons: [...p.reasons],
  };
}

export function chronologicalEvents(events: HistoricalEvent[], uid?: string) {
  return events
    .filter((e) => !uid || e.uid?.toLowerCase() === uid.toLowerCase())
    .slice()
    .sort(
      (a, b) =>
        a.blockNumber - b.blockNumber ||
        a.logIndex - b.logIndex ||
        a.id.localeCompare(b.id),
    );
}

export function fieldLabel(name: string, ko: boolean) {
  const names: Record<string, [string, string]> = {
    isVerified: [
      "발행자가 기록한 주소 인증 여부",
      "Address verification asserted by issuer",
    ],
    balance: ["기록된 잔액", "Recorded balance"],
    snapshotAt: ["잔액 스냅샷 기준 시각", "Balance snapshot time"],
    totalAmount: ["기록된 합산 금액", "Recorded total amount"],
    leafCount: ["스냅샷에 포함된 항목 수", "Snapshot entry count"],
    domain: ["코드 사용처", "Code domain"],
    codeHash: ["코드 식별값", "Code identifier"],
    root: ["잔액 스냅샷 식별값", "Balance snapshot root"],
    coinType: ["자산 종류 식별값", "Asset type identifier"],
  };
  return names[name]?.[ko ? 0 : 1] ?? name;
}
