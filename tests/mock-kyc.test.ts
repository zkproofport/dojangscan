import { test } from "node:test";
import assert from "node:assert/strict";
import { Interface, ZeroHash, zeroPadValue } from "ethers";
import {
  checkMockKycAttestation,
  MOCK_KYC_SCHEMA,
  MOCK_KYC_SIGNER,
} from "../lib/mock-kyc";
import { CONTRACTS, TEST_ATTESTER } from "../lib/giwa";
import { ATTESTED_TOPIC } from "../lib/history";

const address = "0x1111111111111111111111111111111111111111";
const uid = "0x" + "ab".repeat(32);
const abi = new Interface([
  "function attester() view returns (address)",
  "function verifiedAccountSchema() view returns (bytes32)",
  "function getAttestation(bytes32) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))",
]);
test("mock registration lookup pins its issuer/schema and checks current EAS state; incomplete data is not absence", async () => {
  const original = globalThis.fetch;
  let state = "confirmed";
  let pages = 0;
  globalThis.fetch = (async (_url, options) => {
    if (!options?.body) {
      pages++;
      if (state === "broken") return Response.json({ items: [] });
      const event = {
        topics: [
          ATTESTED_TOPIC,
          zeroPadValue(address, 32),
          zeroPadValue(TEST_ATTESTER, 32),
          MOCK_KYC_SCHEMA,
        ],
        data: uid,
        block_number: 10,
      };
      const next = { block_number: 9, index: 1, items_count: 50 };
      return Response.json({
        items: state === "missing" || state === "loop" ? [] : [event],
        next_page_params: state === "loop" ? next : null,
      });
    }
    const request = JSON.parse(String(options.body));
    if (request.method === "eth_blockNumber")
      return Response.json({ result: "0x20" });
    assert.equal(request.params[1], "0x20");
    const parsed = abi.parseTransaction({ data: request.params[0].data })!;
    let value: unknown;
    if (parsed.name === "attester")
      value = state === "wrong-signer" ? address : MOCK_KYC_SIGNER;
    else if (parsed.name === "verifiedAccountSchema") value = MOCK_KYC_SCHEMA;
    else {
      assert.equal(request.params[0].to, CONTRACTS.EAS);
      assert.equal(parsed.args[0], uid);
      value = [
        uid,
        MOCK_KYC_SCHEMA,
        1,
        state === "expired" ? 2 : 0,
        state === "revoked" ? 2 : 0,
        ZeroHash,
        state === "wrong-wallet" ? MOCK_KYC_SIGNER : address,
        TEST_ATTESTER,
        true,
        zeroPadValue("0x01", 32),
      ];
    }
    return Response.json({
      result: abi.encodeFunctionResult(parsed.name, [value]),
    });
  }) as typeof fetch;
  try {
    await assert.rejects(checkMockKycAttestation("not-an-address"), /유효한/);
    assert.equal(pages, 0);
    for (state of ["confirmed", "revoked", "expired", "missing"]) {
      const found = await checkMockKycAttestation(address);
      assert.equal(found.status, state === "missing" ? "not-found" : state);
    }
    for (state of ["wrong-signer", "wrong-wallet", "broken", "loop"]) {
      await assert.rejects(checkMockKycAttestation(address));
    }
  } finally {
    globalThis.fetch = original;
  }
});
