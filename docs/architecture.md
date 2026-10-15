# Architecture

Static React + TypeScript application built with Vite. Relative asset paths and query-string navigation support subdirectory hosting. Public GIWA RPC and explorer APIs provide chain data and verified ABIs.

- `lib/scan-data.ts`: attestation/schema reads, registration and role discovery, cache and RPC throttling.
- `components/operator-hub.tsx`: unified issuer/administrator directories and action views; five records per page, name/address search, and Console tab. Legacy `?view=workspace` links open this hub in action mode.
- `components/workspace.tsx`: issuer and administrator forms. The official SchemaBook is re-read before guided issuance/revocation; management roles are checked through `hasRole` and `getRoleAdmin`.
- `lib/transactions.ts`: wallet account/network checks, simulation, gas estimation, transaction submission, and receipts. Confirmed writes invalidate read caches.
- `components/contract-console.tsx`: verified ABI loading (including proxy implementations), function reads and wallet execution.
- `components/proof-studio.tsx`: proof-type catalog and independent practice components; Faucet and EAS KYC Mock provide attestation lookup, mobile generation, and verification.
- `components/proof-inspector.tsx`: request ID and pinned circuit-specific verifier link, with collapsible raw proof/public inputs, full SDK response JSON, and response download.
- `lib/mock-kyc.ts`: bounded recipient-event lookup for the pinned mock issuer/schema, followed by a fresh EAS status read; independent of the official Dojang Books.
- `lib/use-proof-studio.ts`: live attestation preflight, SDK relay lifecycle, bounded polling, cancellation, and stale-response guards.
- `lib/proof-studio.ts`: session/action, scope, wallet nullifier, chain and verifier binding; GIWA Sepolia verifier calls via read-only `eth_call`.

Book registration, resolver authorization, and contract roles are separate. Contract-based attesters must be called through their operator functions. A role does not establish an organization's legal identity.

Role candidates are discovered from explorer events and checked onchain. Counts and discovery are limited to the loaded range. Wallet and issuer histories use Blockscout's paginated EAS logs filtered by address topic. Each event is checked against the exact recipient or attester topic, then hydrated from EAS. This includes nonzero-key balance/code records, earlier issuance, and currently unregistered issuers. It is not limited to the current catalog or the indexer's default key. The UI distinguishes a page with no matching issuance from the end of explorer-provided history, and reports indexing delays. Failed EAS hydration does not advance the cursor.

DojangScroll still supplies the separate current address-verification summary. Registration labels reflect the current Books, not registration at issuance time. Book discovery remains bounded; warnings describe that limitation. Linked attestation UIDs can be opened to inspect balance snapshots, but the explorer does not independently validate Merkle proofs.

Proof Studio checks current Playground issuer/schema registration and EAS revocation/expiration before requesting a proof. These are separate RPC observations: the `dojang_playground` circuit proves signatures over a faucet transaction and the practice action, not current KYC status, EAS validity, or transaction inclusion. A fresh random EIP-712 action binds each session; result metadata alone never means verified. The fixed scope binds the public nullifier to the scanned wallet, whose address is already known to this page. Practice can be repeated; there is no reward, persistent spent-nullifier registry, or single-use claim. The verifier accepts cryptographic proofs without consuming them or applying expiry. Relay request expiry is separate from proof validity. See [connection requirements](workflows.md#proof-studio).

## Analytics and loading

Google tag `G-KV5XFCT55F` is included once in `index.html`. GA4 handles its standard page views; `view_section` separately records the six navigation sections, without custom wallet/search fields. No manual `page_view` is sent, avoiding duplicates with GA4 enhanced history measurement. Blocking the tag does not block application navigation.

Onchain loading displays elapsed time and a short explanation. Public RPC calls remain rate-limited (batches of 3, at least 650 ms apart); the first overview includes registration discovery, role checks, and current attestation reads. The indicator changes to a longer-wait message after 30 seconds and disappears when loading finishes or fails.

## Issuer labels / 발행자 표시

EAS stores attestation records; Dojang adds registered schemas, issuers, and issuance rules. Issuer names use [GIWA's documented IDs](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts). Current addresses and registration come from `DojangAttesterBook.getAttester(ID)`; unknown names are not inferred.

발행자 이름은 공식 문서의 ID를 근거로 표시합니다. 현재 주소와 등록 여부는 `getAttester(ID)`로 조회하며, 관리자 역할·발행자 등록·실제 발급 권한을 각각 구분합니다.

For local setup, checks, and deployment, see [Development & validation](local-validation.md).
