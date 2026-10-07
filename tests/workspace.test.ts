import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AbiCoder,
  Interface,
  Signature,
  Wallet,
  ZeroAddress,
  ZeroHash,
  solidityPackedKeccak256,
  toUtf8Bytes,
} from "ethers";
import { encodeFields, prepareCall } from "../lib/workspace";
import { buildBalanceInputs, statementInputs } from "../lib/balance-proof";
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
async function credential() {
  const signer = new Wallet("0x" + "33".repeat(32));
  const schema = solidityPackedKeccak256(
    ["string", "address", "bool"],
    ["uint256 balanceKRW", ZeroAddress, true],
  );
  const now = Math.floor(Date.now() / 1000);
  const message = {
    version: 2,
    schema,
    recipient: signer.address,
    time: now,
    expirationTime: now + 3600,
    revocable: true,
    refUID: ZeroHash,
    data: encodeFields("uint256 balanceKRW", '["1000000"]'),
    salt: "0x" + "44".repeat(32),
  };
  const types = {
    Attest: [
      { name: "version", type: "uint16" },
      { name: "schema", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "time", type: "uint64" },
      { name: "expirationTime", type: "uint64" },
      { name: "revocable", type: "bool" },
      { name: "refUID", type: "bytes32" },
      { name: "data", type: "bytes" },
      { name: "salt", type: "bytes32" },
    ],
  };
  const domain = {
    name: "EAS Attestation",
    version: "1.4.1-beta.3",
    chainId: 91342,
    verifyingContract: CONTRACTS.EAS,
  };
  const uid = solidityPackedKeccak256(
    [
      "uint16",
      "bytes",
      "address",
      "address",
      "uint64",
      "uint64",
      "bool",
      "bytes32",
      "bytes",
      "bytes32",
      "uint32",
    ],
    [
      2,
      toUtf8Bytes(schema),
      signer.address,
      ZeroAddress,
      now,
      now + 3600,
      true,
      ZeroHash,
      message.data,
      message.salt,
      0,
    ],
  );
  return {
    version: 2,
    uid,
    domain,
    primaryType: "Attest",
    types,
    message,
    signature: Signature.from(
      await signer.signTypedData(domain, types, message),
    ).toJSON(),
    attester: signer.address,
  };
}
test("balance circuit inputs bind the canonical signed source and exclude private values from the public statement", async () => {
  const source = await credential();
  const result = buildBalanceInputs(source, source.attester, "500000", "demo");
  assert.equal(result.inputs.balance, "1000000");
  assert.equal(statementInputs(result.statement).length, 159);
  const publicStatement = JSON.stringify(result.statement);
  for (const secret of [
    source.uid,
    source.message.data,
    source.signature.r,
    "1000000",
  ])
    assert(!publicStatement.includes(secret));
  assert.throws(
    () => buildBalanceInputs(source, source.attester, "1000001", "demo"),
    /condition/,
  );
  assert.throws(
    () => buildBalanceInputs(source, recipient, "500000", "demo"),
    /발행자/,
  );
  assert.throws(
    () =>
      buildBalanceInputs(
        { ...source, message: { ...source.message, data: "0x00" } },
        source.attester,
        "500000",
        "demo",
      ),
    /UID/,
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
