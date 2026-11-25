import test from "node:test";
import assert from "node:assert/strict";
import { createRecentClient, HistoricalError } from "../lib/historical-api";
import { resolveProductLookup } from "../lib/product-experience";
const network = "giwa-sepolia-catchup25-r1",
  uid = "0x" + "a".repeat(64),
  address = "0x" + "b".repeat(40);
const meta = {
  network,
  source: "recent-finalized-events",
  currentDecision: "UNKNOWN",
  realTime: false,
  window: { collectionStatus: "complete" },
};
test("Recent requests stay in their own source, including address role, UID and cursor", async () => {
  const urls: string[] = [];
  const client = createRecentClient(network, async (u, o) => {
    urls.push(String(u));
    assert.equal(o?.credentials, "omit");
    return new Response(JSON.stringify({ meta, data: [], next: "opaque" }));
  });
  await client.events({ recipient: address }, "opaque+/=");
  await client.events({ issuer: address });
  await client.uid(uid);
  const first = new URL(urls[0], "http://localhost");
  assert.equal(
    first.pathname,
    `/api/recent/v1/networks/${network}/recent/events`,
  );
  assert.equal(first.searchParams.get("recipient"), address);
  assert.equal(first.searchParams.get("cursor"), "opaque+/=");
  assert.equal(first.searchParams.get("issuer"), null);
  assert.ok(urls[1].includes("issuer="));
  assert.ok(urls[2].endsWith("/uids/" + uid + "?limit=20"));
});
test("Recent errors and foreign/partial snapshots never become empty success or fallback", async () => {
  for (const status of [400, 409, 429, 502, 503, 504]) {
    let calls = 0;
    const c = createRecentClient(network, async () => {
      calls++;
      return new Response(JSON.stringify({ error: "UNAVAILABLE" }), { status });
    });
    await assert.rejects(
      c.events(),
      (e: unknown) => e instanceof HistoricalError && e.status === status,
    );
    assert.equal(calls, 1);
  }
  for (const bad of [
    { ...meta, source: "historical-backfill" },
    { ...meta, realTime: true },
    { ...meta, window: { collectionStatus: "partial" } },
    { ...meta, network: "other" },
  ])
    await assert.rejects(
      createRecentClient(
        network,
        async () => new Response(JSON.stringify({ meta: bad, data: [] })),
      ).events(),
    );
});
test("Main search explicitly selects Recent and preserves the source of old pasted links", () => {
  for (const role of ["wallet", "issuer"] as const) {
    const v = resolveProductLookup(address, role, "recent")!;
    const q = new URLSearchParams(v.href);
    assert.equal(v.source, "recent");
    assert.equal(q.get("history"), "recent");
    assert.equal(q.get(role === "wallet" ? "recipient" : "issuer"), address);
  }
  assert.equal(
    new URLSearchParams(
      resolveProductLookup(uid, "record", "recent")!.href,
    ).get("history"),
    "recent",
  );
  assert.equal(
    resolveProductLookup("?uid=" + uid, "record", "recent")?.source,
    "public",
  );
  assert.equal(
    resolveProductLookup("?source=backend&history=recent&uid=" + uid)?.source,
    "recent",
  );
  assert.equal(
    resolveProductLookup(
      "?source=backend&history=backfill&uid=" + uid,
      "record",
      "recent",
    )?.source,
    "history",
  );
  assert.equal(resolveProductLookup(address, "wallet")?.source, "backend");
});

test("Discovery-only and selected Recorded Content remain observations without fallback", async () => {
  const content = {
    version: "recorded-content-v1",
    purpose: "recorded_content_only",
    status: "unavailable",
    schema: uid,
    fields: [],
    reasons: ["STORED_PAYLOAD_UNAVAILABLE"],
  };
  const client = createRecentClient(
    network,
    async () =>
      new Response(
        JSON.stringify({
          meta,
          data: [
            {
              id: "log",
              uid,
              event: "Attested",
              receiptVerified: false,
              verification: "discovery-only",
              refUID: null,
              eventFields: { schemaUID: uid },
            },
          ],
          next: null,
          content,
        }),
      ),
  );
  const detail = await client.uid(uid);
  assert.equal(detail.data[0].verification, "discovery-only");
  assert.equal(detail.data[0].receiptVerified, false);
  assert.equal(detail.data[0].refUID, null);
  assert.deepEqual(detail.content, content);
});
