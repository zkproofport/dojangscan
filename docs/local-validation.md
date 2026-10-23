# Development & validation / 개발·검증

## Local setup / 로컬 실행

Node.js 22.13 이상이 필요합니다. / Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open <http://127.0.0.1:4317>. Wallet actions use **GIWA Sepolia (91342)**.

## Checks / 검사

```bash
npm run check
npm test
npm run build
npm run dev
# In another terminal:
npm run test:live
```

- Unit tests cover issuer classification, calldata, wallet account/chain checks, proxy ABI loading, schema membership checks, and cache invalidation.
- Live checks read GIWA Sepolia attestations, schemas, roles, and deployed contracts. They do not send transactions.
- Check Korean/English, light/dark, mobile layout, the three workspace tools, and the Playground Proof Studio in a browser.
- Real operator writes require an authorized wallet and wallet approval. Proof Studio verification uses read-only calls; mobile end-to-end tests require the [relay and app prerequisites](workflows.md#proof-studio).

## Latest validation · 2026-10-23

- Added contract issuance and revocation with verified ABI, operator, pause and schema checks. All 38 tests and the production build passed, including seven new contract adapter tests.
- The generated Verified Address, Balance Root and Verified Code calls succeeded in read-only GIWA RPC simulations from operator `0xdC5197a8a0ba55f506CFC3DDd491e864f2340590` through `0xb7061879AB74BD9db520Be71b36eEC9BF512D5Cd`. Its explorer-verified ABI was accepted by the adapter with captured onchain operator/pause/schema results.
- Verified Balance calldata tests cover the recipient, full uint256 balance, salt, proof array and root UID. Live issuance of a dependent balance attestation and revocation were not performed.
- Browser checks covered switching to contract issuance, selecting the registered contract, all four schema forms, UID-only contract revocation, disabled execution without a wallet, and English/light and Korean/dark text. Mobile layout and actual wallet approval were not exercised.
- No public-chain transactions were sent.

## Previous validation · 2026-10-15

- Type checking, all 31 tests, and production build passed. Nine new tests cover proof field validation, request/action binding, wallet binding, malformed results, unfiltered response preservation, and address/public-field inspection. Vite reports large chunks, including the SDK's optional verifier assets.
- Browser checks covered Korean/light desktop and English/dark at a 390 × 844 mobile viewport. A real Playground record was confirmed for the public test fixture, and a relay CORS failure returned the UI to a retryable error state.
- The revised proof-type catalog was checked in Korean/dark desktop. The received-data inspector was rendered with an explicitly labeled local fixture and checked at 390 × 844 in light appearance; this checks layout, not a real proof. Temporary fixture pages were removed.
- Browser verification confirmed both proof-type cards, the mock registration email link, and a real mock attestation lookup for the public fixture `0x5A3E649208Ae15ec52496c1Ae23b2Ff89Ac02f0c` (UID `0xc3dd3813105dc8212a20d6fe04061bab9c6d3980ae8c5a729a580891590e693d`). No registration or email was sent.
- Mock KYC tests cover the 192-field layout, trusted signer root, cross-type rejection, wrong wallets/actions, issuer configuration, current EAS state, and incomplete history.
- Production relay origin access and a Playground-capable app build are prerequisites still outside this change. QR scanning, mobile proof generation, and successful live cryptographic verification were not tested end to end.
- No public-chain transactions, relay configuration changes, or deployment were performed.

## Previous validation · 2026-10-08

- Type checking (including unused imports), 13 unit tests, and production build passed.
- Public-chain read checks passed at block **38,070,062**: 50 records, 4 current schemas, 10 registered issuers, 10 deployed contracts. Verified current schema membership, administrator roles, and a real Console `hasRole` call.
- Browser checks covered the Korean/English Proof Studio, dark appearance, light-theme issuer/administrator forms, download links, footer, and disabled write controls without a connected wallet.
- No public-chain transactions or deployment were performed during this change. Mobile viewport and authorized-wallet writes were not re-tested in this pass.

## Deployment / 배포

`main`에 푸시하면 GitHub Actions가 테스트·빌드 후 `dist/`를 GitHub Pages에 배포합니다.

Pushes to `main` run tests, build the app, and deploy `dist/` to GitHub Pages.

[Workflow status / 배포 상태](https://github.com/zkproofport/dojangscan/actions/workflows/pages.yml)
