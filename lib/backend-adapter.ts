import type { Attestation } from "./giwa";
import type { BackendDetail, BackendProjection } from "./backend-api";

// Reuse the existing identity/decoded-field UI shape without inventing unavailable
// revocationTime/refUID/revocable/catalog/governance values from the legacy RPC model.
export type IndexedAttestation = Pick<
  Attestation,
  "uid" | "schema" | "recipient" | "attester" | "fields"
> & {
  status: "active" | "revoked" | "expired" | "unknown";
  indexStatus: "selected" | "not-selected" | "unknown";
  currentDecision: "UNKNOWN";
  projection: BackendProjection;
};
export function adaptProjection(p: BackendProjection): IndexedAttestation {
  const status =
    p.notRevoked === false
      ? "revoked"
      : p.notExpired === false
        ? "expired"
        : p.issued === true && p.notRevoked === true && p.notExpired === true
          ? "active"
          : "unknown";
  return {
    uid: p.uid,
    schema: p.schema,
    recipient: p.recipient,
    attester: p.issuer,
    fields: Object.entries(p.fields).map(([name, value]) => ({
      name,
      type: "decoded",
      value,
    })),
    status,
    indexStatus:
      p.currentIndexSelected === true
        ? "selected"
        : p.currentIndexSelected === false
          ? "not-selected"
          : "unknown",
    currentDecision: "UNKNOWN",
    projection: p,
  };
}
export function adaptDetail(detail: BackendDetail) {
  return { meta: detail.meta, record: adaptProjection(detail.data) };
}
