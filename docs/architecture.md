# Architecture

Static React + TypeScript application built with Vite. Relative asset paths and query-string navigation support subdirectory hosting. Public GIWA RPC and explorer APIs provide chain data and verified ABIs.

- `lib/scan-data.ts`: attestation/schema reads, registration and role discovery, cache and RPC throttling.
- `components/operator-hub.tsx`: unified issuer/administrator directories and action views; five records per page, name/address search, and Console tab. Legacy `?view=workspace` links open this hub in action mode.
- `components/workspace.tsx`: issuer and administrator forms. The official SchemaBook is re-read before guided issuance/revocation; management roles are checked through `hasRole` and `getRoleAdmin`.
- `lib/transactions.ts`: wallet account/network checks, simulation, gas estimation, transaction submission, and receipts. Confirmed writes invalidate read caches.
- `components/contract-console.tsx`: verified ABI loading (including proxy implementations), function reads and wallet execution.
- `components/proof-studio.tsx`: coming-soon mobile proof flow and app download links. No proof generation, relay requests, or verifier is active.

Book registration, resolver authorization, and contract roles are separate. Contract-based attesters must be called through their operator functions. A role does not establish an organization's legal identity.

Role candidates are discovered from explorer events and checked onchain. Counts and discovery are limited to the loaded range. Wallet indexing currently covers the latest key=0 records, not every keyed balance or historical attestation.

Future Proof Studio integration will need wallet ownership, registered schema/issuer checks, expiration/revocation checks, schema-specific mobile proof support, request/result binding, and proof verification. These are future requirements, not implemented capabilities.

## Analytics and loading

Google tag `G-KV5XFCT55F` is included once in `index.html`. GA4 handles its standard page views; `view_section` separately records the six navigation sections, without custom wallet/search fields. No manual `page_view` is sent, avoiding duplicates with GA4 enhanced history measurement. Blocking the tag does not block application navigation.

Onchain loading displays elapsed time and a short explanation. Public RPC calls remain rate-limited (batches of 3, at least 650 ms apart); the first overview includes registration discovery, role checks, and current attestation reads. The indicator changes to a longer-wait message after 30 seconds and disappears when loading finishes or fails.
