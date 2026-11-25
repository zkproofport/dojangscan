import type { BackendProjection } from "./backend-api";
import type { HistoricalPage } from "./historical-api";

export type RecordCategory = "dojang" | "unconfirmed" | "eas";
export type CatalogView = RecordCategory | "events";
/** Server classification only. Schema names, Indexer events and decoded content are not classification evidence. */
export function projectionCategory(
  p: Pick<BackendProjection, "classification">,
): RecordCategory {
  return p.classification === "dojang"
    ? "dojang"
    : p.classification === "external_eas"
      ? "eas"
      : "unconfirmed";
}
export function catalogView(search: string, events = false): CatalogView {
  const q = new URLSearchParams(search),
    v = q.get("catalog");
  if (["dojang", "unconfirmed", "eas", "events"].includes(v ?? ""))
    return v as CatalogView;
  if (events && q.has("event")) return "events"; // legacy event deep links
  if (
    events &&
    ["uid", "recipient", "issuer", "filterUid"].some((k) => q.has(k))
  )
    return "unconfirmed";
  return "dojang";
}
export function catalogURL(view: CatalogView, search: string) {
  const q = new URLSearchParams(search);
  q.set("catalog", view);
  for (const k of ["cursor", "detailCursor", "uid", "event"]) q.delete(k);
  return "?" + q;
}
/** Recent has no classified UID catalog. These are issuance references, not merged canonical UID records.
 * Preserve response order and every event locator; no cross-page/network/UID deduplication. */
export function issuanceReferences(page: HistoricalPage) {
  return page.data
    .filter((e) => e.event === "Attested" && !!e.uid)
    .map((event) => ({
      network: page.meta.network,
      snapshot: page.meta.snapshot,
      event,
      category: "unconfirmed" as const,
    }));
}
