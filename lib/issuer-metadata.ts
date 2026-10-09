// Names are NOT returned by DojangAttesterBook. These labels come from GIWA's
// documented IDs; addresses and registration must always come from getAttester.
// Reviewed 2026-10-09. Never identify an issuer from an address or self-reported name.
export const ISSUER_METADATA_SOURCE =
  "https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts";
export const PLAYGROUND_ATTESTER_ID =
  "0xaa92f8c143657dde575de430aecaea6ca91f2e6072339b16932d426895d8d678";
const documentedIssuers: Record<string, { name: string }> = {
  "0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034": {
    name: "UPbit Korea",
  },
  [PLAYGROUND_ATTESTER_ID]: { name: "TESTNET FAUCET" },
};
export function issuerMetadata(id: string) {
  const entry = documentedIssuers[id.toLowerCase()];
  return entry ? { ...entry, source: ISSUER_METADATA_SOURCE } : undefined;
}
