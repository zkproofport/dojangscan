import {
  readRecordInformation,
  dojangEvidenceLabel,
  observedChangeLabel,
} from "@/lib/record-information";
import { recordedContentView, contentFieldLabel } from "@/lib/recorded-content";
import { useEffect, useRef } from "react";
import type { BackendDetail } from "@/lib/backend-api";
import type { HistoricalPage } from "@/lib/historical-api";
import {
  eventRecordFacts,
  addressURL,
  sourceURL,
  type RecordSource,
} from "@/lib/record-navigation";
import { recordedHeadline } from "@/lib/record-presentation";
import {
  recordSummaryFields,
  fieldLabel,
  recordFieldValue,
} from "@/lib/product-experience";
import { displayDate } from "@/lib/explorer-presentation";
import { short, NETWORK } from "@/lib/giwa";
import { RecordedContentPanel } from "./recorded-content";
import { SourceJSON } from "./source-json";
import { CopyButton } from "./scan-ui";

export function OtherRecordPaths({
  uid,
  source,
  ko,
}: {
  uid: string;
  source: RecordSource;
  ko: boolean;
}) {
  return (
    <nav
      className="uid-other-paths"
      aria-label={ko ? "같은 UID 추가 확인" : "Check this UID elsewhere"}
    >
      {source !== "live" && (
        <a href={sourceURL("live", "", uid)}>
          {ko ? "Live 저장 기록" : "Live stored record"}
        </a>
      )}
      {source !== "recent" && (
        <a href={sourceURL("recent", "", uid)}>
          {ko ? "Recent 이벤트" : "Recent events"}
        </a>
      )}
      <a href={sourceURL("public", "", uid)}>
        {ko
          ? "Public 체인 조회 · 별도 요청"
          : "Public chain lookup · separate request"}
      </a>
    </nav>
  );
}

/** One response, one UID. Never merges observations or promotes receipt/content evidence to eligibility. */
export function UIDConfirmation({
  live,
  events,
  uid,
  source,
  ko,
}: {
  live?: BackendDetail;
  events?: HistoricalPage;
  uid: string;
  source: RecordSource;
  ko: boolean;
}) {
  const t = (a: string, b: string) => (ko ? a : b);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [uid]);
  if (
    (live && events) ||
    (live && live.data.uid.toLowerCase() !== uid.toLowerCase())
  )
    return (
      <p role="alert">
        {t(
          "요청한 UID와 응답이 일치하지 않아 결과를 표시하지 않습니다.",
          "The response does not match the requested UID; no result is shown.",
        )}
      </p>
    );
  const info = readRecordInformation(live);
  if (info === null)
    return (
      <p role="alert">
        {t(
          "발급 정보의 출처가 일치하지 않아 표시할 수 없습니다.",
          "The issuance information does not match this record and cannot be displayed.",
        )}
      </p>
    );
  const p = live?.data;
  const rows = (events?.data ?? []).filter(
    (e) => e.uid?.toLowerCase() === uid.toLowerCase(),
  );
  const issued = rows.filter((e) => e.event === "Attested");
  const revoked = rows.filter((e) => e.event === "Revoked");
  const linked = rows.filter(
    (e) => e.event !== "Attested" && e.event !== "Revoked",
  );
  const f = p
    ? {
        schema: p.schema,
        issuer: p.issuer,
        recipient: p.recipient,
        issuedAt: info ? info.issuance.issuedAt : p.issuedAt,
      }
    : eventRecordFacts({ ...events!, data: rows }, uid);
  const content = live?.content ?? events?.content;
  const directIssue =
    info?.issuance.status === "historical-proof" ||
    !!issued.length ||
    p?.issuanceEventObserved === true;
  const knownIssue = directIssue || p?.issued === true;
  const receipt =
    info?.dojangEvidence.level === "verified-issuance" ||
    issued.some((e) => e.receiptVerified === true);
  const fields = info
    ? recordSummaryFields(info.content.fields)
    : p
      ? recordSummaryFields(
          Object.entries(p.fields).map(([name, value]) => ({ name, value })),
        )
      : [];
  const observedAt =
    info?.content.provenance?.observedAt ??
    live?.meta.observedAt ??
    events?.meta.observedAt;
  const relation = (value: string | null, role: "issuer" | "recipient") =>
    !value ? (
      t("확인되지 않았습니다", "Not available")
    ) : (
      <span className="uid-address">
        <a title={value} href={addressURL(value, role, source)}>
          {/^0x0{40}$/i.test(value)
            ? t("지정된 수신 주소 없음", "No designated recipient")
            : short(value, 8)}
        </a>
        <CopyButton
          value={value}
          label={t("전체 주소 복사", "Copy full address")}
        />
      </span>
    );
  const view = recordedContentView(content, f.schema);
  const decoded =
    view.state === "available" && view.content.status === "decoded"
      ? view.content.fields
      : [];
  const primary = decoded.filter(
    (x) => x.type === "string" && x.value.trim() && x.value.length <= 200,
  );
  const coded = decoded.filter((x) => !primary.includes(x));
  const classification = dojangEvidenceLabel(
    info?.dojangEvidence.level ??
      (p?.classification === "dojang"
        ? "related"
        : p?.classification === "external_eas"
          ? "external-eas"
          : "unknown"),
    ko,
  );
  return (
    <article className="uid-confirmation record-product">
      <header className="record-hero">
        <div className="record-hero-top">
          <span>
            GIWA SEPOLIA /{" "}
            {source === "live"
              ? "STORED RECORD"
              : source === "recent"
                ? "RECENT EVENTS"
                : "HISTORY"}
          </span>
          <span className="record-classification">{classification}</span>
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {recordedHeadline(content, f.schema, uid, ko)}
        </h1>
        <p className="record-hero-fact">
          {info?.issuance.status === "historical-proof"
            ? t(
                "발급 당시 거래·등록 근거 확인",
                "Issuance transaction and registration evidence confirmed",
              )
            : directIssue
              ? t("발급 이벤트 확인", "Issuance event found")
              : knownIssue
                ? t("발급 기록 확인", "Issued record found")
                : t("발급 사실 미확인", "Issuance not established")}
        </p>
        <div className="record-hero-bottom">
          <p>
            {t(
              "발행자의 기록입니다. 내용의 진실성이나 현재 이용 자격을 보증하지 않습니다.",
              "An issuer’s record, not a guarantee of truth or current eligibility.",
            )}
          </p>
          <span className="record-share">
            {t("공유", "Share")}
            <CopyButton
              value={typeof location === "undefined" ? "" : location.href}
              label={t("결과 링크 복사", "Copy result link")}
            />
          </span>
        </div>
      </header>
      <div className="record-layout">
        <div className="record-main-column">
          <section className="record-content-surface">
            <div className="record-section-heading">
              <span className="record-section-index">01</span>
              <h2>{t("기록 내용", "Recorded content")}</h2>
            </div>
            {decoded.length ? (
              <>
                {primary.length ? (
                  <dl className="record-value-grid">
                    {primary.map((x) => (
                      <div key={x.name}>
                        <dt>{contentFieldLabel(x.name, ko)}</dt>
                        <dd>{x.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="record-empty-content">
                    {t(
                      "숫자 코드·식별값은 원본 필드에 표시됩니다.",
                      "Numeric codes and identifiers are listed in the original fields.",
                    )}
                  </p>
                )}
              </>
            ) : info?.content.status === "decoded" && fields.length ? (
              <dl className="record-value-grid">
                {fields.map((x) => (
                  <div key={x.name}>
                    <dt>{fieldLabel(x.name, ko)}</dt>
                    <dd>{recordFieldValue(x.name, x.value, ko)}</dd>
                  </div>
                ))}
              </dl>
            ) : content === undefined &&
              info &&
              ["invalid", "unsupported"].includes(info.content.status) ? (
              <p className="record-content-caption">
                {info.content.status === "invalid"
                  ? t(
                      "저장된 내용의 형식을 검증할 수 없습니다.",
                      "The stored content format could not be validated.",
                    )
                  : t(
                      "내용은 저장돼 있으나 아직 해석을 지원하지 않습니다.",
                      "Content is stored, but decoding is not yet supported.",
                    )}
              </p>
            ) : content !== undefined || !fields.length ? (
              <RecordedContentPanel
                value={content}
                schema={f.schema}
                ko={ko}
                presentation="summary"
                showAttribution={false}
                showDecision={false}
              />
            ) : (
              <>
                <dl className="record-value-grid">
                  {fields.map((x) => (
                    <div key={x.name}>
                      <dt>{fieldLabel(x.name, ko)}</dt>
                      <dd>{recordFieldValue(x.name, x.value, ko)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="record-content-caption">
                  {t(
                    "발행자의 입력값이며 신원 검증 결과가 아닙니다.",
                    "Issuer-entered values, not identity verification.",
                  )}
                </p>
              </>
            )}
            {!!coded.length && (
              <button
                className="record-evidence-link"
                onClick={() => {
                  const e = document.getElementById("record-advanced");
                  e?.setAttribute("open", "");
                  e?.querySelector("summary")?.focus();
                  e?.scrollIntoView({ block: "nearest" });
                }}
              >
                {t("원본 필드 보기", "View original fields")}
              </button>
            )}
          </section>
          <section className="record-state-surface">
            <div className="record-section-heading">
              <span className="record-section-index">02</span>
              <h2>{t("확인된 변경", "Observed changes")}</h2>
            </div>
            {info ? (
              <div className="record-observed-changes">
                {info.observedChanges.length ? (
                  info.observedChanges.map((c) => (
                    <div key={c.kind}>
                      <p className="record-state-main">
                        {observedChangeLabel(c.kind, ko)}
                      </p>
                      <p className="record-content-caption">
                        {c.effectiveAt
                          ? displayDate(c.effectiveAt, ko)
                          : t(
                              "변경 거래와 대체 UID는 제공되지 않습니다.",
                              "The change transaction and replacement UID are not provided.",
                            )}
                        {c.provenance.observedAt && (
                          <>
                            {" "}
                            · {t("관측", "Observed")}{" "}
                            {new Date(c.provenance.observedAt).toLocaleString(
                              ko ? "ko-KR" : "en-US",
                              { timeZone: "Asia/Seoul" },
                            )}{" "}
                            KST
                          </>
                        )}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="record-state-main">
                    {t(
                      "저장된 관측에서 확인된 변경 없음",
                      "No changes established by the stored observation",
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p className="record-state-main">
                {revoked.length
                  ? t(
                      `철회 이벤트 ${revoked.length}건 확인`,
                      `${revoked.length} revocation event(s) found`,
                    )
                  : p?.notRevoked === false
                    ? t(
                        "마지막 확인 시점에 철회됨",
                        "Revoked at last observation",
                      )
                    : p?.notExpired === false
                      ? t(
                          "마지막 확인 시점에 만료됨",
                          "Expired at last observation",
                        )
                      : t(
                          "조회 범위 내 철회 정보 없음",
                          "No revocation information in this query",
                        )}
              </p>
            )}
            <p className="record-content-caption">
              {t(
                "조회 범위 밖의 변경과 현재 유효성은 미확인입니다.",
                "Changes outside this scope and current validity are unconfirmed.",
              )}
            </p>
            {!!(issued.length + revoked.length) && (
              <ul className="record-event-timeline">
                {rows
                  .filter((e) => ["Attested", "Revoked"].includes(e.event))
                  .map((e) => (
                    <li key={e.id}>
                      <span>
                        {e.event === "Attested"
                          ? t("발급", "Issued")
                          : t("철회", "Revoked")}
                      </span>
                      <a
                        href={`${NETWORK.explorer}/tx/${e.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("거래 보기", "View transaction")}
                      </a>
                    </li>
                  ))}
              </ul>
            )}
            {!!linked.length && (
              <p className="record-content-caption">
                {t(
                  `조회 연결 ${linked.length}건 · 발급·철회와 별개`,
                  `${linked.length} lookup association(s), separate from issuance or revocation.`,
                )}
              </p>
            )}
            {events?.next && (
              <p>
                {t(
                  "다음 페이지에 이력이 더 있습니다.",
                  "More history is available on the next page.",
                )}
              </p>
            )}
          </section>
        </div>
        <aside className="record-issuance-panel">
          <h2>{t("발급 정보", "Issuance details")}</h2>
          <dl className="record-issuance-facts">
            <div>
              <dt>{t("발행자", "Issuer")}</dt>
              <dd>{relation(f.issuer, "issuer")}</dd>
            </div>
            <div>
              <dt>{t("수신자", "Recipient")}</dt>
              <dd>{relation(f.recipient, "recipient")}</dd>
            </div>
            <div>
              <dt>{t("발급 시각", "Issued at")}</dt>
              <dd>
                {f.issuedAt
                  ? displayDate(f.issuedAt, ko)
                  : t("응답에 제공되지 않음", "Not provided")}
              </dd>
            </div>
          </dl>
          <div className="record-proof-level">
            <h3>{t("발급 근거", "Issuance evidence")}</h3>
            <p>
              {receipt
                ? t(
                    "발급 거래 포함 근거 검증됨",
                    "Issuance inclusion evidence verified",
                  )
                : t(
                    "거래 포함 검증 정보 미제공",
                    "Transaction inclusion verification unavailable",
                  )}
            </p>
          </div>
          <p className="record-content-caption">
            {t("관측 시각", "Observed at")}
            <br />
            {observedAt
              ? new Date(observedAt).toLocaleString(ko ? "ko-KR" : "en-US", {
                  timeZone: "Asia/Seoul",
                }) + " KST"
              : t("미제공", "Unavailable")}
          </p>
        </aside>
      </div>
      <section className="record-followup">
        <h2>{t("다른 출처 조회", "Other sources")}</h2>
        <OtherRecordPaths uid={uid} source={source} ko={ko} />
      </section>
      <details className="uid-advanced" id="record-advanced">
        <summary>
          {t(
            "원본 필드·거래·검증 근거",
            "Original fields, transactions & evidence",
          )}
        </summary>
        <div className="record-technical-id">
          <span>UID</span>
          <code>{uid}</code>
          <CopyButton value={uid} label={t("UID 복사", "Copy UID")} />
        </div>
        <div className="record-technical-id">
          <span>Schema UID</span>
          <code>{f.schema}</code>
        </div>
        {info && (
          <dl className="record-technical-values">
            {info.issuance.blockNumber !== null && (
              <div>
                <dt>{t("발급 블록", "Issuance block")}</dt>
                <dd>{info.issuance.blockNumber}</dd>
              </div>
            )}
            {info.issuance.transactionHash && (
              <div>
                <dt>{t("발급 거래", "Issuance transaction")}</dt>
                <dd>
                  <a
                    href={`${NETWORK.explorer}/tx/${info.issuance.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("거래 보기", "View transaction")}
                  </a>
                </dd>
              </div>
            )}
            {info.provenance.map((v, i) => (
              <div key={i}>
                <dt>
                  {v.source === "historical-issuance"
                    ? t("발급 근거", "Issuance evidence")
                    : v.source === "live-observation"
                      ? t("내용·변경 관측", "Content and changes observation")
                      : v.source === "live-evaluation"
                        ? t("선택 상태 평가", "Selection evaluation")
                        : t("분류 근거", "Classification evidence")}
                </dt>
                <dd>
                  {t("블록", "Block")} {v.blockNumber}{" "}
                  {v.observedAt
                    ? new Date(v.observedAt).toLocaleString(
                        ko ? "ko-KR" : "en-US",
                        { timeZone: "Asia/Seoul" },
                      ) + " KST"
                    : ""}
                  <code>{v.blockHash}</code>
                </dd>
              </div>
            ))}
          </dl>
        )}
        {!!coded.length && (
          <dl className="record-technical-values">
            {coded
              .filter((x) => x.type !== "bytes32")
              .map((x) => (
                <div key={x.name}>
                  <dt>{contentFieldLabel(x.name, ko)}</dt>
                  <dd>{x.value}</dd>
                </div>
              ))}
          </dl>
        )}
        {rows.map((e) => (
          <div className="uid-technical-event" key={e.id}>
            <strong>{e.event}</strong>
            <span>
              {e.blockNumber} · {e.logIndex}
            </span>
            <a
              href={`${NETWORK.explorer}/tx/${e.transactionHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("거래 보기", "View transaction")}
            </a>
          </div>
        ))}
        <RecordedContentPanel
          value={content}
          schema={f.schema}
          ko={ko}
          presentation="evidence"
          showDecision={false}
        />
        <SourceJSON
          value={live ?? events}
          name={`record-${uid}.json`}
          ko={ko}
        />
      </details>
    </article>
  );
}
