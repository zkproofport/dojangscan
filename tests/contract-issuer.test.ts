import { test } from "node:test";
import assert from "node:assert/strict";
import { Interface, ZeroAddress, ZeroHash } from "ethers";
import {
  CONTRACT_ISSUER_ABI,
  inspectContractIssuer,
  prepareContractIssuerCall,
} from "../lib/contract-issuer";
import { CONTRACTS, SCHEMAS } from "../lib/giwa";
import { prepareCall } from "../lib/workspace";

const target = "0xb7061879AB74BD9db520Be71b36eEC9BF512D5Cd";
const recipient = "0xdC5197a8a0ba55f506CFC3DDd491e864f2340590";
const rootUID = "0x" + "11".repeat(32);
const salt = "0x" + "22".repeat(32);
const proof = "0x" + "33".repeat(32);
const input = {
  target,
  recipient,
  schema: SCHEMAS[0].uid,
  definition: SCHEMAS[0].definition,
  values: "[true]",
  expiration: "2000000000",
  refUID: "",
  id: rootUID,
};
const abi = new Interface(CONTRACT_ISSUER_ABI);

test("operator issuance calls the issuer rather than EAS; direct issuance is preserved", () => {
  const call = prepareContractIssuerCall("attest", input);
  assert.equal(call.to, target);
  assert.equal(call.attester, target);
  assert.equal(call.value, "0x0");
  // Decode with the deployed entry point signature, independently of the adapter ABI.
  const deployed = new Interface([
    "function attestVerifiedAddress(address,uint64)",
  ]);
  assert.deepEqual(
    [...deployed.decodeFunctionData("attestVerifiedAddress", call.data)],
    [recipient, 2000000000n],
  );
  const direct = prepareCall("attest", {
    ...input,
    role: ZeroHash,
    book: "",
    revocable: true,
  });
  assert.equal(direct.to, CONTRACTS.EAS);
  assert.notEqual(direct.data.slice(0, 10), call.data.slice(0, 10));
});

test("root and code use their dedicated entry points without a recipient", () => {
  const root = prepareContractIssuerCall("attest", {
    ...input,
    schema: SCHEMAS[1].uid,
    definition: SCHEMAS[1].definition,
    recipient: "",
    values: JSON.stringify(["123", "100", "2", "9007199254740993", rootUID]),
  });
  assert.deepEqual(
    [...abi.decodeFunctionData("attestBalanceRoot", root.data)],
    [123n, 100n, 2n, 9007199254740993n, rootUID, 2000000000n],
  );
  const code = prepareContractIssuerCall("attest", {
    ...input,
    schema: SCHEMAS[3].uid,
    definition: SCHEMAS[3].definition,
    recipient: "",
    values: JSON.stringify([rootUID, " Example.COM "]),
  });
  // Preserve the supplied domain; normalization is the contract's responsibility.
  assert.deepEqual(
    [...abi.decodeFunctionData("attestVerifiedCode", code.data)],
    [rootUID, " Example.COM ", 2000000000n],
  );
});

test("balance keeps root UID, salt, proof path and uint256 precision", () => {
  const balance = {
    ...input,
    schema: SCHEMAS[2].uid,
    definition: SCHEMAS[2].definition,
    refUID: rootUID,
    values: JSON.stringify(["9007199254740993", salt, [proof]]),
  };
  const call = prepareContractIssuerCall("attest", balance);
  const args = abi.decodeFunctionData("attestVerifiedBalance", call.data);
  assert.equal(args[0], recipient);
  assert.equal(args[1], 9007199254740993n);
  assert.equal(args[2], salt);
  assert.deepEqual([...args[3]], [proof]);
  assert.equal(args[4], rootUID);
  assert.equal(args[5], 2000000000n);
  for (const refUID of ["", ZeroHash, "0x12"])
    assert.throws(
      () => prepareContractIssuerCall("attest", { ...balance, refUID }),
      /bytes32/,
    );
});

test("contract revocation uses its recorded UID without requiring a current schema", () => {
  const call = prepareContractIssuerCall("revoke", {
    ...input,
    schema: "",
    definition: "",
    values: "",
    expiration: "",
  });
  assert.equal(call.to, target);
  assert.equal(call.operation, "revokeAttestation");
  assert.equal(
    abi.decodeFunctionData("revokeAttestation", call.data)[0],
    rootUID,
  );
  assert.throws(() =>
    prepareContractIssuerCall("revoke", { ...input, id: ZeroHash }),
  );
});

test("contract adapter rejects unsupported schemas, false verification and invalid addresses or timestamps", () => {
  for (const invalid of [
    { schema: rootUID },
    { definition: "bool different" },
    { values: "[false]" },
    { values: "[]" },
    { recipient: ZeroAddress },
    { target: ZeroAddress },
    { expiration: "-1" },
    { expiration: String(2n ** 64n) },
  ])
    assert.throws(() =>
      prepareContractIssuerCall("attest", { ...input, ...invalid }),
    );
});

function inspector(
  overrides: {
    code?: string;
    operator?: boolean;
    paused?: boolean;
    schema?: string;
    abi?: readonly string[];
  } = {},
) {
  const calls: { method: string; params: unknown[] }[] = [];
  return {
    calls,
    fetchVerifiedABI: async () => overrides.abi ?? CONTRACT_ISSUER_ABI,
    rpc: async (method: string, params: unknown[]) => {
      calls.push({ method, params });
      if (method === "eth_blockNumber") return "0x123";
      assert.equal(params[1], "0x123");
      if (method === "eth_getCode") return overrides.code ?? "0x6000";
      assert.equal(method, "eth_call");
      const request = params[0] as { to: string; data: string; from?: string };
      assert.equal(request.to, target);
      const parsed = abi.parseTransaction(request)!;
      if (parsed.name === "operators") {
        assert.equal(parsed.args[0], recipient);
        return abi.encodeFunctionResult(parsed.name, [
          overrides.operator ?? true,
        ]);
      }
      if (parsed.name === "issuancePaused")
        return abi.encodeFunctionResult(parsed.name, [
          overrides.paused ?? false,
        ]);
      return abi.encodeFunctionResult(parsed.name, [
        overrides.schema ?? input.schema,
      ]);
    },
  };
}

test("preflight checks actual contract code, verified interface, operator, pause and schema at one block", async () => {
  const call = prepareContractIssuerCall("attest", input);
  const good = inspector();
  await inspectContractIssuer(call, recipient, input.schema, good);
  assert.equal(good.calls.filter((c) => c.method === "eth_call").length, 3);
  for (const [overrides, message] of [
    [{ code: "0x" }, /컨트랙트가 아닙니다/],
    [{ abi: ["function attest(bytes data)"] }, /Contract Console/],
    [{ operator: false }, /운영 권한/],
    [{ paused: true }, /일시정지/],
    [{ schema: rootUID }, /스키마.*다릅니다/],
    [
      {
        abi: CONTRACT_ISSUER_ABI.map((s) =>
          s.replace(
            "function operators(address) view returns(bool)",
            "function operators(address) view returns(uint256)",
          ),
        ),
      },
      /Contract Console/,
    ],
  ] as const) {
    await assert.rejects(
      () =>
        inspectContractIssuer(
          call,
          recipient,
          input.schema,
          inspector(overrides),
        ),
      message,
    );
  }
});

test("revocation remains available while issuance is paused", async () => {
  const call = prepareContractIssuerCall("revoke", input);
  const dependencies = inspector({ paused: true });
  await inspectContractIssuer(call, recipient, "", dependencies);
  assert.equal(
    dependencies.calls.filter((c) => c.method === "eth_call").length,
    1,
  );
});
