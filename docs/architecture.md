# Dojang Scan architecture

## Read architecture

```text
Static HTML / React browser app
  ├─ Public GIWA RPC → fixed EAS / SchemaRegistry / Book contracts
  ├─ Public explorer API → indexed logs, registration and role discovery
  ├─ EIP-712 JSON → browser-local signature / UID / domain checks
  ├─ Fixed CIP-4 verifier → browser RPC eth_call
  └─ User-triggered SDK relay request → ZKProofport device → relay result
```

There is no application API server, cloud runtime, database, authentication layer, publishing helper, or wallet extension. Vite serves local development on 127.0.0.1:4317 and builds plain HTML/CSS/JS into dist. Relative asset paths and query-string navigation preserve future GitHub Pages project subpaths. Source can be pushed to GitHub; no deployment workflow or hosting configuration is included.

RPC/explorer hosts and contract addresses are fixed in code. CORS and public rate limits are service dependencies. In-memory request coalescing is browser-local. Discovery logs are cached for ten minutes; mapped issuer/schema state and role checks are read at a pinned block. Every catalog carries that block and a check timestamp. Recent records use the same block for issuer classification and EAS record reads. Counts describe the loaded log range, not the whole chain.

Dojang membership, issuer registration, management privileges, and credential validity are independent facts. Role candidates are discovered from RoleGranted/RoleRevoked and then checked by hasRole on the official SchemaBook and DojangAttesterBook. DEFAULT_ADMIN_ROLE and UPGRADER_ROLE are separate. These contracts are AccessControl rather than Ownable or AccessControlEnumerable. Contract roles do not prove a publisher's legal organizational identity, so there is no automatic GIWA-direct-issuer badge. Unknown/incomplete discovery produces an unconfirmed classification, not an unregistered verdict.

Offchain examples are actual signatures by ephemeral local keys over explicitly fictional data. Keys are neither exported nor persisted. They prove signature integrity, not bank balance truth. The recipe uses the existing GIWA EAS and a resolver-free user schema; it constructs ABI calls without submitting transactions. Mobile requests are user-triggered; SDK 0.3.1 marks GIWA as planned and does not require a browser-wallet signature for that circuit. The device flow still proves private wallet ownership.

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

## Role workspace and localization

The workspace prepares EAS register/attest/revoke calls and Book register/grantRole calls using fixed GIWA contract addresses. Permissions are read at one pinned block using getRoleAdmin(role) and hasRole(actualAdminRole, caller); no grant authority is inferred merely from a badge. Simulations reject contract senders to avoid treating eth_call impersonation as wallet control. No eth_sendTransaction path exists. Wallet EIP-712 signing is explicit and local, with the current EAS domain version fetched from RPC.

The balance profile builder verifies the signed source and expected issuer, restricts the example to the canonical uint256 balanceKRW schema, rejects expired/future sources and compares a positive threshold locally. Its exported design excludes the source UID, exact balance, source bytes and signature. Flags explicitly identify that no ZK proof, revocation check or onchain registration has occurred. The profile records required circuit checks, private/public inputs and the undeployed adapter/registry status.

The bilingual catalog covers navigation, data labels, evidence, guide, workspaces, examples, validation and known errors. Locale and theme are persisted locally. Document language, number/date locale, color scheme, cards, dialogs, inputs and badge colors follow the selected preferences. Theme is initialized before the app loads to reduce flashing.
