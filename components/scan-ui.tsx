import { tr } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/date-time";
import {
  Copy,
  ArrowUpRight,
  Fingerprint,
  ShieldCheck,
  FlaskConical,
  Building2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { short, type Attestation, type IssuerClass } from "@/lib/giwa";
import { queryScan } from "@/lib/scan-data";
import { ISSUER_LABELS, ISSUER_EXPLANATIONS } from "@/lib/trust";
import { ZeroAddress } from "ethers";
import { codeField, codeLink } from "@/lib/code-records";
export async function getData<T = any>(
  kind: string,
  params: Record<string, string> = {},
): Promise<T> {
  return queryScan(kind, params) as Promise<T>;
}
export function CopyButton({
  value,
  label = "주소 복사",
}: {
  value: string;
  label?: string;
}) {
  return (
    <button
      className="icon-button"
      aria-label={tr(label)}
      onClick={() =>
        navigator.clipboard
          .writeText(value)
          .then(() => toast.success(tr("복사했습니다.")))
          .catch(() => toast.error(tr("복사하지 못했습니다.")))
      }
    >
      <Copy size={14} />
    </button>
  );
}
export function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: string;
}) {
  return <span className={"badge " + variant}>{tr(children)}</span>;
}
export function Status({ value }: { value: string }) {
  return (
    <span
      title={tr(
        "활성은 취소·만료되지 않았다는 뜻이며, 내용의 사실성을 보장하지 않습니다.",
      )}
    >
      <Badge
        variant={
          value === "active"
            ? "success"
            : value === "revoked"
              ? "danger"
              : "neutral"
        }
      >
        {tr(
          value === "active"
            ? tr("활성")
            : value === "revoked"
              ? tr("취소됨")
              : tr("만료됨"),
        )}
      </Badge>
    </span>
  );
}
export function IssuerStamp({
  kind,
  compact = false,
}: {
  kind: IssuerClass;
  compact?: boolean;
}) {
  const Icon =
    kind === "registered"
      ? ShieldCheck
      : kind === "test" || kind === "playground"
        ? FlaskConical
        : kind === "manager"
          ? Building2
          : UserRound;
  return (
    <span
      className={"issuer-stamp " + kind + (compact ? " compact" : "")}
      title={tr(ISSUER_EXPLANATIONS[kind])}
    >
      <Icon size={compact ? 13 : 15} />
      {tr(ISSUER_LABELS[kind])}
    </span>
  );
}
export function describeRecord(a: Attestation) {
  const verified = a.fields.find((f) => f.name === "isVerified");
  if (verified)
    return verified.value === "true"
      ? tr("지갑 주소의 인증 여부: 예")
      : tr("지갑 주소의 인증 여부: 아니오");
  const balance = a.fields.find((f) => f.name === "balance");
  if (balance)
    return tr("기록된 잔액 {0} · 단위는 발행자 정책 확인", [balance.value]);
  const count = a.fields.find((f) => f.name === "leafCount");
  if (count)
    return tr("{0}개 잔액을 묶은 스냅샷", [
      Number(count.value).toLocaleString(),
    ]);
  const domain = a.fields.find((f) => f.name === "domain");
  const codeHash = a.fields.find((f) => f.name === "codeHash");
  if (domain && codeHash)
    return tr("{0} · 코드 식별값 {1}", [
      domain.value,
      short(codeHash.value, 6),
    ]);
  if (domain) return tr("인증 코드의 사용처: {0}", [domain.value]);
  return a.fields.length
    ? `${a.fields[0].name}: ${a.fields[0].value.slice(0, 60)}`
    : tr("발행자가 남긴 공개 기록");
}
export function ScanCards({
  items,
  onSelect,
  onIssuer,
}: {
  items: Attestation[];
  onSelect: (a: Attestation) => void;
  onIssuer?: (address: string) => void;
}) {
  return (
    <div className="credential-grid">
      {items.map((a) => (
        <article
          className={
            "credential-card " + (a.status !== "active" ? "inactive" : "")
          }
          key={a.uid}
        >
          <div className="credential-top">
            <span className="record-origin">
              <Fingerprint size={18} />
              {a.dojang ? "DOJANG" : "EAS"}
            </span>
            <Status value={a.status} />
          </div>
          <div className="credential-body">
            <h3>{tr(a.schemaLabel)}</h3>
            <p>
              {codeField(a, "domain") ? (
                <a href={codeLink(codeField(a, "domain"), a.attester)}>
                  {tr(describeRecord(a))} ↗
                </a>
              ) : (
                tr(describeRecord(a))
              )}
            </p>
          </div>
          <div className="credential-issuer">
            <span className="credential-issuer-label">{tr("발행자")}</span>
            <div className="credential-issuer-identity">
              <button
                className="record-issuer-name text-button"
                onClick={() => onIssuer?.(a.attester)}
                disabled={!onIssuer}
                title={tr("발행한 도장 보기")}
              >
                {tr(a.issuerName)}
              </button>
              <code title={a.attester}>{short(a.attester)}</code>
              <IssuerStamp kind={a.issuerClass} compact />
            </div>
          </div>
          <div className="credential-recipient">
            <span>{tr("받은 지갑")}</span>
            <span className="recipient-value">
              {a.recipient === ZeroAddress && (
                <small>{tr("개별 수신 지갑 없음")}</small>
              )}
              <code title={a.recipient}>{short(a.recipient)}</code>
            </span>
          </div>
          <div className="credential-bottom">
            <span title={formatDateTime(a.time)}>{formatDate(a.time)}</span>
            <button
              className="record-open"
              onClick={() => onSelect(a)}
              aria-label={tr("{0} {1} 상세 확인", [
                tr(a.schemaLabel),
                short(a.uid),
              ])}
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
export function ScanTable({
  items,
  onSelect,
  onIssuer,
}: {
  items: Attestation[];
  onSelect: (a: Attestation) => void;
  onIssuer?: (address: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tr("도장")}</TableHead>
          <TableHead>{tr("발행자")}</TableHead>
          <TableHead>{tr("수신 지갑")}</TableHead>
          <TableHead>{tr("발급일")}</TableHead>
          <TableHead>{tr("상태")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((a) => (
          <TableRow key={a.uid}>
            <TableCell>
              <button className="record-link" onClick={() => onSelect(a)}>
                {tr(a.schemaLabel)}
                <span className="sub-label mono">{tr(short(a.uid))}</span>
              </button>
            </TableCell>
            <TableCell>
              <button
                className="record-issuer-name text-button"
                onClick={() => onIssuer?.(a.attester)}
                disabled={!onIssuer}
                title={tr("발행한 도장 보기")}
              >
                {tr(a.issuerName)}
              </button>
              <IssuerStamp kind={a.issuerClass} compact />
              <span className="sub-label mono" title={a.attester}>
                {short(a.attester)}
              </span>
            </TableCell>
            <TableCell className="mono">
              {a.recipient === ZeroAddress && (
                <span className="sub-label">{tr("개별 수신 지갑 없음")}</span>
              )}
              <code title={a.recipient}>{short(a.recipient)}</code>
            </TableCell>
            <TableCell title={formatDateTime(a.time)}>
              {formatDate(a.time)}
            </TableCell>
            <TableCell>
              <Status value={a.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
