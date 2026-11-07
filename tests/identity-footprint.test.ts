import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { IdentityFootprint } from "../components/identity-footprint";
import {
  ACTIVITY_PAGE_LIMIT,
  FOOTPRINT_LIMIT,
  extractFootprint,
  loadFootprintActivity,
  type ActivityResult,
} from "../lib/identity-footprint";
import { SCHEMAS, NETWORK, type Attestation, type ScanData } from "../lib/giwa";
import { setLanguage } from "../lib/preferences";
import { tr } from "../lib/i18n";
import { readFileSync } from "node:fs";
import translations from "../lib/translations.json";
const wallet = "0x" + "11".repeat(20),
  issuer = "0x" + "22".repeat(20),
  peer = "0x" + "33".repeat(20);
const hash = (n: number) => "0x" + n.toString(16).padStart(64, "0");
const addr = (n: number) => "0x" + n.toString(16).padStart(40, "0");
const attestation = (overrides: Partial<Attestation> = {}): Attestation => ({
  uid: hash(1),
  schema: SCHEMAS[0].uid,
  recipient: wallet,
  attester: issuer,
  time: 100,
  expirationTime: 0,
  revocationTime: 0,
  revocable: true,
  refUID: hash(0),
  data: "0x",
  status: "active",
  fields: [{ name: "isVerified", type: "bool", value: "true" }],
  schemaName: "Verified Address",
  schemaLabel: "주소 인증",
  schemaCurrent: true,
  dojang: true,
  registeredIssuer: true,
  issuerClass: "registered",
  managementRole: false,
  issuerName: "issuer",
  tx: hash(2),
  block: 10,
  ...overrides,
});
const transaction = (to = peer, n = 3) => ({
  hash: hash(n),
  from: { hash: wallet },
  to: { hash: to, is_contract: true },
  status: "ok",
  block_number: 12,
  timestamp: "2026-10-01T00:00:00Z",
});
const transfer = (from = wallet, to = peer) => ({
  transaction_hash: hash(4),
  block_hash: hash(10),
  from: { hash: from },
  to: { hash: to },
  block_number: 12,
});
const activity = (
  transactions: unknown[] = [],
  transfers: unknown[] = [],
): ActivityResult => ({
  transactions: { items: transactions, limited: false },
  transfers: { items: transfers, limited: false },
  issues: {},
});

test("attestations, contract calls, and direct token transfers retain distinct verifiable evidence", () => {
  const { edges } = extractFootprint(
    wallet,
    [attestation()],
    [],
    activity([transaction()], [transfer()]),
  );
  assert.deepEqual(
    edges.map((e) => e.kind),
    ["attestation", "contract", "transfer"],
  );
  assert.equal(edges[0].from, issuer);
  assert.equal(edges[0].to, wallet);
  assert.equal(edges[0].evidence[0].uid, hash(1));
  assert.equal(edges[1].evidence[0].tx, hash(3));
  assert.equal(edges[2].evidence[0].tx, hash(4));
  assert.ok(edges.every((e) => e.evidence.every((v) => v.uid || v.tx)));
});
test("filters unrelated, issued-to-others and non-address EAS records; revoked evidence stays explicitly revoked", () => {
  const records = [
    attestation({ recipient: peer }),
    attestation({ schema: SCHEMAS[2].uid }),
    attestation({ schema: hash(80) }),
    attestation({ dojang: false }),
    attestation({ uid: hash(0) }),
    attestation({ status: "revoked", revocationTime: 120 }),
  ];
  const { edges } = extractFootprint(wallet, records, []);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].evidence[0].attestation?.status, "revoked");
});
test("deduplicates repeated connections and transaction hashes while retaining separate supporting records", () => {
  const { edges } = extractFootprint(
    wallet,
    [attestation(), attestation()],
    [],
    activity(
      [transaction(), transaction(), transaction(peer, 5)],
      [transfer(), transfer()],
    ),
  );
  assert.equal(edges.length, 3);
  assert.deepEqual(
    edges.map((e) => e.evidence.length),
    [1, 2, 1],
  );
});
test("strict one-hop, mined success, explicit contract and nonzero recipient filters", () => {
  const bad = [
    null,
    {},
    { ...transaction(), from: { hash: peer } },
    { ...transaction(), status: "error" },
    { ...transaction(), block_number: null },
    { ...transaction(), to: { hash: peer } },
    { ...transaction(), hash: "invalid" },
    transaction(wallet),
  ];
  const { edges } = extractFootprint(
    wallet,
    [],
    [],
    activity(bad, [
      transfer(peer, issuer),
      transfer(wallet, wallet),
      transfer(wallet, addr(0)),
      { ...transfer(), block_hash: null },
      transfer(peer, wallet),
    ]),
  );
  assert.equal(edges.length, 1);
  assert.equal(edges[0].from, peer);
  assert.equal(edges[0].to, wallet);
});
test("enforces 10 connections and 50 source records, with no ownership inference or graph expansion", () => {
  const records = Array.from({ length: 100 }, (_, i) =>
    transaction(addr(i + 1), i + 1),
  );
  const { edges, limited } = extractFootprint(
    wallet,
    [],
    [],
    activity(records),
  );
  assert.equal(edges.length, FOOTPRINT_LIMIT);
  assert.equal(limited, true);
  for (const e of edges) {
    assert.equal(e.from, wallet);
    assert.deepEqual(
      Object.keys(e).sort(),
      ["id", "kind", "from", "to", "evidence"].sort(),
    );
  }
  assert.equal(
    extractFootprint(
      wallet,
      [],
      [],
      activity([...Array(50).fill(null), transaction()]),
    ).edges.length,
    0,
  );
  assert.deepEqual(extractFootprint("bad", [], []), {
    edges: [],
    limited: false,
  });
});
test("empty responses do not manufacture activity or a credential edge", () => {
  assert.deepEqual(extractFootprint(wallet, [], [], activity()), {
    edges: [],
    limited: false,
  });
});
test("loader requests exactly two pages, ignores pagination, caps items and sends no credentials", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    urls.push(String(input));
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.referrerPolicy, "no-referrer");
    assert.ok(init?.signal);
    return Response.json({
      items: Array(75).fill(transaction()),
      next_page_params: { block_number: 1 },
    });
  };
  const result = await loadFootprintActivity(
    wallet,
    new AbortController().signal,
    fetcher,
  );
  assert.deepEqual(urls, [
    `${NETWORK.explorer}/api/v2/addresses/${wallet}/transactions`,
    `${NETWORK.explorer}/api/v2/addresses/${wallet}/token-transfers`,
  ]);
  assert.equal(result.transactions.items.length, ACTIVITY_PAGE_LIMIT);
  assert.equal(result.transfers.limited, true);
});
test("rate limiting and partial failure preserve the other source without automatic retries", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input) => {
    calls++;
    return String(input).endsWith("token-transfers")
      ? new Response(null, { status: 429 })
      : Response.json({ items: [transaction()], next_page_params: null });
  };
  const result = await loadFootprintActivity(
    wallet,
    new AbortController().signal,
    fetcher,
  );
  assert.equal(calls, 2);
  assert.deepEqual(result.issues, { transfers: "rate-limit" });
  assert.equal(
    extractFootprint(wallet, [attestation()], [], result).edges.length,
    2,
  );
});
test("network errors, malformed pages and aborts settle as unavailable, never as fabricated empty success", async () => {
  for (const fetcher of [
    async () => {
      throw new TypeError("network");
    },
    async () => Response.json({ items: [] }),
    async () => new Response(null, { status: 503 }),
  ]) {
    const result = await loadFootprintActivity(
      wallet,
      new AbortController().signal,
      fetcher,
    );
    assert.deepEqual(result.issues, {
      transactions: "unavailable",
      transfers: "unavailable",
    });
  }
  const controller = new AbortController();
  controller.abort();
  const result = await loadFootprintActivity(
    wallet,
    controller.signal,
    async (_url, init) => {
      init?.signal?.throwIfAborted();
      throw new Error("expected aborted signal");
    },
  );
  assert.equal(Object.keys(result.issues).length, 2);
});
test("panel starts collapsed in both languages and does not fetch activity during rendering", () => {
  const data = {
    address: wallet,
    verifiedBy: [],
    attestations: [],
    schemas: [],
    block: 10,
  } as unknown as ScanData & { address: string; verifiedBy: [] };
  for (const language of ["ko", "en"] as const) {
    setLanguage(language);
    const html = renderToStaticMarkup(
      createElement(IdentityFootprint, {
        data,
        onSelect: () => {},
        onStudio: () => {},
      }),
    );
    assert.match(html, /aria-expanded="false"/);
    assert.doesNotMatch(html, /footprint-graph|api\/v2|With ZKProofport/);
  }
  setLanguage("ko");
});
test("all Korean footprint literals have English catalog entries and translate", () => {
  const source = readFileSync(
    new URL("../components/identity-footprint.tsx", import.meta.url),
    "utf8",
  );
  const strings = [...source.matchAll(/"([^"\n]*[가-힣][^"\n]*)"/g)].map(
    (m) => m[1],
  );
  setLanguage("en");
  try {
    for (const value of strings) {
      assert.ok(
        Object.hasOwn(translations, value),
        `Missing translation: ${value}`,
      );
      assert.notEqual(tr(value), value);
    }
  } finally {
    setLanguage("ko");
  }
});
