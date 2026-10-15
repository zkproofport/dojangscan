import { test } from "node:test";
import assert from "node:assert/strict";
import { TypedDataEncoder, ZeroHash, keccak256, toUtf8Bytes } from "ethers";
import type { RelayProofResult } from "@zkproofport-app/sdk";
import {
  STUDIO_CHAIN,
  STUDIO_PROFILES,
  MOCK_KYC_SIGNER_ROOT,
  STUDIO_CIRCUIT,
  STUDIO_SCOPE,
  STUDIO_VERIFIER,
  practiceAction,
  prepareStudioProof,
  walletNullifier,
  studioPublicFields,
  responseContainsAddress,
} from "../lib/proof-studio";

const address = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const action = practiceAction("0x" + "11".repeat(32));
const fields = (hex: string) =>
  hex
    .slice(2)
    .match(/../g)!
    .map((byte) => "0x" + byte);
function result(): RelayProofResult {
  return {
    requestId: "practice-1",
    status: "completed",
    circuit: STUDIO_CIRCUIT,
    chainId: STUDIO_CHAIN,
    verifierAddress: STUDIO_VERIFIER,
    proof: "0xcafe",
    publicInputs: [
      ZeroHash,
      TypedDataEncoder.hashDomain(action.domain),
      TypedDataEncoder.hashStruct(
        action.primaryType,
        action.types,
        action.message,
      ),
      keccak256(toUtf8Bytes(STUDIO_SCOPE)),
      walletNullifier(address),
    ].flatMap(fields),
  };
}
const prepare = (
  response = result(),
  wallet = address,
  expectedAction = action,
) => prepareStudioProof(response, "practice-1", wallet, expectedAction);

test("a matching proof is prepared for a pinned verifier, not marked cryptographically verified", () => {
  const accepted = prepare();
  assert.equal(accepted.nullifier, walletNullifier(address));
  assert.equal(accepted.publicInputs.length, 160);
  assert.equal(
    accepted.publicInputs.every((v) => /^0x[0-9a-f]{64}$/.test(v)),
    true,
  );
  assert.equal("verified" in accepted, false);
});
test("a prior practice proof cannot answer a fresh session, even with rewritten relay metadata", () => {
  const next = practiceAction("0x" + "22".repeat(32));
  assert.throws(() => prepare(result(), address, next), /이번 실습 요청/);
  assert.throws(
    () => prepare({ ...result(), requestId: "other" }),
    /다른 요청/,
  );
});
test("the proof must use the same wallet checked in Dojangscan", () => {
  assert.throws(() => prepare(result(), other), /지갑이 다릅니다/);
  assert.notEqual(walletNullifier(address), walletNullifier(other));
});
test("terminal labels, circuit, chain and verifier cannot be substituted", () => {
  for (const patch of [
    { status: "pending" },
    { status: "expired" },
    { status: "cancelled" },
    { circuit: "giwa_attestation" },
    { chainId: 84532 },
    { verifierAddress: other },
  ]) {
    assert.throws(() => prepare({ ...result(), ...patch } as RelayProofResult));
  }
});
test("identity proofs, another domain, scope, action and a changed nullifier are refused", () => {
  for (const index of [0, 32, 64, 96, 128]) {
    const response = result();
    response.publicInputs![index] =
      response.publicInputs![index] === "0xff" ? "0x00" : "0xff";
    assert.throws(() => prepare(response));
  }
});
test("malformed or non-byte fields and wrong input counts cannot be silently coerced", () => {
  for (const value of ["0x100", "0x", "-1", "NaN", "0xgg", null, 0]) {
    const response = result();
    response.publicInputs![159] = value as string;
    assert.throws(() => prepare(response), /공개 입력/);
  }
  for (const length of [0, 128, 159, 161, 192]) {
    assert.throws(
      () => prepare({ ...result(), publicInputs: Array(length).fill("0x00") }),
      /공개 입력/,
    );
  }
  for (const proof of ["", "0x", "0x1", "garbage"])
    assert.throws(() => prepare({ ...result(), proof }), /증명 데이터/);
});
test("practice sessions require a full unpredictable-size bytes32 value", () => {
  for (const session of ["", "0x1", "text", "0x" + "ff".repeat(33)])
    assert.throws(() => practiceAction(session));
});

test("inspection retains the actual SDK response, including unexpected fields, independently of verifier normalization", () => {
  const response = { ...result(), walletAddress: address };
  const accepted = prepare(response);
  assert.deepEqual(accepted.response, response);
  assert.equal(accepted.response.publicInputs![0], "0x00");
  assert.equal(accepted.publicInputs[0], ZeroHash);
  response.publicInputs![0] = "0xff";
  assert.equal(accepted.response.publicInputs![0], "0x00");
  assert.equal(responseContainsAddress(accepted, address), true);
});

test("inspection shows actual public values and distinguishes a missing literal address from a linkable nullifier", () => {
  const accepted = prepare();
  const fields = studioPublicFields(accepted);
  assert.deepEqual(
    fields.map((field) => field.value),
    [
      ZeroHash,
      TypedDataEncoder.hashDomain(action.domain),
      TypedDataEncoder.hashStruct(
        action.primaryType,
        action.types,
        action.message,
      ),
      keccak256(toUtf8Bytes(STUDIO_SCOPE)),
      walletNullifier(address),
    ],
  );
  assert.equal(responseContainsAddress(accepted, address), false);
  assert.equal(fields[4].value, walletNullifier(address));
  const altered = { ...accepted, publicInputs: [...accepted.publicInputs] };
  // The check also catches an address encoded across byte-valued fields.
  for (let i = 0; i < 20; i++) altered.publicInputs[32 + i] = "0x11";
  assert.equal(responseContainsAddress(altered, address), true);
});

test("mock KYC binds its own 192-field layout, issuer root, wallet, session, scope and verifier", () => {
  const circuit = "giwa_attestation";
  const profile = STUDIO_PROFILES[circuit];
  const mockAction = practiceAction("0x" + "33".repeat(32), circuit);
  const response: RelayProofResult = {
    ...result(),
    circuit,
    verifierAddress: profile.verifier,
    publicInputs: [
      ZeroHash,
      TypedDataEncoder.hashDomain(mockAction.domain),
      TypedDataEncoder.hashStruct(
        mockAction.primaryType,
        mockAction.types,
        mockAction.message,
      ),
      MOCK_KYC_SIGNER_ROOT,
      keccak256(toUtf8Bytes(profile.scope)),
      walletNullifier(address, circuit),
    ].flatMap(fields),
  };
  const accept = (r = response, wallet = address, a = mockAction) =>
    prepareStudioProof(r, "practice-1", wallet, a, circuit);
  const proof = accept();
  assert.equal(proof.circuit, circuit);
  assert.equal(studioPublicFields(proof).length, 6);
  assert.equal(studioPublicFields(proof)[3].value, MOCK_KYC_SIGNER_ROOT);
  assert.notEqual(proof.nullifier, walletNullifier(address));
  for (const index of [0, 32, 64, 96, 128, 160]) {
    const changed = structuredClone(response);
    changed.publicInputs![index] =
      changed.publicInputs![index] === "0xff" ? "0x00" : "0xff";
    assert.throws(() => accept(changed));
  }
  assert.throws(() => accept(response, other), /지갑이 다릅니다/);
  assert.throws(() =>
    accept(response, address, practiceAction("0x" + "44".repeat(32), circuit)),
  );
  assert.throws(() =>
    accept({ ...response, verifierAddress: STUDIO_VERIFIER }),
  );
  assert.throws(() =>
    accept({ ...response, publicInputs: result().publicInputs }),
  );
  assert.throws(() =>
    prepareStudioProof(response, "practice-1", address, mockAction),
  );
});
