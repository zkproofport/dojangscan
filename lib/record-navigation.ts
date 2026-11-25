/** UI routing only. Never combines records or initiates a fallback request. */
import type { HistoricalPage, HistoricalFilters } from "./historical-api";
export type RecordSource = "recent" | "live" | "public" | "history";
export const recordSources: RecordSource[] = [
  "recent",
  "live",
  "public",
  "history",
];
export function recordSource(search: string): RecordSource {
  const q = new URLSearchParams(search);
  if (
    ["wallet", "issuer", "schemas", "codes", "issuers", "lab"].includes(
      q.get("view") ?? "",
    )
  )
    return "public";
  if (["recipient-records", "issuer-records"].includes(q.get("view") ?? ""))
    return "live";
  if (q.get("source") !== "backend") return "public";
  return q.get("history") === "recent"
    ? "recent"
    : q.get("history") === "backfill"
      ? "history"
      : "live";
}
export function sourceLabel(source: RecordSource, ko: boolean) {
  return {
    recent: ["Recent · 최근 이벤트", "Recent · collected events"],
    live: ["Live · 저장 기록", "Live · stored records"],
    public: ["Public · 체인 조회", "Public · chain lookup"],
    history: ["Historical · 과거 이력", "Historical · archived events"],
  }[source][ko ? 0 : 1];
}
/** Keep identities and supported filters; never carry a source-specific page cursor. */
export function sourceURL(source: RecordSource, search: string, uid?: string) {
  const old = new URLSearchParams(search);
  const q = new URLSearchParams({
    view: "explore",
    source: source === "public" ? "public" : "backend",
  });
  if (source === "recent" || source === "history")
    q.set("history", source === "recent" ? "recent" : "backfill");
  const id = uid ?? old.get("uid") ?? old.get("filterUid");
  const issuer = old.get("issuer") ?? old.get("attester");
  const recipient = old.get("recipient") ?? old.get("address");
  if (id) q.set("uid", id.toLowerCase());
  if (source === "public") {
    // Public has single-address views, not a combined issuer+recipient filter.
    if (issuer) {
      q.set("view", "issuer");
      q.set("issuer", issuer.toLowerCase());
    } else if (recipient) {
      q.set("view", "wallet");
      q.set("address", recipient.toLowerCase());
    } else if (!id && old.get("schema")) {
      q.set("view", "schemas");
      q.set("schema", old.get("schema")!);
    }
  } else {
    if (issuer) q.set("issuer", issuer.toLowerCase());
    if (recipient) q.set("recipient", recipient.toLowerCase());
    if (old.get("schema")) q.set("schema", old.get("schema")!);
    if (source !== "live" && old.get("event"))
      q.set("event", old.get("event")!);
    if (source === "live" && !id && !!issuer !== !!recipient)
      q.set("view", issuer ? "issuer-records" : "recipient-records");
  }
  return "?" + q;
}
export function addressURL(
  value: string,
  role: "issuer" | "recipient",
  source: RecordSource,
) {
  return sourceURL(source, new URLSearchParams({ [role]: value }).toString());
}
export function needsPublicOverview(
  view: string,
  backend: boolean,
  search = "",
) {
  if (view === "explore" && new URLSearchParams(search).has("uid"))
    return false;
  return (
    ["schemas", "issuers"].includes(view) || (view === "explore" && !backend)
  );
}
export function writeRoute(url: string | URL, replace = false) {
  const next = new URL(String(url), window.location.href);
  if (next.origin !== window.location.origin)
    throw new Error("LOCAL_ROUTE_REQUIRED");
  const current = new URL(window.location.href);
  const canonical = (u: URL) => {
    const copy = new URL(u);
    copy.searchParams.sort();
    return copy.href;
  };
  if (canonical(next) !== canonical(current))
    window.history[replace ? "replaceState" : "pushState"](null, "", next);
  window.dispatchEvent(new Event("record-route"));
}

/** Only issuance facts in this response; never infer issuance time from a block. */
export function eventRecordFacts(page: HistoricalPage, uid: string) {
  const event = page.data.find(
    (e) => e.uid?.toLowerCase() === uid.toLowerCase() && e.event === "Attested",
  );
  const payload = page.issuanceEvidence?.payload;
  const address = (value: unknown) =>
    typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value) ? value : null;
  return {
    schema:
      (typeof payload?.schema === "string" ? payload.schema : event?.schema) ??
      page.content?.schema ??
      "",
    issuer: address(payload?.attester) ?? address(event?.issuer),
    recipient: address(payload?.recipient) ?? address(event?.recipient),
    issuedAt: typeof payload?.time === "string" ? payload.time : null,
  };
}

/** Search is local parsing; sharing URLs and requests remain separate actions. */
export function eventQuery(
  value: string,
  role: "issuer" | "recipient",
  draft: HistoricalFilters,
):
  | { kind: "uid"; uid: string }
  | { kind: "filters"; filters: HistoricalFilters }
  | { kind: "invalid" } {
  const input = value.trim().toLowerCase();
  if (/^0x[0-9a-f]{64}$/.test(input)) return { kind: "uid", uid: input };
  const filters = { ...draft };
  delete filters.uid;
  if (!input) return { kind: "filters", filters };
  if (!/^0x[0-9a-f]{40}$/.test(input)) return { kind: "invalid" };
  delete filters[role === "issuer" ? "recipient" : "issuer"];
  filters[role] = input;
  return { kind: "filters", filters };
}
