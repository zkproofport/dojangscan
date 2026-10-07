import {
  AbiCoder,
  Interface,
  ParamType,
  ZeroAddress,
  ZeroHash,
  getAddress,
  isHexString,
  solidityPackedKeccak256,
  type Signer,
  Signature,
  toUtf8Bytes,
} from "ethers";
import { CONTRACTS, NETWORK } from "./giwa";
import { rpc } from "./scan-data";
import { inspectOffchain } from "./offchain";

export const BOOK_ABI = [
  "function register(bytes32,address)",
  "function unregister(bytes32)",
  "function getAttester(bytes32) view returns(address)",
  "function hasRole(bytes32,address) view returns(bool)",
  "function getRoleAdmin(bytes32) view returns(bytes32)",
  "function grantRole(bytes32,address)",
  "function revokeRole(bytes32,address)",
];
const schemaBook = new Interface([
  "function register(bytes32,bytes32)",
  "function unregister(bytes32)",
]);
const book = new Interface(BOOK_ABI);
const registry = new Interface([
  "function register(string,address,bool) returns(bytes32)",
]);
export const EAS_OPERATIONS_ABI = [
  "function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) payable returns(bytes32)",
  "function revoke((bytes32 schema,(bytes32 uid,uint256 value) data)) payable",
  "function timestamp(bytes32) returns(uint64)",
  "function revokeOffchain(bytes32)",
  "function getTimestamp(bytes32) view returns(uint64)",
  "function getRevokeOffchain(address,bytes32) view returns(uint64)",
];
const eas = new Interface(EAS_OPERATIONS_ABI);
const resolver = new Interface([
  "function allowAttester(address)",
  "function removeAttester(address)",
  "function setIndexer(address)",
  "function setBalanceRootSchemaUID(bytes32)",
]);
export type PreparedCall = {
  chainId: number;
  to: string;
  data: string;
  value: string;
  operation: string;
};
function uid(v: string) {
  if (!isHexString(v, 32) || v === ZeroHash)
    throw new Error("Enter a nonzero bytes32 ID.");
  return v;
}
function address(v: string) {
  const a = getAddress(v);
  if (a === ZeroAddress) throw new Error("Enter a nonzero address.");
  return a;
}
function uint64(v: string) {
  if (!/^\d+$/.test(v) || BigInt(v) > 2n ** 64n - 1n)
    throw new Error("Enter a uint64 timestamp.");
  return BigInt(v);
}
export function encodeFields(definition: string, values: string) {
  const types = definition.split(",").map((s) => ParamType.from(s.trim()));
  if (!types.length || types.some((t) => !t.name))
    throw new Error("Use named ABI fields.");
  const parsed: unknown = JSON.parse(values);
  if (!Array.isArray(parsed) || parsed.length !== types.length)
    throw new Error("Provide one JSON array value per schema field.");
  return AbiCoder.defaultAbiCoder().encode(types, parsed);
}
export function prepareCall(
  operation: string,
  input: {
    definition: string;
    values: string;
    recipient: string;
    schema: string;
    id: string;
    target: string;
    role: string;
    expiration: string;
    book: string;
    resolver?: string;
    revocable?: boolean;
    refUID?: string;
  },
): PreparedCall {
  let to: string = CONTRACTS.EAS,
    data: string;
  switch (operation) {
    case "schema":
      to = CONTRACTS.SchemaRegistry;
      encodeFields(input.definition, input.values);
      data = registry.encodeFunctionData("register", [
        input.definition,
        getAddress(input.resolver || ZeroAddress),
        input.revocable ?? true,
      ]);
      break;
    case "attest":
      data = eas.encodeFunctionData("attest", [
        {
          schema: uid(input.schema),
          data: {
            recipient: address(input.recipient),
            expirationTime: uint64(input.expiration),
            revocable: input.revocable ?? true,
            refUID: input.refUID ? uid(input.refUID) : ZeroHash,
            data: encodeFields(input.definition, input.values),
            value: 0,
          },
        },
      ]);
      break;
    case "revoke":
      data = eas.encodeFunctionData("revoke", [
        { schema: uid(input.schema), data: { uid: uid(input.id), value: 0 } },
      ]);
      break;
    case "issuer":
      to = CONTRACTS.DojangAttesterBook;
      data = book.encodeFunctionData("register", [
        uid(input.id),
        address(input.target),
      ]);
      break;
    case "book-schema":
      to = CONTRACTS.SchemaBook;
      data = schemaBook.encodeFunctionData("register", [
        uid(input.id),
        uid(input.schema),
      ]);
      break;
    case "issuer-remove":
      to = CONTRACTS.DojangAttesterBook;
      data = book.encodeFunctionData("unregister", [uid(input.id)]);
      break;
    case "schema-remove":
      to = CONTRACTS.SchemaBook;
      data = schemaBook.encodeFunctionData("unregister", [uid(input.id)]);
      break;
    case "grant":
    case "role-revoke":
      to = getAddress(
        CONTRACTS[input.book as keyof typeof CONTRACTS] || input.book,
      );
      if (!isHexString(input.role, 32))
        throw new Error("Enter a bytes32 role.");
      data = book.encodeFunctionData(
        operation === "grant" ? "grantRole" : "revokeRole",
        [input.role, address(input.target)],
      );
      break;
    case "allow":
    case "disallow":
    case "indexer":
    case "balance-root":
      to = address(
        input.book in CONTRACTS
          ? CONTRACTS[input.book as keyof typeof CONTRACTS]
          : input.book,
      );
      data = resolver.encodeFunctionData(
        {
          allow: "allowAttester",
          disallow: "removeAttester",
          indexer: "setIndexer",
          "balance-root": "setBalanceRootSchemaUID",
        }[operation],
        [
          operation === "balance-root"
            ? uid(input.schema)
            : address(input.target),
        ],
      );
      break;
    case "timestamp":
    case "offchain-revoke":
      data = eas.encodeFunctionData(
        operation === "timestamp" ? "timestamp" : "revokeOffchain",
        [uid(input.id)],
      );
      break;
    default:
      throw new Error("Unsupported operation.");
  }
  const functionName: Record<string, string> = {
    schema: "SchemaRegistry.register",
    attest: "EAS.attest",
    revoke: "EAS.revoke",
    issuer: "DojangAttesterBook.register",
    "issuer-remove": "DojangAttesterBook.unregister",
    "book-schema": "SchemaBook.register",
    "schema-remove": "SchemaBook.unregister",
    grant: "grantRole",
    "role-revoke": "revokeRole",
    allow: "allowAttester",
    disallow: "removeAttester",
    indexer: "setIndexer",
    "balance-root": "setBalanceRootSchemaUID",
    timestamp: "EAS.timestamp",
    "offchain-revoke": "EAS.revokeOffchain",
  };
  return {
    chainId: NETWORK.chainId,
    to,
    data,
    value: "0x0",
    operation: functionName[operation] || operation,
  };
}
export async function inspectCapabilities(
  caller: string,
  attesterId: string,
  role = ZeroHash,
) {
  caller = address(caller);
  if (!isHexString(role, 32)) throw new Error("Enter a bytes32 role.");
  const block = await rpc("eth_blockNumber", []);
  const results = [];
  for (const [name, to] of [
    ["SchemaBook", CONTRACTS.SchemaBook],
    ["DojangAttesterBook", CONTRACTS.DojangAttesterBook],
  ]) {
    const read = async (fn: string, args: unknown[]) =>
      book.decodeFunctionResult(
        fn,
        await rpc("eth_call", [
          { to, data: book.encodeFunctionData(fn, args) },
          block,
        ]),
      )[0];
    const roleAdmin = String(await read("getRoleAdmin", [role]));
    results.push({
      contract: name,
      address: to,
      registrationAdmin: Boolean(await read("hasRole", [ZeroHash, caller])),
      role,
      roleAdmin,
      canGrantRole: Boolean(await read("hasRole", [roleAdmin, caller])),
    });
  }
  const registered = attesterId
    ? String(
        book.decodeFunctionResult(
          "getAttester",
          await rpc("eth_call", [
            {
              to: CONTRACTS.DojangAttesterBook,
              data: book.encodeFunctionData("getAttester", [uid(attesterId)]),
            },
            block,
          ]),
        )[0],
      )
    : null;
  return {
    caller,
    block: Number(BigInt(block)),
    callerIsContract: (await rpc("eth_getCode", [caller, block])) !== "0x",
    books: results,
    registeredAddress: registered,
    registeredAddressMatches:
      registered?.toLowerCase() === caller.toLowerCase(),
  };
}
export async function simulateCall(call: PreparedCall, caller: string) {
  caller = address(caller);
  const block = await rpc("eth_blockNumber", []);
  // eth_call can impersonate a contract; do not present that as wallet authority.
  if ((await rpc("eth_getCode", [caller, block])) !== "0x")
    throw new Error(
      "This address is a contract. Prepare calldata for its own execution flow; a wallet cannot send from this address.",
    );
  const result = await rpc("eth_call", [
    { from: caller, to: call.to, data: call.data, value: call.value },
    block,
  ]);
  return {
    success: true,
    block: Number(BigInt(block)),
    from: caller,
    result,
    sent: false,
  };
}
export async function signOffchain(
  signer: Signer,
  definition: string,
  values: string,
  recipient: string,
  expiration: string,
) {
  const version = 2;
  const time = Math.floor(Date.now() / 1000);
  const expirationTime = uint64(expiration);
  if (expirationTime !== 0n && expirationTime <= BigInt(time))
    throw new Error("Expiration must be in the future.");
  const schema = solidityPackedKeccak256(
    ["string", "address", "bool"],
    [definition, ZeroAddress, true],
  );
  const data = encodeFields(definition, values);
  const schemaVersion = new Interface([
    "function version() view returns(string)",
  ]);
  const raw = await rpc("eth_call", [
    { to: CONTRACTS.EAS, data: schemaVersion.encodeFunctionData("version") },
    "latest",
  ]);
  const domain = {
    name: "EAS Attestation",
    version: String(schemaVersion.decodeFunctionResult("version", raw)[0]),
    chainId: NETWORK.chainId,
    verifyingContract: CONTRACTS.EAS,
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
  const message = {
    version,
    schema,
    recipient: address(recipient),
    time,
    expirationTime: expirationTime.toString(),
    revocable: true,
    refUID: ZeroHash,
    data,
    salt:
      "0x" +
      Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
  };
  const attester = await signer.getAddress();
  const signature = Signature.from(
    await signer.signTypedData(domain, types, message),
  ).toJSON();
  const signedUid = solidityPackedKeccak256(
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
      version,
      toUtf8Bytes(schema),
      message.recipient,
      ZeroAddress,
      time,
      expirationTime,
      true,
      ZeroHash,
      data,
      message.salt,
      0,
    ],
  );
  return {
    version,
    uid: signedUid,
    domain,
    primaryType: "Attest",
    types,
    message,
    signature,
    attester,
  };
}
export async function inspectContractRole(
  contract: string,
  caller: string,
  role = ZeroHash,
) {
  const to = getAddress(
    CONTRACTS[contract as keyof typeof CONTRACTS] || contract,
  );
  caller = address(caller);
  const block = await rpc("eth_blockNumber", []);
  const read = async (fn: string, args: unknown[]) =>
    book.decodeFunctionResult(
      fn,
      await rpc("eth_call", [
        { to, data: book.encodeFunctionData(fn, args) },
        block,
      ]),
    )[0];
  const roleAdmin = String(await read("getRoleAdmin", [role]));
  return {
    caller,
    contract,
    to,
    block: Number(BigInt(block)),
    role,
    roleAdmin,
    hasRole: Boolean(await read("hasRole", [role, caller])),
    canManage: Boolean(await read("hasRole", [roleAdmin, caller])),
  };
}
export async function readOffchainStatus(issuer: string, id: string) {
  const read = async (fn: string, args: unknown[]) =>
    String(
      eas.decodeFunctionResult(
        fn,
        await rpc("eth_call", [
          { to: CONTRACTS.EAS, data: eas.encodeFunctionData(fn, args) },
          "latest",
        ]),
      )[0],
    );
  return {
    timestamp: await read("getTimestamp", [uid(id)]),
    revokedAt: await read("getRevokeOffchain", [address(issuer), uid(id)]),
  };
}
export async function readSchema(schema: string) {
  const abi = new Interface([
    "function getSchema(bytes32) view returns((bytes32 uid,address resolver,bool revocable,string schema))",
  ]);
  const [record] = abi.decodeFunctionResult(
    "getSchema",
    await rpc("eth_call", [
      {
        to: CONTRACTS.SchemaRegistry,
        data: abi.encodeFunctionData("getSchema", [uid(schema)]),
      },
      "latest",
    ]),
  );
  return {
    exists: record.uid !== ZeroHash,
    uid: String(record.uid),
    definition: String(record.schema),
    resolver: String(record.resolver),
    revocable: Boolean(record.revocable),
  };
}
