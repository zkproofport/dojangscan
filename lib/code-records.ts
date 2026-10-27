import {
  Interface,
  ZeroAddress,
  ZeroHash,
  getAddress,
  isAddress,
  isHexString,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import { CONTRACTS, type Attestation } from "./giwa";
import { rpc } from "./scan-data";

export type CodeFilters = {
  query: string;
  domain: string;
  issuer: string;
  status: string;
  from: string;
  to: string;
};
export const emptyCodeFilters: CodeFilters = {
  query: "",
  domain: "",
  issuer: "",
  status: "all",
  from: "",
  to: "",
};
export const codeField = (a: Attestation, name: string) =>
  a.fields.find((f) => f.name === name)?.value ?? "";
// Search is for discovery only. Exact filters and contract calls retain original values.
export function matchesUseCase(domain: string, query: string) {
  const normalize = (value: string) =>
    value.normalize("NFKC").trim().toLowerCase();
  return normalize(domain).includes(normalize(query));
}
export function readCodeFilters(query: URLSearchParams): CodeFilters {
  return {
    query: (query.get("q") ?? "").slice(0, 512),
    domain: (query.get("domain") ?? "").slice(0, 512),
    issuer: isAddress(query.get("attester") ?? "")
      ? query.get("attester")!
      : "",
    status: ["active", "expired", "revoked"].includes(query.get("status") ?? "")
      ? query.get("status")!
      : "all",
    from: validDate(query.get("from") ?? "") ? query.get("from")! : "",
    to: validDate(query.get("to") ?? "") ? query.get("to")! : "",
  };
}
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
// Date inputs use UTC so shared links select the same records in every timezone.
export function filterCodeRecords(
  records: Attestation[],
  filters: CodeFilters,
) {
  const start =
    filters.from && validDate(filters.from)
      ? Date.parse(filters.from + "T00:00:00Z") / 1000
      : -Infinity;
  const end =
    filters.to && validDate(filters.to)
      ? Date.parse(filters.to + "T00:00:00Z") / 1000 + 86400
      : Infinity;
  if (start >= end) throw new Error("시작일은 종료일보다 늦을 수 없습니다.");
  return records.filter(
    (a) =>
      matchesUseCase(codeField(a, "domain"), filters.query) &&
      (!filters.domain || codeField(a, "domain") === filters.domain) &&
      (!filters.issuer ||
        a.attester.toLowerCase() === filters.issuer.toLowerCase()) &&
      (filters.status === "all" || a.status === filters.status) &&
      a.time >= start &&
      a.time < end,
  );
}
export function codeParams(filters: CodeFilters): Record<string, string> {
  return {
    view: "codes",
    ...(filters.query ? { q: filters.query } : {}),
    ...(filters.domain ? { domain: filters.domain } : {}),
    ...(filters.issuer ? { attester: filters.issuer } : {}),
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };
}
export function codeLink(domain: string, issuer = "") {
  return (
    "?" +
    new URLSearchParams(codeParams({ ...emptyCodeFilters, domain, issuer }))
  );
}
export function codeCSV(
  records: Attestation[],
  context: { block: number; checkedAt: string; complete: boolean },
) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const iso = (time: number) =>
    time ? new Date(time * 1000).toISOString() : "";
  const rows: unknown[][] = [
    [
      "domain",
      "attester",
      "attester_id",
      "code_hash",
      "uid",
      "schema_uid",
      "recipient",
      "issued_at_utc",
      "expires_at_utc",
      "revoked_at_utc",
      "status_at_checked_block",
      "tx_hash",
      "checked_block",
      "checked_at_utc",
      "history_coverage",
    ],
  ];
  for (const a of records)
    rows.push([
      codeField(a, "domain"),
      a.attester,
      a.issuerId,
      codeField(a, "codeHash"),
      a.uid,
      a.schema,
      a.recipient,
      iso(a.time),
      iso(a.expirationTime),
      iso(a.revocationTime),
      a.status,
      a.tx,
      context.block,
      context.checkedAt,
      context.complete ? "explorer_history_loaded" : "partial_loaded_pages",
    ]);
  return "\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export const CODE_SCROLL_ABI = [
  "function isVerifiedCode(bytes32 codeHash,string domain,bytes32 attesterId) view returns(bool)",
  "function getVerifyCodeAttestationUid(bytes32 codeHash,string domain,bytes32 attesterId) view returns(bytes32)",
];
// GIWA's offchain-specs/verify-code/VerifyCodeSpec.sol. Never trim or normalize
// the original code: its exact UTF-8 bytes are hashed. Only the hash leaves this helper.
export function prepareCodeVerification(
  value: string,
  domain: string,
  kind: "code" | "hash",
) {
  if (kind === "hash") {
    const codeHash = value.trim();
    if (!isHexString(codeHash, 32))
      throw new Error("32바이트 코드 해시를 입력하세요.");
    return { codeHash, domain };
  }
  if (!value) throw new Error("전달받은 인증 코드를 입력하세요.");
  return {
    codeHash: keccak256(toUtf8Bytes(value)),
    domain: domain.replace(/ /g, "").replace(/[A-Z]/g, (c) => c.toLowerCase()),
  };
}
const scroll = new Interface(CODE_SCROLL_ABI);
const book = new Interface([
  "function getAttester(bytes32) view returns(address)",
]);
export async function verifyCode(
  input: {
    domain: string;
    codeHash: string;
    attesterId: string;
    expectedIssuer: string;
  },
  request = rpc,
) {
  if (!input.domain || input.domain.length > 512)
    throw new Error("인증 코드 사용처를 입력하세요.");
  if (!isHexString(input.codeHash, 32))
    throw new Error("32바이트 코드 해시를 입력하세요.");
  if (!isHexString(input.attesterId, 32) || input.attesterId === ZeroHash)
    throw new Error("등록 발행자를 선택하세요.");
  const expected = getAddress(input.expectedIssuer);
  const block = await request("eth_blockNumber", []);
  const read = async (
    to: string,
    abi: Interface,
    fn: string,
    args: unknown[],
  ) =>
    abi.decodeFunctionResult(
      fn,
      await request("eth_call", [
        { to, data: abi.encodeFunctionData(fn, args) },
        block,
      ]),
    )[0];
  const current = String(
    await read(CONTRACTS.DojangAttesterBook, book, "getAttester", [
      input.attesterId,
    ]),
  );
  if (
    current === ZeroAddress ||
    current.toLowerCase() !== expected.toLowerCase()
  )
    throw new Error("발행자 등록이 변경되었습니다. 목록을 새로고침하세요.");
  const args = [input.codeHash, input.domain, input.attesterId];
  const valid = Boolean(
    await read(CONTRACTS.DojangScroll, scroll, "isVerifiedCode", args),
  );
  const uid = valid
    ? String(
        await read(
          CONTRACTS.DojangScroll,
          scroll,
          "getVerifyCodeAttestationUid",
          args,
        ),
      )
    : null;
  if (valid && (!isHexString(uid, 32) || uid === ZeroHash))
    throw new Error("인증 결과의 UID를 확인할 수 없습니다.");
  return {
    ...input,
    valid,
    uid,
    block: Number(BigInt(block)),
    checkedAt: new Date().toISOString(),
  };
}
