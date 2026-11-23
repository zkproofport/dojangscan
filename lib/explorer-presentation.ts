import { SCHEMAS } from "./giwa";

export function schemaTitle(uid: string | null | undefined, ko: boolean) {
  const schema = SCHEMAS.find(
    (s) => s.uid.toLowerCase() === uid?.toLowerCase(),
  );
  return schema
    ? ko
      ? schema.label
      : schema.name
    : ko
      ? "스키마 이름 미확인"
      : "Unknown schema name";
}
export function displayDate(value: string | null | undefined, ko: boolean) {
  if (!value) return ko ? "시각 미확인" : "Time unknown";
  const date = /^\d+$/.test(value)
    ? new Date(Number(value) * 1000)
    : new Date(value);
  if (!Number.isFinite(date.getTime()))
    return ko ? "시각 미확인" : "Time unknown";
  return (
    new Intl.DateTimeFormat(ko ? "ko-KR" : "en-GB", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date) + " KST"
  );
}
export function observationIsOld(
  value: string | null | undefined,
  now = Date.now(),
) {
  return (
    !value ||
    !Number.isFinite(Date.parse(value)) ||
    now - Date.parse(value) > 15 * 60_000
  );
}
export type SearchKind = "uid" | "schema" | "issuer" | "recipient";
export function resolveExplorerSearch(
  value: string,
  kind: SearchKind,
): { kind: SearchKind; value: string } | null {
  const input = value.trim();
  // Schema names are local catalog labels, never evidence of applicability.
  const schema = SCHEMAS.find((s) =>
    [s.label, s.name, s.key].some(
      (n) => n.toLowerCase() === input.toLowerCase(),
    ),
  );
  if (schema && kind !== "issuer" && kind !== "recipient")
    return { kind: "schema", value: schema.uid };
  if (
    (kind === "issuer" || kind === "recipient") &&
    /^0x[\da-f]{40}$/i.test(input)
  )
    return { kind, value: input.toLowerCase() };
  if (
    kind !== "issuer" &&
    kind !== "recipient" &&
    /^0x[\da-f]{64}$/i.test(input)
  )
    return { kind, value: input.toLowerCase() };
  return null;
}
