import { recordKind } from "@/lib/record-presentation";
import { getLanguage } from "@/lib/preferences";
import { SourceJSON } from "./source-json";
import { downloadJSON } from "@/lib/download-json";
import SourceContext from "./source-context";
import { RecordOverview } from "./record-context";
import RelatedRecords from "./related-records";
import { issuerMetadata } from "@/lib/issuer-metadata";
import { tr } from "@/lib/i18n";
import { formatDateTime } from "@/lib/date-time";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ExternalLink,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  RefreshCw,
} from "lucide-react";
import { ChainLoading } from "./chain-loading";
import { toast } from "sonner";
import { ZeroAddress } from "ethers";
import {
  type Attestation,
  type SchemaRecord,
  NETWORK,
  ZERO,
  short,
} from "@/lib/giwa";
import { ISSUER_EXPLANATIONS } from "@/lib/trust";
import { shareURL } from "@/lib/navigation";
import {
  getData,
  CopyButton,
  Badge,
  Status,
  IssuerStamp,
  describeRecord,
} from "./scan-ui";
export { downloadJSON } from "@/lib/download-json";
const FIELD_LABELS: Record<string, string> = {
  isVerified: "주소 인증 여부",
  balance: "기록된 잔액",
  salt: "솔트",
  proofs: "Merkle 검증 경로",
  coinType: "자산 종류",
  snapshotAt: "스냅샷 기준 시각",
  leafCount: "묶인 잔액 수",
  totalAmount: "합산 금액",
  root: "잔액 스냅샷 root",
  codeHash: "코드 식별값 (해시)",
  domain: "인증 코드 사용처",
};
export default function ScanDetail({
  record,
  schema,
  schemaUid,
  schemaBusy,
  schemaError,
  retrySchema,
  close,
  goWallet,
  goIssuer,
  goAttestation,
  goSchema,
}: {
  record: Attestation | null;
  schema: SchemaRecord | null;
  schemaUid: string;
  schemaBusy: boolean;
  schemaError: string;
  retrySchema: () => void;
  close: () => void;
  goWallet: (address: string) => void;
  goIssuer: (address: string) => void;
  goAttestation: (uid: string) => void;
  goSchema: (uid: string) => void;
}) {
  const [live, setLive] = useState<
    (Attestation & { checkedBlock?: number; checkedAt?: string }) | null
  >(record);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(!!record);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    setLive(record);
    setError("");
    if (record) {
      setBusy(true);
      getData("attestation", { uid: record.uid })
        .then((d) => {
          if (!ignore) setLive({ ...record, ...d });
        })
        .catch((e) => {
          if (!ignore) setError(e.message);
        })
        .finally(() => {
          if (!ignore) setBusy(false);
        });
    }
    return () => {
      ignore = true;
    };
  }, [record, attempt]);
  const a = live;
  const title =
    schema?.label ?? (a ? recordKind(a.schema, a.uid, getLanguage() === "ko") : tr(schemaUid ? "도장 종류" : "발급 기록"));
  return (
    <Sheet
      open={!!record || !!schemaUid}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent className="detail-sheet">
        <SheetHeader>
          <div className="detail-icon">
            <Fingerprint size={28} />
          </div>
          <SheetTitle>{tr(title)}</SheetTitle>
          <SheetDescription>
            {tr(
              schemaUid
                ? tr("스키마 정의 및 현재 등록 상태")
                : tr("조회 블록 기준 EAS 상태와 발행자 등록 정보"),
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="detail-body">
          {(schemaUid ? schemaBusy : busy) ? (
            <ChainLoading
              title={
                schemaUid
                  ? "스키마 등록 상태 조회 중…"
                  : "EAS 상태 조회 중…"
              }
              description={
                schema || record
                  ? "이전 조회 결과 표시 중"
                  : undefined
              }
            />
          ) : (schemaUid ? schemaError : error) ? (
            <div className="notice danger read-feedback" role="alert">
              <strong>{tr("최신 상태를 확인하지 못했습니다.")}</strong>
              {(schema || record) && <p>{tr("마지막 조회 결과 표시 중")}</p>}
              <p>{tr(schemaUid ? schemaError : error)}</p>
              <button
                className="secondary-button"
                onClick={
                  schemaUid
                    ? retrySchema
                    : () => {
                        setBusy(true);
                        setAttempt((v) => v + 1);
                      }
                }
              >
                {tr("다시 조회")}
              </button>
            </div>
          ) : schema || a ? (
            <p className="read-complete" role="status">
              <CheckCircle2 size={15} aria-hidden="true" />
              {tr("상태 확인 완료")}
            </p>
          ) : null}
          {schemaUid && !schema && (
            <Info label="EAS Schema UID" value={schemaUid} />
          )}
          {schema ? (
            <>
              <div className="detail-status">
                <Badge variant={schema.current ? "success" : "neutral"}>
                  {tr(
                    schema.current
                      ? tr("현재 Dojang 스키마")
                      : schema.id
                        ? tr("이전 Dojang 스키마")
                        : tr("일반 EAS 스키마"),
                  )}
                </Badge>
              </div>
              <p>{tr(schema.description)}</p>
              <h3>{tr("내용의 형식")}</h3>
              <div className="field-list">
                {schema.definition.split(",").map((v) => {
                  const [type, name] = v.trim().split(/\s+/);
                  return (
                    <div key={v}>
                      <span>
                        {tr(FIELD_LABELS[name] ?? name)}
                        <small>{tr(name)}</small>
                      </span>
                      <code>{tr(type)}</code>
                    </div>
                  );
                })}
              </div>
              <div className="trust-check">
                <ShieldCheck size={22} />
                <div>
                  <strong>
                    {tr(
                      schema.resolver === ZeroAddress
                        ? tr("별도 resolver 없는 스키마")
                        : tr("Resolver 계약 연결됨"),
                    )}
                  </strong>
                  <p>
                    {tr(
                      schema.resolver === ZeroAddress
                        ? tr(
                            "별도 Resolver가 없습니다. 다른 계약의 발급 제한 여부와는 별개입니다.",
                          )
                        : tr(
                            "Resolver의 실제 규칙은 연결된 계약에서 확인해야 합니다.",
                          ),
                    )}
                  </p>
                </div>
              </div>
              <Info
                label={tr("Resolver · 발급 규칙 계약")}
                value={schema.resolver}
              />
              <Info
                label={tr("발행 후 철회")}
                value={
                  schema.revocable ? tr("발행자가 철회 가능") : tr("철회 불가")
                }
              />
              <details className="explain-detail">
                <summary>{tr("기술 식별자와 ABI")}</summary>
                <Info label="EAS Schema UID" value={schema.uid} />
                {schema.id && (
                  <Info label="Dojang Schema ID" value={schema.id} />
                )}
                <pre className="code-box">{tr(schema.definition)}</pre>
              </details>
              <div className="detail-actions">
                <button
                  className="secondary-button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(
                        shareURL({ view: "schemas", schema: schema.uid }),
                      )
                      .then(() =>
                        toast.success(tr("링크 복사 완료")),
                      )
                  }
                >
                  {tr("링크 복사")}
                </button>
                {schema.resolver !== ZeroAddress && (
                  <a
                    className="secondary-button"
                    href={`${NETWORK.explorer}/address/${schema.resolver}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("규칙 계약 보기")}
                  </a>
                )}
              </div>
            </>
          ) : a ? (
            <>
              <RecordOverview
                schema={a.schema}
                issuer={a.attester}
                recipient={a.recipient}
                issuedAt={String(a.time)}
                fields={a.fields}
                evidenceElsewhere
                uid={a.uid}
                source={tr("현재 공개 체인 조회")}
              />
              <div className="detail-status">
                <Status value={a.status} />
                <IssuerStamp kind={a.issuerClass} />
                {busy && <RefreshCw size={14} className="spinning" />}
              </div>
              <p className="explorer-observation">
                {a.checkedAt
                  ? formatDateTime(a.checkedAt)
                  : tr("확인 시각") + ": " + tr("미확인")}
              </p>
              <p className="record-limit">
                {tr("이 기록만으로 현재 이용 자격을 확인할 수 없습니다.")}
              </p>
              {a.dojang && a.schemaName === "Verified Code" && (
                <p className="notice">
                  {tr(
                    "이 도장은 발행자가 특정 사용처에 코드를 발급한 기록입니다. 코드 식별값은 원본 코드의 해시이며, UID는 이 발급 기록의 번호입니다. 이 기록만으로 제출자의 신원이나 코드 사용 완료를 확인할 수는 없습니다.",
                  )}
                </p>
              )}

              <section className="record-state-summary">
                <Info
                  label={tr("만료 시각")}
                  value={
                    a.expirationTime ? date(a.expirationTime) : tr("기한 없음")
                  }
                />
                {a.revocationTime > 0 && (
                  <Info
                    label={tr("철회 시각")}
                    value={date(a.revocationTime)}
                  />
                )}
                <Info
                  label={tr("철회 설정")}
                  value={
                    a.revocable ? tr("발행자가 철회 가능") : tr("철회 불가")
                  }
                />
                {a.refUID !== ZERO && (
                  <div>
                    <button
                      className="text-button"
                      onClick={() => goAttestation(a.refUID)}
                    >
                      {tr("연결된 도장 보기")}
                    </button>
                  </div>
                )}
              </section>
              <details className="record-proof">
                <summary>{tr("근거·원본")}</summary>
                <SourceContext uid={a.uid} source="public" />
                <p>{tr(a.issuerName)}</p>
                {issuerMetadata(a.issuerId ?? "") && (
                  <a
                    className="text-button"
                    href={issuerMetadata(a.issuerId!)!.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("발행자 이름 출처: GIWA 공식 문서")}
                  </a>
                )}
                <div className="trust-check">
                  <ShieldCheck size={22} />
                  <div>
                    <strong>{tr("발행자 구분의 의미")}</strong>
                    <p>{tr(ISSUER_EXPLANATIONS[a.issuerClass])}</p>
                  </div>
                </div>
                <div className="checks">
                  <Check label={tr("EAS에 실제 레코드 존재")} pass />
                  <Check
                    label={tr("현재 철회되지 않음")}
                    pass={a.revocationTime === 0}
                  />
                  <Check
                    label={tr("현재 만료되지 않음")}
                    pass={
                      !a.expirationTime || a.expirationTime > Date.now() / 1000
                    }
                  />
                  <Check
                    label={tr("Dojang 스키마 목록에서 발견")}
                    pass={a.dojang}
                  />
                  <Check
                    label={tr("현재 Dojang 발행자 주소와 일치")}
                    pass={a.registeredIssuer}
                  />
                  <Check
                    label={tr("Book의 현재 관리자 권한")}
                    pass={a.managementRole}
                  />
                </div>
                <p className="fine-print">
                  {tr(
                    "미충족은 해당 근거가 확인되지 않았다는 뜻입니다. 관리자 권한은 자격증명의 진실성을 보장하지 않습니다.",
                  )}
                </p>
                <button
                  className="secondary-button"
                  onClick={() => goSchema(a.schema)}
                >
                  {tr("이 도장의 스키마·규칙")}
                </button>
                <Info
                  label={tr("확인 블록")}
                  value={String(a.checkedBlock ?? a.block ?? "—")}
                />
                {a.checkedAt && (
                  <Info
                    label={tr("확인 시각")}
                    value={formatDateTime(a.checkedAt)}
                  />
                )}
                <section className="explain-detail">
                  <h3>{tr("상태와 신뢰의 구분")}</h3>
                  <p>
                    {tr(
                      "활성은 철회·만료되지 않았다는 상태입니다. 기록 내용의 사실성, 기관의 신원, 잔액 Merkle 경로는 발행자와 서비스 정책에 따라 추가 확인해야 합니다. 현재 발행자 목록에서 빠진 과거 발행 이력도 있을 수 있습니다.",
                    )}
                  </p>
                </section>
                {a.tx && (
                  <a
                    className="secondary-button"
                    href={`${NETWORK.explorer}/tx/${a.tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("발급 트랜잭션")}
                  </a>
                )}
                <h3>{tr("기술 정보")}</h3>
                <Info label="Attestation UID" value={a.uid} />
                <Info label="EAS Schema UID" value={a.schema} />
                <SourceJSON value={a} name="attestation.json" />
                <RelatedRecords uid={a.uid} />
              </details>
              <div className="detail-actions">
                <button
                  className="secondary-button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(shareURL({ view: "explore", uid: a.uid }))
                      .then(() =>
                        toast.success(tr("링크 복사 완료")),
                      )
                  }
                >
                  {tr("링크 복사")}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => downloadJSON(a, `dojang-${short(a.uid)}.json`)}
                >
                  <Download size={14} />
                  {tr("JSON 저장")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
function date(time: number) {
  return formatDateTime(time);
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-info">
      <span>{tr(label)}</span>
      <div>
        <code>{tr(value)}</code>
        {value.startsWith("0x") && <CopyButton value={value} />}
      </div>
    </div>
  );
}
function Check({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div>
      {pass ? (
        <CheckCircle2 className="check-good" size={17} />
      ) : (
        <AlertCircle className="check-bad" size={17} />
      )}
      <span>{tr(label)}</span>
      <Badge variant={pass ? "success" : "neutral"}>
        {tr(pass ? tr("확인") : tr("미충족"))}
      </Badge>
    </div>
  );
}
