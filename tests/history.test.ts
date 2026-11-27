import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AbiCoder,
  Interface,
  ZeroAddress,
  ZeroHash,
  zeroPadValue,
} from "ethers";
import {
  historyEvents,
  historyRequest,
  historyCursor,
  ATTESTED_TOPIC,
} from "../lib/history";
import { wallet, addressHistory, invalidateScanCache } from "../lib/scan-data";
import { CONTRACTS, NETWORK, SCHEMAS } from "../lib/giwa";

const recipient = "0x1111111111111111111111111111111111111111";
const issuer = "0x2222222222222222222222222222222222222222";
const topic = zeroPadValue(recipient, 32);
const uid = (n: number) => "0x" + n.toString(16).padStart(64, "0");
function event(n: number, recipientAddress = recipient, attester = issuer) {
  return {
    topics: [
      ATTESTED_TOPIC,
      zeroPadValue(recipientAddress, 32),
      zeroPadValue(attester, 32),
      SCHEMAS[2].uid,
    ],
    data: uid(n),
    transaction_hash: uid(n + 100),
    block_number: 90,
    block_timestamp: "2026-10-01T00:00:00Z",
  };
}

test("history separates received/issued logs and excludes revocations, preserves safe filtered cursors", () => {
  const received = event(1),
    issued = event(2, issuer, recipient);
  const revoked = {
    ...received,
    topics: [uid(99), ...received.topics.slice(1)],
  };
  assert.deepEqual(
    historyEvents([received, issued, revoked], topic, "recipient"),
    [received],
  );
  assert.deepEqual(
    historyEvents([received, issued, revoked], topic, "issuer"),
    [issued],
  );
  const cursor = historyCursor({
    block_number: 90,
    index: 3,
    items_count: 50,
    topic: "untrusted",
  });
  const url = new URL(historyRequest(recipient, "recipient", cursor).url);
  assert.equal(url.searchParams.get("topic"), topic);
  assert.equal(url.searchParams.get("index"), "3");
  assert.equal(historyCursor(null), null);
  assert.throws(() => historyRequest("invalid", "issuer"));
  assert.throws(() => historyRequest(recipient, "other" as any));
  assert.throws(() => historyCursor({ block_number: -1 }));
});

test("wallet history includes keyed balances, codes and old records from an unregistered issuer; failed hydration is retryable", async () => {
  const originalFetch = globalThis.fetch;
  const abi = new Interface([
    "function getSchemaUid(bytes32) view returns(bytes32)",
    "function getAttester(bytes32) view returns(address)",
    "function getSchema(bytes32) view returns((bytes32 uid,address resolver,bool revocable,string schema))",
    "function getAttestation(bytes32) view returns((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))",
  ]);
  const coder = AbiCoder.defaultAbiCoder();
  const records: Record<string, unknown[]> = {
    [uid(1)]: [
      uid(1),
      SCHEMAS[2].uid,
      10,
      0,
      0,
      uid(50),
      recipient,
      issuer,
      true,
      coder.encode(["uint256", "bytes32", "bytes32[]"], [1000, ZeroHash, []]),
    ],
    [uid(2)]: [
      uid(2),
      SCHEMAS[3].uid,
      11,
      0,
      12,
      ZeroHash,
      recipient,
      issuer,
      true,
      coder.encode(["bytes32", "string"], [uid(7), "example.org"]),
    ],
    [uid(3)]: [
      uid(3),
      SCHEMAS[0].uid,
      1,
      2,
      0,
      ZeroHash,
      recipient,
      issuer,
      true,
      coder.encode(["bool"], [true]),
    ],
  };
  let fail = false;
  const urls: string[] = [];
  globalThis.fetch = (async (input, options) => {
    const url = String(input);
    if (url !== NETWORK.rpc) {
      if (url.includes(CONTRACTS.EAS)) {
        urls.push(url);
        const next = new URL(url).searchParams.has("block_number");
        return Response.json({
          items: next
            ? [event(3)]
            : [event(1), event(2), event(4, issuer, recipient)],
          next_page_params: next
            ? null
            : { block_number: 90, index: 1, items_count: 50, topic },
        });
      }
      return Response.json({ items: [], next_page_params: null });
    }
    const body = JSON.parse(String(options?.body));
    if (!Array.isArray(body))
      return Response.json({ jsonrpc: "2.0", id: body.id, result: "0x64" });
    return Response.json(
      body.map((call) => {
        const decoded = abi.parseTransaction({ data: call.params[0].data })!;
        let values: unknown[];
        switch (decoded.name) {
          case "getSchemaUid":
            values = [ZeroHash];
            break;
          case "getAttester":
            values = [ZeroAddress];
            break;
          case "getSchema": {
            const schema = SCHEMAS.find((s) => s.uid === decoded.args[0])!;
            values = [[schema.uid, ZeroAddress, true, schema.definition]];
            break;
          }
          case "getAttestation":
            if (fail) return { id: call.id, result: "0x" };
            values = [records[decoded.args[0]]];
            break;
          default:
            throw new Error(`Unexpected lookup: ${decoded.name}`);
        }
        return {
          id: call.id,
          result: abi.encodeFunctionResult(decoded.name, values),
        };
      }),
    );
  }) as typeof fetch;
  invalidateScanCache();
  try {
    const first = await wallet(recipient);
    assert.deepEqual(
      first.attestations.map((a) => a.uid),
      [uid(1), uid(2)],
    );
    assert.equal(
      first.attestations[0].fields.find((f) => f.name === "balance")?.value,
      "1000",
    );
    assert.equal(first.attestations[0].registeredIssuer, false);
    assert.equal(first.attestations[1].status, "revoked");
    const second = await addressHistory(recipient, "recipient", first.next);
    assert.equal(second.attestations[0].status, "expired");
    assert.equal(second.next, null);
    assert.equal(new URL(urls[1]).searchParams.get("topic"), topic);
    fail = true;
    await assert.rejects(
      addressHistory(recipient, "recipient", first.next),
      /다시 조회/,
    );
    fail = false;
    assert.equal(
      (await addressHistory(recipient, "recipient", first.next)).attestations[0]
        .uid,
      uid(3),
    );
  } finally {
    globalThis.fetch = originalFetch;
    invalidateScanCache();
  }
});
