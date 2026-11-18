// GET-only development proxy smoke. No RPC, DB writes or server changes.
import assert from "node:assert/strict";
import {
  createBackendClient,
  BackendError,
  backendPage,
} from "../lib/backend-api.ts";
import { adaptProjection } from "../lib/backend-adapter.ts";
const origin = "http://127.0.0.1:4317";
const network =
  process.env.VITE_DOJANGSCAN_NETWORK || "giwa-sepolia-catchup25-r1";
let requests = 0;
const client = createBackendClient(network, (input, init) => {
  requests++;
  return fetch(origin + input, init);
});
const status = await client.status();
const first = await client.list({}, undefined, 1);
assert.ok(first.data.length, "No real indexed records available");
const detail = await client.detail(first.data[0].uid);
assert.equal(detail.data.uid, first.data[0].uid);
assert.equal(detail.meta.coverage.raw_complete, false);
assert.equal(adaptProjection(detail.data).currentDecision, "UNKNOWN");
let paged = false;
if (first.next) {
  const second = await backendPage(client, {}, first.next, 1);
  if (!second.reset)
    assert.notEqual(second.page.data[0]?.uid, first.data[0].uid);
  paged = true;
}
const filtered = await client.list({
  issuer: detail.data.issuer,
  schema: detail.data.schema,
});
assert.ok(
  filtered.data.every(
    (p) => p.issuer === detail.data.issuer && p.schema === detail.data.schema,
  ),
);
await assert.rejects(
  client.detail("0x" + "0".repeat(64)),
  (e) =>
    e instanceof BackendError &&
    e.status === 503 &&
    e.code === "NOT_FOUND_IN_COVERAGE",
);
const history =
  network === "giwa-sepolia-finalized21-r1"
    ? await client.history(detail.data.uid)
    : null;
console.log(
  JSON.stringify(
    {
      pass: true,
      requests,
      network,
      indexed: status.meta.asOfBlock,
      evaluated: status.meta.evaluatedBlock,
      observedAt: status.meta.observedAt,
      finalized: status.operations?.finalizedHead,
      uid: detail.data.uid,
      opaquePagination: paged,
      historyRows: history?.data.length,
      coverage: "partial",
      currentDecision: "UNKNOWN",
      newRPC: 0,
      databaseWrites: 0,
    },
    null,
    2,
  ),
);
