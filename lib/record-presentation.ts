import { SCHEMAS } from "./giwa";

/** A schema describes a format, never a verified identity or current entitlement. */
export function recordKind(schema: string | null, uid: string, ko: boolean) {
  const known = SCHEMAS.find(
    (s) => s.uid.toLowerCase() === schema?.toLowerCase(),
  );
  return known
    ? ko
      ? `${known.label} 형식`
      : `${known.name} format`
    : ko
      ? "발급 기록"
      : "Issuance record";
}

/** A neutral format label; payload values and identifiers never become the title. */
export function recordedHeadline(
  value: unknown,
  schema: string,
  uid: string,
  ko: boolean,
) {
  return recordKind(schema, uid, ko);
}

export function historyLabel(event: string, ko: boolean) {
  return (
    {
      Attested: ko ? "발급 기록" : "Issuance recorded",
      Revoked: ko ? "철회 기록" : "Revocation recorded",
      AttestationIndexed: ko
        ? "조회 연결 정보 등록"
        : "Lookup association recorded",
    }[event] ?? (ko ? "관련 계약 기록" : "Related contract record")
  );
}
