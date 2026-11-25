import { recordedContentView, contentFieldLabel } from "@/lib/recorded-content";
import { CopyButton } from "./scan-ui";

export function RecordedContentPanel({
  value,
  schema,
  ko,
  showDecision = true,
  showAttribution = true,
  presentation = "full",
}: {
  value: unknown;
  schema: string;
  ko: boolean;
  showDecision?: boolean;
  showAttribution?: boolean;
  presentation?: "full" | "summary" | "evidence";
}) {
  const t = (a: string, b: string) => (ko ? a : b);
  const view = recordedContentView(value, schema);
  if (view.state !== "available")
    return presentation === "evidence" ? null : (
      <div
        className="recorded-interpretation"
        role={view.state === "contract-error" ? "alert" : undefined}
      >
        <p>
          {view.state === "contract-error"
            ? t(
                "내용 해석 응답 오류 · 기록 상태와 별개",
                "Content response error · separate from record status",
              )
            : t(
                "기록 내용 미제공",
                "Record content unavailable",
              )}
        </p>
      </div>
    );
  const Evidence = presentation === "full" ? "details" : "section";
  const EvidenceTitle = presentation === "full" ? "summary" : "h3";
  const c = view.content;
  const primary = c.fields.filter((f) => f.type !== "bytes32");
  const identifiers = c.fields.filter((f) => f.type === "bytes32");
  const messages = {
    decoded: t(
      "저장된 값을 스키마 정의에 따라 읽은 내용입니다.",
      "Stored values interpreted using the schema definition.",
    ),
    unavailable: t(
      "기록 내용 미제공 · 기록 부재나 무효를 뜻하지 않습니다.",
      "Content unavailable · this does not establish absence or invalidity.",
    ),
    invalid: t(
      "저장값 형식·식별 정보 불일치로 해석할 수 없습니다. 유효성 판정은 아닙니다.",
      "Content cannot be decoded because its format or identity does not match. This is not a validity verdict.",
    ),
    limited: t(
      "크기 제한으로 내용을 표시할 수 없습니다. 기록 상태와는 별개입니다.",
      "Content exceeds the display limit. Record status is separate.",
    ),
  };
  const fieldRows = (fields: typeof c.fields) => (
    <dl className="interpreted-fields">
      {fields.map((f) => (
        <div key={f.name}>
          <dt>{contentFieldLabel(f.name, ko)}</dt>
          <dd>
            <span>
              {f.value === "" ? t("빈 문자열", "Empty string") : f.value}
            </span>
            <CopyButton
              value={f.value}
              label={t(`${f.name} 값 복사`, `Copy ${f.name}`)}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div className="recorded-interpretation">
      {presentation !== "evidence" && (
        <>
          {(presentation !== "summary" || c.status !== "decoded") && (
            <p role={c.status === "invalid" ? "status" : undefined}>
              {messages[c.status]}
            </p>
          )}
          {c.status === "decoded" && (
            <>
              {primary.length ? (
                fieldRows(primary)
              ) : (
                <p>
                  {t(
                    "이 기록은 식별값으로 구성돼 있습니다. 아래 기술 정보에서 확인할 수 있습니다.",
                    "This record contains identifiers. They are available in the technical details below.",
                  )}
                </p>
              )}
              {presentation !== "summary" && (
                <p className="fine-print">
                  {t(
                    "숫자 코드는 단위·날짜 변환 없이 표시됩니다.",
                    "Numeric codes are shown without unit or date conversion.",
                  )}
                </p>
              )}
            </>
          )}
          {showAttribution && <p className="content-limitations">
            {t(
              showDecision
                ? "내용 해석은 사실성 검증이나 Dojang 적용성·서비스 이용 자격 승인이 아닙니다. 현재 판정: 확인 불가 (UNKNOWN)."
                : "해석된 내용은 발행자의 기록이며 사실성 검증은 아닙니다.",
              showDecision
                ? "Content interpretation does not verify truth, Dojang applicability or service eligibility. Current decision: UNKNOWN."
                : "Interpreted content is an issuer assertion, not a verification of truth.",
            )}
          </p>}
        </>
      )}
      {presentation !== "summary" && (
        <Evidence className="content-evidence">
          <EvidenceTitle>
            {t(
              "내용 해석 근거·식별값",
              "Interpretation evidence and identifiers",
            )}
          </EvidenceTitle>
          {!!identifiers.length && fieldRows(identifiers)}
          {c.observation && (
            <p>
              {t("Payload 관측", "Payload observation")}:{" "}
              {new Date(c.observation.observedAt).toLocaleString(
                ko ? "ko-KR" : "en-US",
                { timeZone: "Asia/Seoul" },
              )}{" "}
              KST · {t("블록", "block")}{" "}
              {c.observation.blockNumber.toLocaleString(ko ? "ko-KR" : "en-US")}
              <br />
              {t(
                "발급 시각이나 현재 상태의 근거로 대체하지 않습니다.",
                "This does not replace issuance time or evidence of current state.",
              )}
            </p>
          )}
          <p>
            {c.definitionEvidence.kind ===
            "stored-canonical-Registered-and-receipt-set"
              ? t(
                  "저장된 Registry 등록 이벤트·Receipt 대조",
                  "Stored Registry registration event and Receipt comparison",
                )
              : t(
                  "이전에 저장한 고정 블록 Registry 응답",
                  "Previously stored fixed-block Registry response",
                )}
          </p>
          <p>
            {t(
              "Receipt root 증명·독립 제공자 검증은 수행되지 않았습니다.",
              "Receipt-root proof and independent-provider verification were not performed.",
            )}
          </p>
          <dl className="interpreted-fields">
            <div>
              <dt>
                {t("정의 관측 블록 해시", "Definition observation block hash")}
              </dt>
              <dd>
                <code>{c.definitionEvidence.blockHash}</code>
              </dd>
            </div>
            <div>
              <dt>{t("근거 파일 SHA-256", "Evidence SHA-256")}</dt>
              <dd>
                <code>{c.definitionEvidence.sourceSHA256}</code>
              </dd>
            </div>
          </dl>
          {!!c.reasons.length && (
            <p>
              {t("해석 제한 코드", "Interpretation limitation code")}:{" "}
              <code>{c.reasons.join(", ")}</code>
            </p>
          )}
        </Evidence>
      )}
    </div>
  );
}
