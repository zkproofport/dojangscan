# Validation

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
- Check Korean/English, light/dark, mobile layout, the three workspace tools, and the coming-soon Proof Studio in a browser.
- Real operator writes require an authorized wallet and wallet approval. Proof Studio mobile integration is not implemented.

## Latest validation · 2026-10-08

- Type checking (including unused imports), 13 unit tests, and production build passed.
- Public-chain read checks passed at block **38,070,062**: 50 records, 4 current schemas, 10 registered issuers, 10 deployed contracts. Verified current schema membership, administrator roles, and a real Console `hasRole` call.
- Browser checks covered the Korean/English Proof Studio, dark appearance, light-theme issuer/administrator forms, download links, footer, and disabled write controls without a connected wallet.
- No public-chain transactions or deployment were performed during this change. Mobile viewport and authorized-wallet writes were not re-tested in this pass.
