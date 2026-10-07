import { test } from "node:test";
import assert from "node:assert/strict";
import { ZeroHash } from "ethers";
import { executeCall } from "../lib/transactions";
import { prepareCall } from "../lib/workspace";
import { prepareConsole, consoleInterface } from "../lib/contract-console";
const address = "0x1111111111111111111111111111111111111111";
const call = prepareCall("attest", {
  definition: "bool test",
  values: "[true]",
  recipient: address,
  schema: "0x" + "11".repeat(32),
  id: "",
  target: "",
  role: ZeroHash,
  expiration: "0",
  book: "SchemaBook",
});
function fake(
  chain = "0x164ce",
  account = address,
  code = "0x6000",
  changeDuringPreflight = false,
) {
  const methods: string[] = [];
  return {
    methods,
    source: {
      request: async ({ method }: { method: string }) => {
        methods.push(method);
        if (method === "eth_chainId") return chain;
        if (method === "eth_accounts") return [account];
        if (method === "eth_getCode") return code;
        if (method === "eth_call") {
          if (changeDuringPreflight)
            account = "0x2222222222222222222222222222222222222222";
          return "0x";
        }
        if (method === "eth_estimateGas") return "0x10000";
        throw new Error("Unexpected " + method);
      },
    },
  };
}
test("wallet execution rejects wrong chain, a changed reviewed account and undeployed targets without sending", async () => {
  for (const setup of [
    fake("0x1"),
    fake("0x164ce", "0x2222222222222222222222222222222222222222"),
    fake("0x164ce", address, "0x"),
  ]) {
    await assert.rejects(() =>
      executeCall(call, address, () => {}, setup.source),
    );
    assert(!setup.methods.includes("eth_sendTransaction"));
  }
});
test("account changes during simulation invalidate the reviewed call before wallet send", async () => {
  const setup = fake("0x164ce", address, "0x6000", true);
  await assert.rejects(
    () => executeCall(call, address, () => {}, setup.source),
    /changed/,
  );
  assert(setup.methods.includes("eth_call"));
  assert(!setup.methods.includes("eth_sendTransaction"));
});
test("console encodes bool and arrays precisely and rejects unintended ETH transfers", () => {
  const abi = consoleInterface(
    JSON.stringify([
      "function test(bool enabled,uint256[] values)",
      "function pay() payable",
    ]),
  );
  const result = prepareConsole(address, abi, "test", ["false", "[1,2]"], "0");
  const parsed = abi.decodeFunctionData("test", result.data);
  assert.equal(parsed[0], false);
  assert.deepEqual([...parsed[1]], [1n, 2n]);
  assert.throws(
    () => prepareConsole(address, abi, "test", ["no", "[]"], "0"),
    /true/,
  );
  assert.throws(
    () => prepareConsole(address, abi, "test", ["true", "[]"], "1"),
    /receive/,
  );
  assert.equal(prepareConsole(address, abi, "pay", [], "100").value, "0x64");
});

test("Blockscout address_hash resolves the proxy implementation ABI", async () => {
  const { fetchVerifiedABI } = await import("../lib/contract-console");
  const original = globalThis.fetch;
  const calls: string[] = [];
  try {
    globalThis.fetch = (async (url: unknown) => {
      const value = String(url);
      calls.push(value);
      return new Response(
        JSON.stringify(
          calls.length === 1
            ? {
                abi: ["event Upgraded(address indexed implementation)"],
                implementations: [{ address_hash: address }],
              }
            : {
                abi: [
                  "function register(bytes32,address)",
                  "function getRoleAdmin(bytes32) view returns(bytes32)",
                ],
              },
        ),
      );
    }) as typeof fetch;
    const abi = consoleInterface(
      JSON.stringify(
        await fetchVerifiedABI("0x2222222222222222222222222222222222222222"),
      ),
    );
    assert(abi.getFunction("register(bytes32,address)"));
    assert(abi.getFunction("getRoleAdmin"));
    assert(calls[1].endsWith(address));
  } finally {
    globalThis.fetch = original;
  }
});

test("confirmed-write invalidation prevents an older pending read from restoring stale state", async () => {
  const { cached, invalidateScanCache } = await import("../lib/scan-data");
  let finish: (v: number) => void = () => {};
  const old = cached(
    "test:stale",
    60_000,
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  invalidateScanCache();
  assert.equal(await cached("test:stale", 60_000, async () => 2), 2);
  finish(1);
  assert.equal(await old, 1);
  assert.equal(await cached("test:stale", 60_000, async () => 3), 2);
});
