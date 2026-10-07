import fs from "node:fs/promises";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import {
  Wallet,
  Signature,
  TypedDataEncoder,
  ZeroHash,
  ZeroAddress,
  solidityPackedKeccak256,
  toUtf8Bytes,
  hexlify,
  keccak256,
  sha256,
} from "ethers";
import {
  buildBalanceInputs,
  validateProofEnvelope,
} from "../lib/balance-proof.ts";
import { encodeFields } from "../lib/workspace.ts";
const circuit = JSON.parse(
  await fs.readFile("public/zk/offchain_balance.json", "utf8"),
);
const signer = Wallet.createRandom(),
  now = Math.floor(Date.now() / 1000);
const domain = {
  name: "EAS Attestation",
  version: "1.4.1-beta.3",
  chainId: 91342,
  verifyingContract: "0x4200000000000000000000000000000000000021",
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
  version: 2,
  schema: solidityPackedKeccak256(
    ["string", "address", "bool"],
    ["uint256 balanceKRW", ZeroAddress, true],
  ),
  recipient: process.env.BALANCE_RECIPIENT || signer.address,
  time: now,
  expirationTime: now + 3600,
  revocable: true,
  refUID: ZeroHash,
  data: encodeFields("uint256 balanceKRW", '["1000000"]'),
  salt: ZeroHash,
};
const signature = Signature.from(
  await signer.signTypedData(domain, types, message),
);
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
    toUtf8Bytes(message.schema),
    message.recipient,
    ZeroAddress,
    now,
    message.expirationTime,
    true,
    ZeroHash,
    message.data,
    message.salt,
    0,
  ],
);
const source = {
  version: 2,
  domain,
  types,
  message,
  signature: signature.toJSON(),
  uid,
  attester: signer.address,
  primaryType: "Attest",
};
const { statement, inputs } = buildBalanceInputs(
  source,
  signer.address,
  "500000",
  "dojang-scan:balance-demo",
  process.env.BALANCE_REGISTRY || ZeroAddress,
);
const start = Date.now();
const { witness } = await new Noir(circuit).execute(inputs);
console.log("Witness generated", Date.now() - start);
const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
try {
  const proof = await backend.generateProof(witness, { keccakZK: true });
  console.log(
    "Proof generated",
    proof.publicInputs.length,
    proof.proof.length,
    Date.now() - start,
  );
  const valid = await backend.verifyProof(proof, { keccakZK: true });
  if (!valid) throw Error("Invalid proof");
  const key = await backend.getVerificationKey({ keccakZK: true });
  const result = {
    statement,
    publicInputs: proof.publicInputs,
    proof: hexlify(proof.proof),
    vkHash: keccak256(key),
    circuitHash: sha256(new TextEncoder().encode(JSON.stringify(circuit))),
    elapsedMs: Date.now() - start,
  };
  validateProofEnvelope(result);
  await fs.mkdir("contracts/src/generated", { recursive: true });
  const generated = await backend.getSolidityVerifier(key);
  const template = await fs.readFile(
    "zk/solidity/ZKHonkTemplate.sol.txt",
    "utf8",
  );
  await fs.writeFile(
    "contracts/src/generated/BalanceHonkVerifier.sol",
    generated
      .slice(0, generated.indexOf("pragma solidity ^0.8.27;"))
      .replace(/[ \t]+$/gm, "") +
      template.replace("// SPDX-License-Identifier: Apache-2.0\n", ""),
  );
  await fs.writeFile(
    "/private/tmp/dojang-balance-proof.json",
    JSON.stringify(result),
  );
  console.log(
    "Verified; exported proof and Solidity verifier",
    Date.now() - start,
  );
  const changed = { ...proof, publicInputs: [...proof.publicInputs] };
  changed.publicInputs[94] = "0x" + 500001n.toString(16).padStart(64, "0");
  if (await backend.verifyProof(changed, { keccakZK: true }))
    throw Error("Tampered threshold accepted");
  console.log("Tampered public threshold rejected");
} finally {
  await backend.destroy();
}
