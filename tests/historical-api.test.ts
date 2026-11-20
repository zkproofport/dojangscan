import test from "node:test";
import assert from "node:assert/strict";
import {
  createHistoricalClient,
  HistoricalError,
  historicalReason,
} from "../lib/historical-api";
const network = "giwa-sepolia-catchup25-r1",
  uid = "0x" + "a".repeat(64);
test("historical reads use a separate local path, preserve filters and opaque cursor", async () => {
  let url = "";
  const client = createHistoricalClient(network, async (input, options) => {
    url = String(input);
    assert.equal(options?.cache, "no-store");
    return new Response(
      JSON.stringify({ meta: { network }, data: [], next: null }),
    );
  });
  await client.events({ event: "Revoked", uid }, "opaque+/=");
  const parsed = new URL(url, "http://localhost");
  assert.equal(
    parsed.pathname,
    `/api/historical/v1/networks/${network}/historical/events`,
  );
  assert.equal(parsed.searchParams.get("cursor"), "opaque+/=");
  assert.equal(parsed.searchParams.get("event"), "Revoked");
  await client.uid(uid.toUpperCase().replace("0X", "0x"));
  assert(url.includes("/uids/" + uid));
});
test("503 and changed cursor never retry or fall back to public RPC", async () => {
  for (const status of [503, 409]) {
    let calls = 0;
    const client = createHistoricalClient(network, async () => {
      calls++;
      return new Response(JSON.stringify({ error: "UNAVAILABLE" }), { status });
    });
    await assert.rejects(
      client.events(),
      (e: unknown) => e instanceof HistoricalError && e.status === status,
    );
    assert.equal(calls, 1);
  }
});
test("invalid UID or network fails without HTTP; wrong response network is refused", async () => {
  let calls = 0;
  const fake: typeof fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ meta: { network: "other" } }));
  };
  await assert.rejects(createHistoricalClient(network, fake).uid("bad"));
  await assert.rejects(createHistoricalClient("", fake).coverage());
  assert.equal(calls, 0);
  await assert.rejects(
    createHistoricalClient(network, fake).coverage(),
    /NETWORK_MISMATCH/,
  );
});
test("incomplete evidence labels do not claim external EAS or multiple Indexer events", () => {
  assert.match(
    historicalReason("RECOVERY_EXEC_INDEXER_EVENT_NOT_UNIQUE", false),
    /No unique matching/,
  );
  assert.equal(
    historicalReason("UNREVIEWED_REASON", true),
    "UNREVIEWED_REASON",
  );
});
