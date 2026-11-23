import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BackendError,
  backendErrorKind,
  backendPage,
  createBackendClient,
  type BackendMeta,
  type BackendProjection,
} from "../lib/backend-api";
import { adaptProjection } from "../lib/backend-adapter";

const network = "giwa-sepolia-finalized21-r1";
const meta = {
  network,
  chainId: "91342",
  stateEvaluationReady: false,
} as BackendMeta;
const projection = {
  uid: "0x" + "1".repeat(64),
  schema: "0x" + "2".repeat(64),
  issuer: "0x" + "3".repeat(40),
  recipient: "0x" + "4".repeat(40),
  issued: true,
  notRevoked: true,
  notExpired: true,
  currentIndexSelected: false,
  policyAccepted: null,
  fields: {},
  reasons: ["SUPERSEDED"],
} as BackendProjection;
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
test("UNKNOWN never becomes false/revoked; superseded remains separate from EAS state", () => {
  assert.equal(adaptProjection(projection).status, "active");
  assert.equal(adaptProjection(projection).indexStatus, "not-selected");
  assert.equal(
    adaptProjection({ ...projection, notRevoked: null }).status,
    "unknown",
  );
  assert.equal(
    adaptProjection({ ...projection, notRevoked: false }).status,
    "revoked",
  );
  assert.equal(
    adaptProjection({ ...projection, notExpired: false }).status,
    "expired",
  );
  assert.equal(
    adaptProjection({ ...projection, policyAccepted: true }).currentDecision,
    "UNKNOWN",
  );
  assert.equal("refUID" in adaptProjection(projection), false);
  assert.equal("revocationTime" in adaptProjection(projection), false);
});
test("opaque cursor passes through unchanged, filters stay server-side", async () => {
  let url = "";
  const cursor = "opaque+/=_snapshot";
  const client = createBackendClient(network, async (input) => {
    url = String(input);
    return response({ meta, data: [], next: cursor });
  });
  const page = await client.list(
    { issuer: projection.issuer, schema: projection.schema },
    cursor,
    1,
  );
  assert.equal(page.next, cursor);
  const query = new URL(url, "http://localhost").searchParams;
  assert.equal(query.get("cursor"), cursor);
  assert.equal(query.get("issuer"), projection.issuer);
  assert.equal(query.get("limit"), "1");
});
test("409 resets cursor once and returns only the new first page", async () => {
  const urls: string[] = [];
  const client = createBackendClient(network, async (input) => {
    urls.push(String(input));
    return urls.length === 1
      ? response({ error: "CURSOR_SNAPSHOT_CHANGED", meta }, 409)
      : response({ meta, data: [projection], next: null });
  });
  const result = await backendPage(
    client,
    { schema: projection.schema },
    "oldSnapshot",
  );
  assert.equal(result.reset, true);
  assert.equal(result.page.data.length, 1);
  assert.equal(
    new URL(urls[1], "http://localhost").searchParams.has("cursor"),
    false,
  );
  assert.equal(
    new URL(urls[1], "http://localhost").searchParams.get("schema"),
    projection.schema,
  );
});
test("503 missing coverage, verified absence, and service errors remain distinct", () => {
  assert.equal(
    backendErrorKind(new BackendError(503, "NOT_FOUND_IN_COVERAGE", meta)),
    "unknown",
  );
  assert.equal(
    backendErrorKind(new BackendError(404, "NOT_FOUND_IN_COVERAGE", meta)),
    "unknown",
  );
  assert.equal(
    backendErrorKind(
      new BackendError(404, "NOT_FOUND_IN_COVERAGE", {
        ...meta,
        stateEvaluationReady: true,
      }),
    ),
    "absent",
  );
  assert.equal(
    backendErrorKind(new BackendError(503, "UNAVAILABLE")),
    "connection",
  );
});
test("UID request errors retain coverage; no fallback to public RPC", async () => {
  let requests = 0;
  const client = createBackendClient(network, async () => {
    requests++;
    return response({ error: "NOT_FOUND_IN_COVERAGE", meta }, 503);
  });
  await assert.rejects(
    client.detail(projection.uid),
    (e) =>
      e instanceof BackendError &&
      e.meta?.network === network &&
      backendErrorKind(e) === "unknown",
  );
  assert.equal(requests, 1);
  assert.throws(() => client.detail("invalid"), { code: "INVALID_UID" });
});
test("wrong network, transport failure and non-JSON proxy errors fail closed", async () => {
  await assert.rejects(
    createBackendClient(network, async () =>
      response({ meta: { ...meta, network: "giwa-sepolia" } }),
    ).status(),
    { code: "UNEXPECTED_NETWORK" },
  );
  await assert.rejects(
    createBackendClient(network, async () => {
      throw Error("network");
    }).status(),
    { code: "CONNECTION_FAILED" },
  );
  await assert.rejects(
    createBackendClient(
      network,
      async () => new Response("bad gateway", { status: 502 }),
    ).status(),
    { code: "INVALID_RESPONSE" },
  );
});
test("history is limited to the actual Phase21 audit helper contract", async () => {
  let path = "";
  const client = createBackendClient(network, async (input) => {
    path = String(input);
    return response({
      historicalOnly: true,
      currentDecision: "UNKNOWN",
      data: [],
    });
  });
  await client.history(projection.uid);
  assert.equal(path, "/api/dojangscan/audit/history/" + projection.uid);
  assert.throws(
    () => createBackendClient("another-instance").history(projection.uid),
    { code: "HISTORY_UNSUPPORTED" },
  );
});

test("409 recovery preserves the requested page size and does not loop on failure", async () => {
  const urls: string[] = [];
  const client = createBackendClient(network, async (input) => {
    urls.push(String(input));
    return response({ error: "CURSOR_SNAPSHOT_CHANGED", meta }, 409);
  });
  await assert.rejects(backendPage(client, {}, "old", 6), { status: 409 });
  assert.equal(urls.length, 2);
  assert.equal(
    new URL(urls[1], "http://localhost").searchParams.get("limit"),
    "6",
  );
});

test("recipient pagination retains normalized recipient, issuer and schema together", async () => {
  const urls: URL[] = [];
  const client = createBackendClient(network, async (input) => {
    urls.push(new URL(String(input), "http://localhost"));
    return response({ meta, data: [projection], next: "opaque+/=next" });
  });
  const filters = {
    recipient: " 0x" + "AB".repeat(20) + " ",
    issuer: projection.issuer,
    schema: projection.schema,
  };
  const first = await client.list(filters);
  await client.list(filters, first.next!);
  for (const url of urls) {
    assert.equal(url.searchParams.get("recipient"), "0x" + "ab".repeat(20));
    assert.equal(url.searchParams.get("issuer"), projection.issuer);
    assert.equal(url.searchParams.get("schema"), projection.schema);
    assert.equal(url.searchParams.get("limit"), "20");
  }
  assert.equal(urls[1].searchParams.get("cursor"), first.next);
});

test("snapshot reset keeps the recipient scope and returns only the replacement page", async () => {
  const urls: URL[] = [];
  const client = createBackendClient(network, async (input) => {
    urls.push(new URL(String(input), "http://localhost"));
    return urls.length === 1
      ? response({ error: "CURSOR_SNAPSHOT_CHANGED" }, 409)
      : response({ meta, data: [projection], next: "new" });
  });
  const result = await backendPage(
    client,
    { recipient: projection.recipient, issuer: projection.issuer },
    "old",
    20,
  );
  assert.equal(result.reset, true);
  assert.deepEqual(result.page.data, [projection]);
  assert.equal(urls[1].searchParams.has("cursor"), false);
  for (const url of urls) {
    assert.equal(url.searchParams.get("recipient"), projection.recipient);
    assert.equal(url.searchParams.get("issuer"), projection.issuer);
  }
});

test("invalid recipient makes no request and server errors never resolve to an empty page", async () => {
  let calls = 0;
  const client = createBackendClient(network, async () => {
    calls++;
    return response({ meta, data: [], next: null });
  });
  for (const recipient of [
    "0x123",
    "0x" + "g".repeat(40),
    "https://example.com",
  ])
    await assert.rejects(client.list({ recipient }), {
      status: 400,
      code: "INVALID_QUERY",
    });
  assert.equal(calls, 0);
  for (const status of [400, 429, 502, 503, 504]) {
    await assert.rejects(
      createBackendClient(network, async () =>
        response({ error: "UNAVAILABLE" }, status),
      ).list({ recipient: projection.recipient }),
      { status },
    );
  }
  const empty = await client.list({ recipient: projection.recipient });
  assert.deepEqual(empty.data, []);
  assert.equal(empty.meta.stateEvaluationReady, false);
});
