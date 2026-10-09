import { test } from "node:test";
import assert from "node:assert/strict";
import { AbiCoder, ZeroHash } from "ethers";
import {
  playgroundStatus,
  checkPlaygroundAttestation,
} from "../lib/playground";
import { issuerMetadata, PLAYGROUND_ATTESTER_ID } from "../lib/issuer-metadata";
import { classifyIssuer } from "../lib/trust";
import type { Governance } from "../lib/giwa";
const address = "0x1111111111111111111111111111111111111111";
const issuer = "0x2222222222222222222222222222222222222222";
const other = "0x3333333333333333333333333333333333333333";
const uid = "0x" + "11".repeat(32),
  schema = "0x" + "22".repeat(32);
const expected = { uid, schema, address, issuer };
const raw = {
  uid,
  schema,
  recipient: address,
  attester: issuer,
  expirationTime: 0n,
  revocationTime: 0n,
  data: AbiCoder.defaultAbiCoder().encode(["bool"], [true]),
};
const governance: Governance = { block: 1, roles: [], complete: true };
test("Playground confirmation requires the exact current issuer, recipient, schema and UID", () => {
  assert.equal(playgroundStatus(raw, expected, 100), "confirmed");
  for (const field of ["uid", "schema", "recipient", "attester"] as const) {
    assert.throws(() =>
      playgroundStatus(
        {
          ...raw,
          [field]:
            field === "recipient" || field === "attester" ? other : ZeroHash,
        },
        expected,
        100,
      ),
    );
  }
  assert.equal(
    playgroundStatus({ ...raw, revocationTime: 1n }, expected, 100),
    "revoked",
  );
  assert.equal(
    playgroundStatus({ ...raw, expirationTime: 100n }, expected, 100),
    "expired",
  );
  assert.equal(
    playgroundStatus({ ...raw, expirationTime: 101n }, expected, 100),
    "confirmed",
  );
  assert.equal(
    playgroundStatus(
      { ...raw, data: AbiCoder.defaultAbiCoder().encode(["bool"], [false]) },
      expected,
      100,
    ),
    "unverified",
  );
  assert.throws(() => playgroundStatus({ ...raw, data: "0x" }, expected, 100));
  for (const data of ["0x" + "0".repeat(63) + "2", raw.data + "00".repeat(32)]) {
    assert.throws(() => playgroundStatus({ ...raw, data }, expected, 100));
  }
});
test("documented issuer ID follows current registration, never a fixed address or name", () => {
  assert.equal(issuerMetadata(PLAYGROUND_ATTESTER_ID)?.name, "TESTNET FAUCET");
  assert.equal(issuerMetadata(ZeroHash), undefined);
  const registered = [
    { id: PLAYGROUND_ATTESTER_ID, address: issuer, name: "anything", tx: "" },
  ];
  assert.equal(
    classifyIssuer(issuer, registered, governance, true).issuerClass,
    "playground",
  );
  assert.equal(
    classifyIssuer(issuer, registered, governance, true).registeredIssuer,
    true,
  );
  assert.equal(
    classifyIssuer(other, registered, governance, true).issuerClass,
    "external",
  );
  assert.equal(
    classifyIssuer(
      issuer,
      [{ ...registered[0], id: ZeroHash, name: "TESTNET FAUCET" }],
      governance,
      true,
    ).issuerClass,
    "registered",
  );
  assert.equal(
    classifyIssuer(issuer, [], governance, false).issuerClass,
    "unknown",
  );
  assert.equal(
    classifyIssuer(
      other,
      [{ ...registered[0], address: other }],
      governance,
      true,
    ).issuerClass,
    "playground",
  );
});
test("invalid lookup addresses are rejected before any network access", async () => {
  await assert.rejects(
    checkPlaygroundAttestation("not-a-wallet"),
    /유효한 지갑/,
  );
});

test("lookup uses the current Book address, bypasses cached block data and rejects RPC failures", async () => {
  const { Interface, ZeroAddress } = await import("ethers");
  const { CONTRACTS } = await import("../lib/giwa");
  const abi = new Interface([
    "function getAttester(bytes32) view returns(address)",
    "function getSchemaUid(bytes32) view returns(bytes32)",
    "function getAttestationUid(bytes32,address,address) view returns(bytes32)",
  ]);
  const originalFetch = globalThis.fetch;
  let broken = false;
  const seen: { method: string; params: any[] }[] = [];
  globalThis.fetch = async (_url, init) => {
    const call = JSON.parse(String(init?.body));
    seen.push(call);
    let result = "0x123";
    if (call.method === "eth_call") {
      assert.equal(call.params[1], "0x123");
      const parsed = abi.parseTransaction({ data: call.params[0].data })!;
      if (broken)
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32000, message: "unavailable" },
        });
      if (parsed.name === "getAttester") {
        assert.equal(call.params[0].to, CONTRACTS.DojangAttesterBook);
        assert.equal(parsed.args[0], PLAYGROUND_ATTESTER_ID);
        result = abi.encodeFunctionResult(parsed.name, [other]);
      } else if (parsed.name === "getSchemaUid")
        result = abi.encodeFunctionResult(parsed.name, [schema]);
      else {
        assert.equal(parsed.args[1], other);
        assert.equal(parsed.args[2], address);
        result = abi.encodeFunctionResult(parsed.name, [ZeroHash]);
      }
    }
    return Response.json({ jsonrpc: "2.0", id: 1, result });
  };
  try {
    const result = await checkPlaygroundAttestation(address);
    assert.equal(result.issuer, other);
    assert.equal(result.status, "not-found");
    assert.notEqual(result.issuer, ZeroAddress);
    broken = true;
    await assert.rejects(checkPlaygroundAttestation(address), /unavailable/);
    assert.equal(seen.filter((c) => c.method === "eth_blockNumber").length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lookup confirms a matching EAS record but rejects a changed schema format", async () => {
  const { Interface, ZeroAddress } = await import("ethers");
  const { CONTRACTS } = await import("../lib/giwa");
  const abi = new Interface([
    "function getAttester(bytes32) view returns(address)",
    "function getSchemaUid(bytes32) view returns(bytes32)",
    "function getAttestationUid(bytes32,address,address) view returns(bytes32)",
    "function getSchema(bytes32) view returns((bytes32 uid,address resolver,bool revocable,string schema))",
    "function getAttestation(bytes32) view returns((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))",
  ]);
  const originalFetch = globalThis.fetch;
  let definition = "bool isVerified";
  let easReads = 0;
  globalThis.fetch = async (_url, init) => {
    const call = JSON.parse(String(init?.body));
    let result = "0x123";
    if (call.method === "eth_call") {
      assert.equal(call.params[1], "0x123");
      const parsed = abi.parseTransaction({ data: call.params[0].data })!;
      const values: Record<string, unknown[]> = {
        getAttester: [issuer],
        getSchemaUid: [schema],
        getAttestationUid: [uid],
        getSchema: [[schema, ZeroAddress, true, definition]],
        getAttestation: [[uid, schema, 1n, 0n, 0n, ZeroHash, address, issuer, true, raw.data]],
      };
      if (parsed.name === "getSchema") {
        assert.equal(call.params[0].to, CONTRACTS.SchemaRegistry);
        assert.equal(parsed.args[0], schema);
      }
      if (parsed.name === "getAttestation") {
        assert.equal(call.params[0].to, CONTRACTS.EAS);
        assert.equal(parsed.args[0], uid);
        easReads++;
      }
      result = abi.encodeFunctionResult(parsed.name, values[parsed.name]);
    }
    return Response.json({ jsonrpc: "2.0", id: 1, result });
  };
  try {
    assert.equal((await checkPlaygroundAttestation(address)).status, "confirmed");
    definition = "uint256 balance";
    await assert.rejects(checkPlaygroundAttestation(address), /스키마/);
    assert.equal(easReads, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
