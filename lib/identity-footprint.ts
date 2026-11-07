import {
  NETWORK,
  SCHEMAS,
  ZERO,
  type Attestation,
  type SchemaRecord,
} from "./giwa";

export const FOOTPRINT_LIMIT = 10;
export const ACTIVITY_PAGE_LIMIT = 50;
export type RelationshipKind = "attestation" | "contract" | "transfer";
export type Evidence = {
  tx?: string;
  uid?: string;
  block?: number;
  timestamp?: string;
  attestation?: Attestation;
};
export type Relationship = {
  id: string;
  kind: RelationshipKind;
  from: string;
  to: string;
  evidence: Evidence[];
};
export type ActivityPage = { items: unknown[]; limited: boolean };
export type ActivityIssue = "rate-limit" | "unavailable";
export type ActivityResult = {
  transactions: ActivityPage;
  transfers: ActivityPage;
  issues: Partial<Record<"transactions" | "transfers", ActivityIssue>>;
};
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const address = (v: unknown) =>
  typeof v === "string" && addressPattern.test(v) ? v.toLowerCase() : "";
const hash = (v: unknown) =>
  typeof v === "string" && hashPattern.test(v) && v !== ZERO
    ? v.toLowerCase()
    : undefined;
const block = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
const timestamp = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : undefined;

// Exactly one default Blockscout page (50 records) per source. Never follow cursors,
// inspect peers, enrich addresses, cache results persistently, or retry automatically.
export async function loadFootprintActivity(
  wallet: string,
  signal: AbortSignal,
  fetcher = fetch,
): Promise<ActivityResult> {
  if (!address(wallet)) throw new Error("Invalid wallet address.");
  const read = async (path: string): Promise<ActivityPage> => {
    const response = await fetcher(
      `${NETWORK.explorer}/api/v2/addresses/${wallet}/${path}`,
      {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      },
    );
    if (!response.ok)
      throw new Error(response.status === 429 ? "rate-limit" : "unavailable");
    const body = object(await response.json());
    if (!Array.isArray(body.items) || !Object.hasOwn(body, "next_page_params"))
      throw new Error("unavailable");
    return {
      items: body.items.slice(0, ACTIVITY_PAGE_LIMIT),
      limited:
        body.next_page_params !== null ||
        body.items.length > ACTIVITY_PAGE_LIMIT,
    };
  };
  const results = await Promise.allSettled([
    read("transactions"),
    read("token-transfers"),
  ]);
  const output: ActivityResult = {
    transactions: { items: [], limited: false },
    transfers: { items: [], limited: false },
    issues: {},
  };
  results.forEach((result, index) => {
    const source = index === 0 ? "transactions" : "transfers";
    if (result.status === "fulfilled") output[source] = result.value;
    else
      output.issues[source] =
        result.reason instanceof Error && result.reason.message === "rate-limit"
          ? "rate-limit"
          : "unavailable";
  });
  return output;
}

export function extractFootprint(
  wallet: string,
  attestations: Attestation[],
  schemas: SchemaRecord[],
  activity?: ActivityResult | null,
) {
  const center = address(wallet);
  if (!center) return { edges: [], limited: false };
  const groups = new Map<string, Relationship>();
  function add(
    kind: RelationshipKind,
    from: string,
    to: string,
    evidence: Evidence,
  ) {
    // Reject self-loops, mint/burn zero addresses, and all second-hop records.
    if (
      !from ||
      !to ||
      from === to ||
      /^0x0{40}$/.test(from) ||
      /^0x0{40}$/.test(to) ||
      (from !== center && to !== center)
    )
      return;
    const id = `${kind}:${from}:${to}`;
    const edge = groups.get(id) ?? { id, kind, from, to, evidence: [] };
    if (
      !edge.evidence.some(
        (e) => (e.uid ?? e.tx) === (evidence.uid ?? evidence.tx),
      )
    )
      edge.evidence.push(evidence);
    groups.set(id, edge);
  }
  // Only known Verified Address schemas, never balances, codes, or arbitrary EAS.
  const addressSchemas = new Set([
    SCHEMAS[0].uid.toLowerCase(),
    ...schemas
      .filter((s) => s.id?.toLowerCase() === SCHEMAS[0].id)
      .map((s) => s.uid.toLowerCase()),
  ]);
  for (const a of attestations.slice(0, ACTIVITY_PAGE_LIMIT)) {
    if (
      !a.dojang ||
      !addressSchemas.has(a.schema.toLowerCase()) ||
      address(a.recipient) !== center ||
      !hash(a.uid)
    )
      continue;
    add("attestation", address(a.attester), center, {
      uid: a.uid,
      tx: hash(a.tx),
      block: block(a.block),
      timestamp:
        timestamp(a.timestamp) ??
        (a.time > 0 && a.time < 8640000000000
          ? new Date(a.time * 1000).toISOString()
          : undefined),
      attestation: a,
    });
  }
  for (const raw of (activity?.transactions.items ?? []).slice(
    0,
    ACTIVITY_PAGE_LIMIT,
  )) {
    const tx = object(raw),
      from = address(object(tx.from).hash),
      to = address(object(tx.to).hash);
    // Successful mined calls only. The explorer must explicitly classify the target.
    if (
      from !== center ||
      object(tx.to).is_contract !== true ||
      tx.status !== "ok" ||
      block(tx.block_number) === undefined ||
      !hash(tx.hash)
    )
      continue;
    add("contract", from, to, {
      tx: hash(tx.hash),
      block: block(tx.block_number),
      timestamp: timestamp(tx.timestamp),
    });
  }
  for (const raw of (activity?.transfers.items ?? []).slice(
    0,
    ACTIVITY_PAGE_LIMIT,
  )) {
    const transfer = object(raw),
      from = address(object(transfer.from).hash),
      to = address(object(transfer.to).hash);
    if (!hash(transfer.transaction_hash) || !hash(transfer.block_hash))
      continue;
    add("transfer", from, to, {
      tx: hash(transfer.transaction_hash),
      block: block(transfer.block_number),
      timestamp: timestamp(transfer.timestamp),
    });
  }
  // Round-robin avoids one busy source crowding all other relationship types out.
  const kinds: RelationshipKind[] = ["attestation", "contract", "transfer"];
  const lists = kinds.map((kind) =>
    [...groups.values()].filter((edge) => edge.kind === kind),
  );
  const edges: Relationship[] = [];
  for (
    let i = 0;
    edges.length < FOOTPRINT_LIMIT && lists.some((list) => i < list.length);
    i++
  )
    for (const list of lists)
      if (list[i] && edges.length < FOOTPRINT_LIMIT) edges.push(list[i]);
  return {
    edges,
    limited:
      groups.size > edges.length ||
      attestations.length > ACTIVITY_PAGE_LIMIT ||
      !!activity?.transactions.limited ||
      !!activity?.transfers.limited,
  };
}
