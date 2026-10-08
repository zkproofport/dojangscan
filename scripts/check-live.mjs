import assert from "node:assert/strict";
import { queryScan } from "../lib/scan-data.ts";
import { NETWORK, CONTRACTS } from "../lib/giwa.ts";
import { Interface } from "ethers";
import { inspectCapabilities, requireDojangSchema } from "../lib/workspace.ts";
import {
  fetchVerifiedABI,
  consoleInterface,
  prepareConsole,
  readConsole,
} from "../lib/contract-console.ts";
const overview = await queryScan("overview");
assert(overview.block > 0 && overview.attestations.length > 0);
const first = overview.attestations[0];
const [detail, schema, tx, wallet, contracts, search, page] = await Promise.all(
  [
    queryScan("attestation", { uid: first.uid }),
    queryScan("schema", { uid: first.schema }),
    queryScan("transaction", { hash: first.tx }),
    queryScan("wallet", { address: first.recipient }),
    queryScan("contracts"),
    queryScan("search", { value: first.uid }),
    fetch("http://127.0.0.1:4317/"),
  ],
);
assert.equal(detail.uid, first.uid);
assert.equal(schema.uid.toLowerCase(), first.schema.toLowerCase());
assert(tx.attestations.some((a) => a?.uid === first.uid));
assert.equal(wallet.address.toLowerCase(), first.recipient.toLowerCase());
assert(contracts.contracts.every((c) => c.deployed === true));
assert.equal(search.type, "attestation");
assert.equal(page.status, 200);
const registered = overview.schemas.find((s) => s.current && s.id);
assert(registered);
await requireDojangSchema(registered.uid, registered.id);
const roles = overview.governance.roles.filter((r) => r.active === true);
const roleABI = new Interface([
  "function hasRole(bytes32,address) view returns(bool)",
]);
for (const role of roles) {
  const response = await fetch(NETWORK.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: CONTRACTS[role.contract],
          data: roleABI.encodeFunctionData("hasRole", [
            role.roleId,
            role.address,
          ]),
        },
        "0x" + overview.block.toString(16),
      ],
    }),
  });
  const body = await response.json();
  assert.equal(roleABI.decodeFunctionResult("hasRole", body.result)[0], true);
}
const admin = roles.find(
  (r) => r.contract === "DojangAttesterBook" && r.role === "admin",
);
assert(admin);
const permissions = await inspectCapabilities(admin.address, "");
assert(
  permissions.books.find((b) => b.contract === "DojangAttesterBook")
    .registrationAdmin,
);
const ordinary = await inspectCapabilities(
  "0x1111111111111111111111111111111111111111",
  "",
);
assert(ordinary.books.every((b) => !b.registrationAdmin));
const abi = consoleInterface(
  JSON.stringify(await fetchVerifiedABI(CONTRACTS.DojangAttesterBook)),
);
const call = prepareConsole(
  CONTRACTS.DojangAttesterBook,
  abi,
  "hasRole",
  [admin.roleId, admin.address],
  "0",
);
assert.equal((await readConsole(call, abi))[0], true);
console.log(
  JSON.stringify({
    block: overview.block,
    records: overview.attestations.length,
    registeredSchemas: overview.schemas.filter((s) => s.current).length,
    issuers: overview.issuers.length,
    contracts: contracts.contracts.length,
    schemaMembership: true,
    adminRoles: true,
    unauthorizedRoleFalse: true,
    realConsoleRead: true,
  }),
);
