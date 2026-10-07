# Dojang Scan architecture

## Read architecture

```text
Browser
  ├─ lists, filters, wallet lookups, decoded records
  ├─ SDK → public relay → ZKProofport device → relay result
  ├─ offchain JSON → local EIP-712/UID checks (no raw upload)
  └─ direct EAS transaction insight
          ↓ same-origin API
Cloudflare Worker
  ├─ GIWA Blockscout /api/v2/addresses/.../logs (discovery)
  ├─ pinned EAS / SchemaRegistry / SchemaBook / AttesterBook reads
  ├─ DojangScroll / AttestationIndexer wallet reads
  └─ pinned CIP-4 verifier eth_call (read only)
```

Sources are fixed hosts. The service is not an arbitrary RPC proxy. Contract and verifier addresses are fixed in source, not chosen by a relay response. Catalog discovery is validated against current registry calls. Responses contain timestamps and explicit coverage. Unavailable data produce errors/warnings rather than fabricated activity. No database/authentication is needed for these public reads. Cache coalesces simultaneous reads but is isolate-local, not a durable index. Production-scale historical search requires a durable indexer with cursors, reorg/finality policy, and rate-limited refresh.

## Credential and schema profiles

Each profile must pin issuer authorization, schema interpretation, credential signature domain/chain/version, private/public fields, holder-binding, predicate, nullifier/scope behavior, freshness, revocation, verifier/adapter version, and public input layout.

Finance: issuer identity, snapshotAt, currency/coinType and decimals, valuation basis, Merkle path and root issuer matching. Expose threshold/inclusion outcomes rather than raw balances when supported by a dedicated circuit. Do not mistake a snapshot for a current balance.

Foreign registration / professional credential: authoritative issuer, jurisdiction, credential family, validity interval, authorized renewal/revocation and holder control. Avoid public government identifiers, CI, credential numbers and low-entropy commitments. Derive unlinkable salted commitments and scoped nullifiers according to a versioned profile.

Institutions mentioned by the user are extension targets, not verified live deployments. Discovery of an unknown registration does not assign an institutional name. A schema matching an official schema is insufficient to trust its issuer.

## Offchain → ZK → onchain

A dedicated circuit must verify the canonical EAS EIP-712 digest/signature and signer membership, holder control, predicates, domain, issuer expiration/freshness and an authenticated current non-revocation witness. It must bind every public field in the registry's canonical statement digest, including chain and registry address. A generic `verify(proof)` or a proof for an unrelated mock profile is insufficient.

The draft registry expects an approved adapter `verify(bytes proof, bytes32 statementDigest)`. The adapter must transform this digest into the exact audited circuit input representation (for example two bounded 128-bit limbs); casting a Keccak digest into one BN254 field without a canonical encoding is not acceptable. Adapter implementations/circuits are not supplied or registered by this project. An immutable audited adapter and canonical digest encoding are deployment prerequisites.

Revocation root publishers must authenticate the issuer's status data and define root intervals and witness distribution. A private non-revocation proof at epoch N does not remain valid after source revocation. `isReceiptCurrent` fails after any epoch/root advancement, stale root, expiry or profile disable. Consumers must re-prove for a current epoch. EAS's standalone nonrevocable derived record remains as a historical record, not an evergreen access token.

No direct reference to a private source UID is published. A public refUID would link the derived result to the source. The public recipient is the newly designated result wallet and may be linkable; holder authorization to that recipient is a mandatory private circuit condition. The caller/recipient equality in the contract prevents a relayer from registering another recipient without an explicit future delegated flow.

The contract owner governs profiles and status roots. This is a centralized testnet trust assumption. Deployment requires a documented issuer trust set, audited circuit/adapter, derived SchemaRegistry registration, acceptable root publisher and consumption policy, then explicit activation. No private key is required to use the read explorer; these deployment prerequisites are separate.

## Snap

The embedded insight reads direct EAS attest/revoke calldata without making transactions. The supplied MetaMask Snap uses the same decoder, checks chain 91342 and EAS target, and queries the real SchemaRegistry before presenting fields. Permissions: network-access and transaction-insight only. No account keys, signing, credential storage, notifications or arbitrary origins. Unsupported batch/delegated/resolver methods explicitly say they are unsupported.

The official EAS Snap's current public chain configuration has no GIWA entry and falls back to an EASScan host. Reusing that unchanged would query the wrong network. A GIWA Snap needs distribution, SES validation, MetaMask Flask tests and allowlisting before a production install button is appropriate.
