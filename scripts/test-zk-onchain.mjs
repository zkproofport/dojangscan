import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { executeCall } from "../lib/transactions.ts";
import { prepareCall } from "../lib/workspace.ts";
import { queryScan } from "../lib/scan-data.ts";
import { CONTRACTS, SCHEMAS } from "../lib/giwa.ts";
import {
  ContractFactory,
  Contract,
  JsonRpcProvider,
  Interface,
  id,
  ZeroAddress,
  ZeroHash,
  solidityPackedKeccak256,
} from "ethers";
const port = 18545;
const run = (cmd, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
// Disposable local fork only. No private key or public-network send is used.
const anvil = spawn(
  "anvil",
  [
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--chain-id",
    "91342",
    "--fork-url",
    "https://sepolia-rpc.giwa.io",
    "--silent",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let log = "";
anvil.stderr.on("data", (v) => {
  log += v;
});
const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, 91342, {
  staticNetwork: true,
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (anvil.exitCode !== null) throw new Error(log || "Anvil exited");
    try {
      await provider.send("eth_blockNumber", []);
      ready = true;
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(ready, "Anvil fork did not start");
  await run("forge", [
    "build",
    "--root",
    "contracts",
    "--no-metadata",
    "--silent",
  ]);
  const signer = await provider.getSigner(0);
  const recipient = await signer.getAddress();
  const source = {
    request: ({ method, params }) => provider.send(method, params || []),
  };
  const input = {
    definition: "bool localCourse" + Date.now(),
    values: "[true]",
    recipient,
    schema: "",
    id: "",
    target: recipient,
    role: ZeroHash,
    expiration: "0",
    book: "DojangAttesterBook",
  };
  input.schema = solidityPackedKeccak256(
    ["string", "address", "bool"],
    [input.definition, ZeroAddress, true],
  );
  const registration = await executeCall(
    prepareCall("schema", input),
    recipient,
    () => {},
    source,
  );
  assert.equal(registration.status, "confirmed");
  assert.equal(registration.uids[0], input.schema);
  const issue = await executeCall(
    prepareCall("attest", input),
    recipient,
    () => {},
    source,
  );
  assert.equal(issue.status, "confirmed");
  assert(issue.uids[0]);
  input.id = issue.uids[0];
  assert.equal(
    (
      await executeCall(
        prepareCall("revoke", input),
        recipient,
        () => {},
        source,
      )
    ).status,
    "confirmed",
  );
  input.id = id("dojang-scan:offchain-test:" + Date.now());
  assert.equal(
    (
      await executeCall(
        prepareCall("timestamp", input),
        recipient,
        () => {},
        source,
      )
    ).status,
    "confirmed",
  );
  assert.equal(
    (
      await executeCall(
        prepareCall("offchain-revoke", input),
        recipient,
        () => {},
        source,
      )
    ).status,
    "confirmed",
  );
  input.id = id("dojang-scan:local-issuer:" + Date.now());
  await assert.rejects(() =>
    executeCall(prepareCall("issuer", input), recipient, () => {}, source),
  );
  const overview = await queryScan("overview");
  const admin = overview.governance.roles.find(
    (r) =>
      r.contract === "DojangAttesterBook" &&
      r.role === "admin" &&
      r.active === true,
  )?.address;
  assert(admin, "Discover current admin");
  await provider.send("anvil_impersonateAccount", [admin]);
  await provider.send("anvil_setBalance", [admin, "0x56BC75E2D63100000"]);
  const adminSource = {
    request: ({ method, params }) =>
      method === "eth_accounts"
        ? Promise.resolve([admin])
        : provider.send(method, params || []),
  };
  assert.equal(
    (
      await executeCall(
        prepareCall("issuer", input),
        admin,
        () => {},
        adminSource,
      )
    ).status,
    "confirmed",
  );
  const book = new Contract(
    CONTRACTS.DojangAttesterBook,
    [
      "function getAttester(bytes32) view returns(address)",
      "function hasRole(bytes32,address) view returns(bool)",
    ],
    provider,
  );
  assert.equal(await book.getAttester(input.id), recipient);
  const roleInput = {
    ...input,
    target: await (await provider.getSigner(1)).getAddress(),
    role: id("dojang-scan:test-role"),
  };
  assert.equal(
    (
      await executeCall(
        prepareCall("grant", roleInput),
        admin,
        () => {},
        adminSource,
      )
    ).status,
    "confirmed",
  );
  assert.equal(await book.hasRole(roleInput.role, roleInput.target), true);
  assert.equal(
    (
      await executeCall(
        prepareCall("role-revoke", roleInput),
        admin,
        () => {},
        adminSource,
      )
    ).status,
    "confirmed",
  );
  assert.equal(await book.hasRole(roleInput.role, roleInput.target), false);
  const resolverRole = new Contract(
    CONTRACTS.AddressDojangResolver,
    ["function hasRole(bytes32,address) view returns(bool)"],
    provider,
  );
  assert.equal(await resolverRole.hasRole(ZeroHash, admin), true);
  const allow = { ...input, book: "AddressDojangResolver" };
  assert.equal(
    (
      await executeCall(
        prepareCall("allow", allow),
        admin,
        () => {},
        adminSource,
      )
    ).status,
    "confirmed",
  );
  const dojang = {
    ...input,
    definition: SCHEMAS[0].definition,
    schema: SCHEMAS[0].uid,
  };
  assert.equal(
    (
      await executeCall(
        prepareCall("attest", dojang),
        recipient,
        () => {},
        source,
      )
    ).status,
    "confirmed",
  );
  assert.equal(
    (
      await executeCall(
        prepareCall("disallow", allow),
        admin,
        () => {},
        adminSource,
      )
    ).status,
    "confirmed",
  );
  await assert.rejects(() =>
    executeCall(prepareCall("attest", dojang), recipient, () => {}, source),
  );
  assert.equal(
    (
      await executeCall(
        prepareCall("issuer-remove", input),
        admin,
        () => {},
        adminSource,
      )
    ).status,
    "confirmed",
  );
  console.log(
    "Wallet execution: real EAS issue/revoke, schema, timestamp/offchain revoke, Book registration, grant/revoke role, resolver allow/remove, Dojang issuance passed on local fork",
  );

  const artifact = async (file) =>
    JSON.parse(
      await fs.readFile(
        `contracts/out/${file}.sol/${file === "BalanceHonkVerifier" ? "HonkVerifier" : file}.json`,
        "utf8",
      ),
    );
  async function deploy(file, args = [], links = {}) {
    const a = await artifact(file);
    let bytecode = a.bytecode.object;
    for (const library of Object.values(a.bytecode.linkReferences || {}))
      for (const [name, refs] of Object.entries(library)) {
        assert(links[name], `Missing ${name}`);
        for (const ref of refs)
          bytecode =
            bytecode.slice(0, 2 + ref.start * 2) +
            links[name].slice(2) +
            bytecode.slice(2 + (ref.start + ref.length) * 2);
      }
    const c = await new ContractFactory(a.abi, bytecode, signer).deploy(
      ...args,
    );
    await c.waitForDeployment();
    return c;
  }
  const libArtifact = JSON.parse(
    await fs.readFile(
      "contracts/out/BalanceHonkVerifier.sol/ZKTranscriptLib.json",
      "utf8",
    ),
  );
  const library = await new ContractFactory(
    libArtifact.abi,
    libArtifact.bytecode.object,
    signer,
  ).deploy();
  await library.waitForDeployment();
  const verifier = await deploy("BalanceHonkVerifier", [], {
    ZKTranscriptLib: await library.getAddress(),
  });
  const schemaRegistry = new Contract(
    "0x4200000000000000000000000000000000000020",
    [
      "function register(string,address,bool) returns(bytes32)",
      "function getSchema(bytes32) view returns((bytes32 uid,address resolver,bool revocable,string schema))",
    ],
    signer,
  );
  const definition =
    "bytes32 profileId,address sourceIssuer,uint128 threshold,bytes32 scope,bytes32 nullifier,bool sourceRevocationProven";
  const schema = solidityPackedKeccak256(
    ["string", "address", "bool"],
    [definition, ZeroAddress, false],
  );
  if ((await schemaRegistry.getSchema(schema)).uid === ZeroHash)
    await (
      await schemaRegistry.register(definition, ZeroAddress, false)
    ).wait();
  // Predict the next registry deployment address; generation binds proof to it.
  const nonce = await signer.getNonce("pending");
  const { getCreateAddress } = await import("ethers");
  const registryAddress = getCreateAddress({ from: recipient, nonce });
  await run(
    process.execPath,
    ["--import", "tsx", "scripts/prove-balance.mjs"],
    { BALANCE_REGISTRY: registryAddress, BALANCE_RECIPIENT: recipient },
  );
  const proof = JSON.parse(
    await fs.readFile("/private/tmp/dojang-balance-proof.json", "utf8"),
  );
  const s = proof.statement;
  const registry = await deploy("BalanceProofReceipt", [
    await verifier.getAddress(),
    "0x4200000000000000000000000000000000000021",
    schema,
    s.issuer,
    s.domainSeparator,
    s.scope,
    s.threshold,
    proof.vkHash,
    proof.circuitHash,
  ]);
  assert.equal(await registry.getAddress(), registryAddress);
  assert.equal(
    await verifier.verify(proof.proof, proof.publicInputs),
    true,
    "Solidity verifier must accept actual ZK proof",
  );
  console.log("Actual ZK proof accepted by Solidity verifier");
  const altered = [...proof.publicInputs];
  altered[94] =
    "0x" + (BigInt(s.threshold) + 1n).toString(16).padStart(64, "0");
  await assert.rejects(() => verifier.verify(proof.proof, altered));
  const other = registry.connect(await provider.getSigner(1));
  await assert.rejects(() =>
    other.registerProof.staticCall(proof.proof, proof.publicInputs),
  );
  const wrongRegistry = [...proof.publicInputs];
  wrongRegistry[20] = ZeroHash;
  await assert.rejects(() =>
    registry.registerProof.staticCall(proof.proof, wrongRegistry),
  );
  const wrongDomain = [...proof.publicInputs];
  wrongDomain[60] = ZeroHash;
  await assert.rejects(() =>
    registry.registerProof.staticCall(proof.proof, wrongDomain),
  );
  const receipt = await (
    await registry.registerProof(proof.proof, proof.publicInputs)
  ).wait();
  assert.equal(receipt.status, 1);
  const uid = await registry.receipts(s.nullifier);
  assert.notEqual(uid, ZeroHash);
  const eas = new Contract(
    "0x4200000000000000000000000000000000000021",
    [
      "function getAttestation(bytes32) view returns((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))",
    ],
    provider,
  );
  const attestation = await eas.getAttestation(uid);
  assert.equal(attestation.recipient, recipient);
  assert.equal(attestation.attester, registryAddress);
  assert.equal(attestation.revocable, false);
  assert(
    !attestation.data.includes("000f4240"),
    "Private exact balance leaked",
  );
  await assert.rejects(() =>
    registry.registerProof.staticCall(proof.proof, proof.publicInputs),
  );
  await provider.send("evm_setNextBlockTimestamp", [Number(s.expiration) + 1]);
  await provider.send("evm_mine", []);
  await assert.rejects(() =>
    registry.registerProof.staticCall(proof.proof, proof.publicInputs),
  );
  console.log(
    JSON.stringify(
      {
        network: "disposable local fork of GIWA Sepolia",
        registry: registryAddress,
        uid,
        block: receipt.blockNumber,
        realVerifier: true,
        realEAS: true,
        tamperRejected: true,
        wrongRecipientRejected: true,
        wrongRegistryRejected: true,
        wrongDomainRejected: true,
        replayRejected: true,
        expiryRejected: true,
        sourceRevocationProven: false,
      },
      null,
      2,
    ),
  );
} finally {
  provider.destroy();
  anvil.kill("SIGTERM");
}
