# Offchain balance proof

Compiler **nargo 1.0.0-beta.8**, runtime **@noir-lang/noir_js 1.0.0-beta.8**, prover **@aztec/bb.js 1.0.0-nightly.20250723**. Proof mode is **keccakZK**, not keccak (non-ZK).

```sh
DOJANG_NARGO=/path/to/nargo-beta8 npm run zk:compile
npm run test:zk
npm run test:zk:onchain
```

The checked-in browser artifact is `public/zk/offchain_balance.json`. Its SHA-256 is calculated over `JSON.stringify(parsedArtifact)`; a differently formatted JSON file has the same normalized hash. A circuit change requires regenerating the VK/verifier and deploying a new receipt contract. Receipt policy and proof hash values cannot be changed after deployment.

Public inputs in order:

| Offset | Fields |
|---|---|
| 0–19 | expected issuer address bytes |
| 20–39 | registry address bytes |
| 40–59 | signed recipient address bytes |
| 60–91 | EIP-712 domain separator bytes |
| 92 | issue time (u64) |
| 93 | expiry (u64) |
| 94 | threshold (u128) |
| 95–126 | scope bytes |
| 127–158 | nullifier bytes |

Each byte is a bounded Noir u8 represented canonically as one bytes32 field. The verifier key includes 16 pairing accumulator fields in addition to these 159 user inputs; callers supply the 159 user inputs only. Private inputs are balance (u128), salt, recovered secp256k1 public key and signature.

The circuit computes the fixed schema UID for `uint256 balanceKRW`, zero resolver and revocable=true. It recomputes the EAS v2 typed-data hash (version=2, refUID=0, canonical ABI balance), verifies the signature and issuer address, enforces balance >= threshold, and binds the nullifier to salt, signed recipient, issuer, registry and scope. Client inspection additionally rejects malformed EAS UID, invalid chain/contract domain and expired/future source data. Receipt policy separately checks chain, caller, domain, issuer, scope, expiry and replay.

This development circuit does **not** attest that a bank measured the amount, establish a legal issuer identity, prove Dojang allowlist membership, or verify current offchain revocation. The receipt explicitly records `sourceRevocationProven=false`. See [workflows](../docs/workflows.md).

## Solidity generation

The bb.js Solidity generation API emits a non-ZK template even with a ZK key. `scripts/prove-balance.mjs` keeps that generated verification-key section and appends `solidity/ZKHonkTemplate.sol.txt`, the Apache-2.0 ZK template from the existing ZKProofport circuit repository using the same bb nightly. The local fork test deploys ZKTranscriptLib, links the verifier and **verifies the actual keccakZK proof** before using it in EAS.

The Aztec template retains its copyright and Apache-2.0 header. Noir JS is MIT OR Apache-2.0, bb.js package is MIT, and the external Noir keccak256 dependency remains referenced by its original repository and pinned v0.1.0 tag rather than vendored. The receipt and custom circuit are development prototypes and have not undergone an external audit.
