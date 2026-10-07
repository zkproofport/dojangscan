import "./polyfills";
import { Noir } from "@noir-lang/noir_js";
import type { CompiledCircuit } from "@noir-lang/types";
import { UltraHonkBackend } from "@aztec/bb.js";
import { hexlify, getBytes, keccak256, sha256 } from "ethers";
import {
  validateProofEnvelope,
  type BalanceProof,
} from "../../lib/balance-proof";
self.onmessage = async (event: MessageEvent) => {
  let backend: UltraHonkBackend | undefined;
  try {
    const { circuit, inputs, statement, proof } = event.data;
    const started = performance.now();
    const circuitHash = sha256(
      new TextEncoder().encode(JSON.stringify(circuit)),
    );
    self.postMessage({ phase: "witness" });
    backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
    if (proof) {
      validateProofEnvelope(proof);
      self.postMessage({ phase: "verify" });
      const key = await backend.getVerificationKey({ keccakZK: true });
      if (keccak256(key) !== proof.vkHash || proof.circuitHash !== circuitHash)
        throw new Error("Proof uses a different circuit or verification key.");
      const valid = await backend.verifyProof(
        { proof: getBytes(proof.proof), publicInputs: proof.publicInputs },
        { keccakZK: true },
      );
      self.postMessage({
        result: { valid, elapsedMs: Math.round(performance.now() - started) },
      });
      return;
    }
    const noir = new Noir(circuit as CompiledCircuit);
    const { witness } = await noir.execute(inputs);
    self.postMessage({ phase: "prove" });
    const generated = await backend.generateProof(witness, { keccakZK: true });
    self.postMessage({ phase: "verify" });
    const verified = await backend.verifyProof(generated, { keccakZK: true });
    if (!verified) throw new Error("Generated proof failed verification.");
    const vk = await backend.getVerificationKey({ keccakZK: true });
    const result: BalanceProof = {
      statement,
      publicInputs: generated.publicInputs,
      proof: hexlify(generated.proof),
      vkHash: keccak256(vk),
      circuitHash,
      elapsedMs: Math.round(performance.now() - started),
    };
    validateProofEnvelope(result);
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  } finally {
    await backend?.destroy();
  }
};
