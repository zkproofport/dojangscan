# Dojang Scan Insights — development Snap

Chain 91342 · direct GIWA EAS `attest` and `revoke` only. Queries the fixed GIWA SchemaRegistry and uses the same decoder as the web app. Public schema decoding is not issuer authentication or ZK verification.

From the project root:

```sh
npm ci
npm run build:snap
python3 -m http.server 8080 --directory snaps/dojang-insights
```

The build creates `dist/bundle.js` and updates manifest SHA-256. In a MetaMask Flask development integration, request this **local** Snap explicitly:

```js
await window.ethereum.request({
  method: 'wallet_requestSnaps',
  params: { 'local:http://localhost:8080': {} },
});
```

This package has not been published to npm or the MetaMask directory, installed into a wallet, or tested in SES/Flask. The web app therefore has no pretend production installation button. Complete these validations before distribution; review permissions during installation. Local development installation is a user action, not performed by the build.

Requested permissions are only `endowment:network-access` and `endowment:transaction-insight`. No private keys/accounts, credential storage, or transaction/signature submission.
