import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AbiCoder,
  Interface,
  ZeroAddress,
  ZeroHash,
} from "ethers";
import { encodeFields, prepareCall, requireDojangSchema } from "../lib/workspace";
import { CONTRACTS } from "../lib/giwa";
import { setLanguage, getLanguage, setTheme } from "../lib/preferences";
import { tr } from "../lib/i18n";
const recipient = "0x1111111111111111111111111111111111111111";
const input = {
  definition: "uint256 balanceKRW",
  values: '["1000000"]',
  recipient,
  schema: "0x" + "11".repeat(32),
  id: "0x" + "22".repeat(32),
  target: recipient,
  role: ZeroHash,
  expiration: "0",
  book: "SchemaBook",
};
test("prepared EAS calldata preserves values and rejects invalid field counts and expiration", () => {
  const call = prepareCall("attest", input);
  const eas = new Interface([
    "function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) payable returns(bytes32)",
  ]);
  const [request] = eas.decodeFunctionData("attest", call.data);
  assert.equal(call.to, CONTRACTS.EAS);
  assert.equal(request.data.recipient, recipient);
  assert.equal(
    AbiCoder.defaultAbiCoder().decode(["uint256"], request.data.data)[0],
    1000000n,
  );
  assert.equal(call.value, "0x0");
  assert.throws(() => encodeFields(input.definition, "[]"), /one JSON/);
  assert.throws(
    () => prepareCall("attest", { ...input, expiration: "-1" }),
    /uint64/,
  );
  assert.throws(
    () => prepareCall("attest", { ...input, expiration: String(2n ** 64n) }),
    /uint64/,
  );
});
test("role grants and registration target the intended Book contract without sending", () => {
  const grant = prepareCall("grant", input);
  assert.equal(grant.to, CONTRACTS.SchemaBook);
  const abi = new Interface(["function grantRole(bytes32,address)"]);
  const [role, target] = abi.decodeFunctionData("grantRole", grant.data);
  assert.equal(role, ZeroHash);
  assert.equal(target, recipient);
  const issuer = prepareCall("issuer", input);
  assert.equal(issuer.to, CONTRACTS.DojangAttesterBook);
  assert.throws(
    () => prepareCall("issuer", { ...input, target: ZeroAddress }),
    /nonzero/,
  );
  assert.throws(
    () => prepareCall("book-schema", { ...input, schema: ZeroHash }),
    /nonzero/,
  );
});
test("language switching translates data labels, dynamic coverage and errors without changing technical values", () => {
  setLanguage("en");
  assert.equal(getLanguage(), "en");
  assert.equal(tr("발행자"), "Issuer");
  assert.equal(tr("조회 블록"), "Checked block");
  assert.equal(
    tr("공개 데이터 서비스 응답 오류 (429). 잠시 후 다시 시도해 주세요."),
    "Public data service error (429). Retry shortly.",
  );
  assert.equal(tr("블록 {0} · {1}", [123, "12:30"]), "Block 123 · 12:30");
  assert.equal(tr(recipient), recipient);
  setTheme("dark");
  setTheme("light");
  setLanguage("ko");
  assert.equal(tr("Issuer"), "발행자");
  assert.equal(tr("Enter a nonzero address."), "0이 아닌 주소를 입력하세요.");
});


test("guided issuance rejects arbitrary and removed schemas and checks the official Book", async () => {
  await assert.rejects(() => requireDojangSchema(input.schema), /registered Dojang/);
  const original = globalThis.fetch;
  const abi = new Interface(["function getSchemaUid(bytes32) view returns(bytes32)"]);
  let returned = input.schema;
  try {
    globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
      const request = JSON.parse(String(options?.body));
      assert.equal(request.method, "eth_call");
      assert.equal(request.params[0].to, CONTRACTS.SchemaBook);
      assert.equal(request.params[1], "latest");
      assert.equal(abi.decodeFunctionData("getSchemaUid", request.params[0].data)[0], input.id);
      return new Response(JSON.stringify({ result: abi.encodeFunctionResult("getSchemaUid", [returned]) }));
    }) as typeof fetch;
    await requireDojangSchema(input.schema, input.id);
    returned = ZeroHash;
    await assert.rejects(() => requireDojangSchema(input.schema, input.id), /no longer registered/);
    returned = "0x" + "55".repeat(32);
    await assert.rejects(() => requireDojangSchema(input.schema, input.id), /no longer registered/);
  } finally { globalThis.fetch = original; }
});
