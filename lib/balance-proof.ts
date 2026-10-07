import {
  AbiCoder,
  Signature,
  SigningKey,
  TypedDataEncoder,
  ZeroAddress,
  ZeroHash,
  getAddress,
  getBytes,
  hexlify,
  id,
  solidityPackedKeccak256,
  toBeHex,
} from "ethers";
import { inspectOffchain, type OffchainExport } from "./offchain";
export const BALANCE_PROFILE = "dojang-scan:offchain-balance:v1";
export const BALANCE_SCHEMA = solidityPackedKeccak256(
  ["string", "address", "bool"],
  ["uint256 balanceKRW", ZeroAddress, true],
);
export const PUBLIC_INPUT_COUNT = 159;
const bytes = (hex: string) => Array.from(getBytes(hex));
export type BalanceStatement = {
  profile: string;
  issuer: string;
  recipient: string;
  registry: string;
  domainSeparator: string;
  issuedAt: string;
  expiration: string;
  threshold: string;
  scope: string;
  nullifier: string;
};
export type BalanceProof = {
  statement: BalanceStatement;
  publicInputs: string[];
  proof: string;
  vkHash: string;
  elapsedMs: number;
  circuitHash: string;
};
export function buildBalanceInputs(
  raw: unknown,
  expectedIssuer: string,
  threshold: string,
  scopeLabel: string,
  registry = ZeroAddress,
) {
  const checked = inspectOffchain(raw, expectedIssuer);
  const outer = raw as Record<string, unknown>;
  const a = (outer.sig ?? raw) as OffchainExport;
  const m = a.message;
  if (
    a.version !== 2 ||
    checked.schema.toLowerCase() !== BALANCE_SCHEMA.toLowerCase() ||
    m.revocable !== true ||
    m.refUID !== ZeroHash
  )
    throw new Error(
      "Use a revocable EAS v2 uint256 balanceKRW document with zero refUID.",
    );
  if (
    checked.expired ||
    checked.futureIssued ||
    BigInt(checked.expirationTime) === 0n
  )
    throw new Error("A current document with a finite expiry is required.");
  if (
    !/^\d+$/.test(threshold) ||
    BigInt(threshold) < 1n ||
    BigInt(threshold) >= 2n ** 128n
  )
    throw new Error("Threshold must be a positive uint128.");
  if (!scopeLabel.trim()) throw new Error("Enter a scope.");
  const encoded = String(m.data);
  if (getBytes(encoded).length !== 32)
    throw new Error("Expected one canonical uint256 field.");
  const balance = BigInt(
    AbiCoder.defaultAbiCoder().decode(["uint256"], encoded)[0],
  );
  if (balance >= 2n ** 128n)
    throw new Error("This prototype supports balances below 2^128.");
  if (balance < BigInt(threshold))
    throw new Error("Balance condition not met.");
  const signature = Signature.from(a.signature);
  const key = getBytes(SigningKey.recoverPublicKey(checked.digest, signature));
  const scope = id(scopeLabel);
  const issuer = getAddress(expectedIssuer),
    recipient = getAddress(checked.recipient);
  registry = getAddress(registry);
  const domainSeparator = TypedDataEncoder.hashDomain(a.domain);
  const nullifier = solidityPackedKeccak256(
    ["bytes32", "address", "address", "address", "bytes32"],
    [m.salt, recipient, issuer, registry, scope],
  );
  const statement: BalanceStatement = {
    profile: BALANCE_PROFILE,
    issuer,
    recipient,
    registry,
    domainSeparator,
    issuedAt: String(m.time),
    expiration: checked.expirationTime,
    threshold: BigInt(threshold).toString(),
    scope,
    nullifier,
  };
  const inputs = {
    issuer: bytes(issuer),
    registry: bytes(registry),
    recipient: bytes(recipient),
    domain_separator: bytes(domainSeparator),
    issued_at: String(m.time),
    expiration: checked.expirationTime,
    threshold: BigInt(threshold).toString(),
    scope: bytes(scope),
    nullifier: bytes(nullifier),
    balance: balance.toString(),
    salt: bytes(String(m.salt)),
    pubkey_x: Array.from(key.slice(1, 33)),
    pubkey_y: Array.from(key.slice(33)),
    signature: bytes(signature.r + signature.s.slice(2)),
  };
  return { statement, inputs };
}
export function statementInputs(s: BalanceStatement) {
  if (s.profile !== BALANCE_PROFILE)
    throw new Error("Unsupported proof profile.");
  return [
    ...bytes(s.issuer),
    ...bytes(s.registry),
    ...bytes(s.recipient),
    ...bytes(s.domainSeparator),
    s.issuedAt,
    s.expiration,
    s.threshold,
    ...bytes(s.scope),
    ...bytes(s.nullifier),
  ].map((v) => toBeHex(BigInt(v), 32));
}
export function validateProofEnvelope(proof: BalanceProof) {
  const expected = statementInputs(proof.statement);
  if (
    expected.length !== PUBLIC_INPUT_COUNT ||
    proof.publicInputs.length !== PUBLIC_INPUT_COUNT ||
    expected.some((v, i) => v !== toBeHex(BigInt(proof.publicInputs[i]), 32))
  )
    throw new Error("Public inputs do not match the displayed statement.");
  if (getBytes(proof.proof).length < 1000)
    throw new Error("Invalid proof bytes.");
}
export function exportBalanceProof(proof: BalanceProof) {
  validateProofEnvelope(proof);
  return {
    ...proof,
    proof: hexlify(getBytes(proof.proof)),
    sourceRevocationProven: false,
    issuerAuthorization:
      "explicit expected issuer; no Dojang allowlist membership proof",
    holderAuthorization:
      "recipient must submit onchain; no private identity claim",
  };
}
