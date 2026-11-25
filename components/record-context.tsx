import { recordKind } from "@/lib/record-presentation";
import { usePreferences } from "@/lib/preferences";
import type { ReactNode } from "react";
import { NETWORK } from "@/lib/giwa";
import { displayDate } from "@/lib/explorer-presentation";
import {
  fieldLabel,
  recordEvidence,
  chronologicalEvents,
  recordSummaryFields,
  recordFieldValue,
} from "@/lib/product-experience";
import type { BackendDetail } from "@/lib/backend-api";
import type { HistoricalPage } from "@/lib/historical-api";
import { historicalReason } from "@/lib/historical-api";
import { AddressIdentity } from "./explorer-presentation";
import { CopyButton } from "./scan-ui";

export function RecordContentPreview({
  fields,
}: {
  fields: { name: string; value: string }[];
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  const content = recordSummaryFields(fields);
  return content.length ? (
    <dl
      className="record-content-preview"
      aria-label={ko ? "발행자가 기록한 내용" : "Content recorded by issuer"}
    >
      {content.map((f) => (
        <div key={f.name}>
          <dt>{fieldLabel(f.name, ko)}</dt>
          <dd title={f.value}>
            {f.value.length > 96
              ? f.value.slice(0, 96) + "…"
              : recordFieldValue(f.name, f.value, ko)}
          </dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="record-content-missing">
      {ko
        ? "해석된 발급 내용 없음 · 상세에서 제공된 근거 확인"
        : "No decoded content · available evidence in details"}
    </p>
  );
}

export function RecordOverview({
  schema,
  issuer,
  recipient,
  issuedAt,
  fields,
  uid,
  source,
  contentSlot,
  title,
  evidenceElsewhere = false,
}: {
  schema: string;
  issuer: string | null;
  recipient: string | null;
  issuedAt: string | null;
  fields: { name: string; value: string; type?: string }[];
  uid: string;
  source: string;
  contentSlot?: ReactNode;
  title?: string;
  evidenceElsewhere?: boolean;
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  const t = (a: string, b: string) => (ko ? a : b);
  const technical = (f: (typeof fields)[number]) =>
    ["salt", "proofs", "root", "codeHash"].includes(f.name) ||
    f.type === "bytes32" ||
    (f.type?.startsWith("uint") && !["balance", "totalAmount"].includes(f.name)) ||
    /^0x[0-9a-f]{64,}$/i.test(f.value);
  const content = fields.filter((f) => !technical(f));
  const identifiers = fields.filter(technical);
  return (
    <section className="record-overview">
      <span className="record-source">{source}</span>
      <h2>{title ?? recordKind(schema, uid, ko)}</h2>
      <div className="record-content">
        <h3>{t("기록 내용", "Recorded content")}</h3>
        {contentSlot ?? (
          <>
            {content.length ? (
              <dl>
                {content.map((f) => (
                  <div key={f.name}>
                    <dt>{fieldLabel(f.name, ko)}</dt>
                    <dd>{recordFieldValue(f.name, f.value, ko)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>
                {t(
                  "읽을 수 있는 기록 내용이 아직 없습니다.",
                  "Readable record content is not yet available.",
                )}
              </p>
            )}
            {!evidenceElsewhere && !!identifiers.length && (
              <details className="content-evidence">
                <summary>
                  {t("원본 필드·식별값", "Source fields and identifiers")}
                </summary>
                <dl>
                  {identifiers.map((f) => (
                    <div key={f.name}>
                      <dt>{fieldLabel(f.name, ko)}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            <p className="fine-print">
              {t(
                "발행자의 기록이며, 내용의 사실성을 보증하지 않습니다.",
                "Issuer assertions, not a guarantee of truth.",
              )}
            </p>
          </>
        )}
      </div>
      <dl className="record-parties">
        <div>
          <dt>{t("발행자", "Issued by")}</dt>
          <dd>
            {issuer ? (
              <AddressIdentity value={issuer} role="issuer" />
            ) : (
              t("미확인", "Unknown")
            )}
          </dd>
        </div>
        <div>
          <dt>{t("수신자", "Issued to")}</dt>
          <dd>
            {!recipient ? (
              t("미확인", "Unknown")
            ) : /^0x0{40}$/i.test(recipient) ? (
              t("개별 수신 지갑 없음", "No individual recipient")
            ) : (
              <AddressIdentity value={recipient} />
            )}
          </dd>
        </div>
        <div>
          <dt>{t("발급 시점", "Issued at")}</dt>
          <dd>{displayDate(issuedAt, ko)}</dd>
        </div>
      </dl>
      <div className="record-actions">
        <span>
          {t("UID 복사", "Copy UID")}
          <CopyButton
            value={uid}
            label={t("도장 UID 복사", "Copy attestation UID")}
          />
        </span>
        <span>
          {t("공유 링크", "Share link")}
          <CopyButton
            value={typeof location === "undefined" ? "" : location.href}
            label={t("링크 복사", "Copy link")}
          />
        </span>
      </div>
    </section>
  );
}

export function RecordObservation({ detail }: { detail: BackendDetail }) {
  const [language] = usePreferences();
  const ko = language === "ko";
  const t = (a: string, b: string) => (ko ? a : b);
  const e = recordEvidence(detail);
  const p = detail.data;
  const status = {
    active: t(
      "관측상 철회·만료되지 않음",
      "Not revoked or expired in this observation",
    ),
    revoked: t("철회 관측", "Revocation observed"),
    expired: t("만료 관측", "Expiry observed"),
    unknown: t("발급 상태 확인 불가", "Issuance status unconfirmed"),
  };
  return (
    <section className="record-section">
      <h3>{t("관측된 상태", "Observed state")}</h3>
      <div className="record-state-grid">
        <div>
          <span>{t("발급 상태", "Issuance state")}</span>
          <strong>{status[e.status]}</strong>
        </div>
      </div>
      <p>
        {t("관측 시각", "Observed at")}:{" "}
        {displayDate(detail.meta.observedAt, ko)}
      </p>
      <p>
        {t("만료 시각", "Expiry time")}:{" "}
        {p.expiresAt === "0"
          ? t("설정 없음", "Not set")
          : displayDate(p.expiresAt, ko)}
        .{" "}
        {t(
          "철회 시각은 현재 API가 제공하지 않습니다.",
          "The current API does not expose a revocation timestamp.",
        )}
      </p>
    </section>
  );
}

export function RecordEvidence({ detail }: { detail: BackendDetail }) {
  const [language] = usePreferences();
  const ko = language === "ko";
  const t = (a: string, b: string) => (ko ? a : b);
  const e = recordEvidence(detail);
  return (
    <section className="record-section record-evidence">
      <h3>{t("확인 근거와 한계", "Evidence and limits")}</h3>
      <dl>
        <div>
          <dt>{t("저장된 발급 사실", "Stored issuance fact")}</dt>
          <dd>
            {e.issuance === "stored"
              ? t("확인됨", "Present")
              : t("확인 불가", "Unconfirmed")}
          </dd>
        </div>
        <div>
          <dt>{t("발급 이벤트 직접 수집", "Issuance event collected")}</dt>
          <dd>
            {e.event === "observed"
              ? t("관측됨", "Observed")
              : t("확인 불가", "Unconfirmed")}
          </dd>
        </div>
        <div>
          <dt>
            {t("이 UID의 Receipt 검증", "Receipt verification for this UID")}
          </dt>
          <dd>
            {t(
              "Live 상세 API 미제공 · 별도 Historical 근거 확인 필요",
              "Not exposed by Live detail · inspect Historical evidence separately",
            )}
          </dd>
        </div>
      </dl>
      <div className="indexer-evidence">
        {" "}
        <div>
          <span>Indexer</span>
          <strong>
            {e.index === "selected"
              ? t("관측에서 선택됨", "Selected in the observation")
              : e.index === "not-selected"
                ? t("관측에서 선택되지 않음", "Not selected in the observation")
                : t("선택 여부 확인 불가", "Selection unconfirmed")}
          </strong>
          <p>
            {t(
              "미선택은 철회가 아닙니다.",
              "Not selected does not mean revoked.",
            )}
          </p>
        </div>
      </div>
      <div className="record-limit">
        <strong>
          {t("현재 이용 자격: 확인 불가", "Current eligibility: unconfirmed")} ·
          UNKNOWN
        </strong>
        <p>
          {t(
            "ALLOW는 비활성화되어 있습니다. 부분 수집과 근거 부족을 유효·무효로 분류하지 않습니다.",
            "ALLOW is disabled. Partial coverage or missing evidence is not a valid/invalid verdict.",
          )}
        </p>
      </div>
      <section>
        <h4>{t("내부 판단 근거", "Underlying reasons")}</h4>
        <ul>
          {e.reasons.map((r, i) => (
            <li key={i}>
              {historicalReason(r, ko)} <code>{r}</code>
            </li>
          ))}
        </ul>
        {!e.reasons.length && (
          <p>
            {t(
              "추가 사유 코드 없음 · 근거 완전성을 뜻하지 않음",
              "No additional reason codes · not proof of completeness",
            )}
          </p>
        )}
      </section>
    </section>
  );
}

export function EventTimeline({
  page,
  uid,
}: {
  page: HistoricalPage;
  uid: string;
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  const t = (a: string, b: string) => (ko ? a : b);
  const events = chronologicalEvents(page.data, uid);
  return (
    <>
      <p className="fine-print">
        {t(
          "Historical · 현재 페이지를 블록·로그 순서로 표시합니다. API는 이벤트 시각을 제공하지 않습니다. 현재 상태의 전체 변화 이력이 아닙니다.",
          "Historical · this page is ordered by block and log. Event timestamps are not exposed. This is not a complete timeline of current state.",
        )}
      </p>
      {!events.length && (
        <p role="status">
          {t(
            "이 조회 범위의 연결된 이벤트 없음 · 미발급을 의미하지 않음",
            "No linked events in this query scope · not proof of non-issuance",
          )}
        </p>
      )}
      <ol className="record-timeline">
        {events.map((e) => (
          <li key={e.id}>
            <span className="timeline-marker" />
            <div>
              <strong>
                {{
                  Attested: t("발급 기록", "Issuance recorded"),
                  Revoked: t("철회 기록", "Revocation recorded"),
                  AttestationIndexed: t("Indexer 기록", "Indexer recorded"),
                }[e.event] ?? e.event}
              </strong>
              <span className="timeline-reference">
                {t("블록", "Block")} {e.blockNumber.toLocaleString()} ·{" "}
                {t("로그", "Log")} {e.logIndex}
              </span>
              <p>
                {e.receiptVerified
                  ? t(
                      "해당 이벤트 블록의 Receipt 검증 근거 있음",
                      "Receipt verification evidence for this event's block",
                    )
                  : t(
                      "로그 발견 · Receipt 검증 확인 안 됨",
                      "Log discovered · receipt verification not established",
                    )}
              </p>
              <a
                href={`${NETWORK.explorer}/tx/${e.transactionHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("트랜잭션 확인", "View transaction")}
              </a>
              <details>
                <summary>
                  {t("이벤트 식별자·원문", "Event identifiers and source")}
                </summary>
                <pre>{JSON.stringify(e, null, 2)}</pre>
              </details>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
