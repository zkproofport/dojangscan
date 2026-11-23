import { recordedContentView, contentFieldLabel } from "@/lib/recorded-content";
import { CopyButton } from "./scan-ui";

export function RecordedContentPanel({
  value,
  schema,
  ko,
}: {
  value: unknown;
  schema: string;
  ko: boolean;
}) {
  const t = (a: string, b: string) => (ko ? a : b);
  const view = recordedContentView(value, schema);
  if (view.state !== "available")
    return (
      <div
        className="recorded-interpretation"
        role={view.state === "contract-error" ? "alert" : undefined}
      >
        <p>
          {view.state === "contract-error"
            ? t(
                "내용 해석 응답을 확인할 수 없습니다. 이 기록의 상태 판정과는 별개입니다.",
                "The content interpretation response could not be verified. This does not determine the record's status.",
              )
            : t(
                "이 API 응답에는 별도 내용 해석이 제공되지 않았습니다. 기록이 없다는 뜻은 아닙니다.",
                "This API response does not include a separate content interpretation. It does not mean the record is absent.",
              )}
        </p>
      </div>
    );
  const c = view.content;
  const primary = c.fields.filter((f) => f.type !== "bytes32");
  const identifiers = c.fields.filter((f) => f.type === "bytes32");
  const messages = {
    decoded: t(
      "저장된 값을 스키마 정의에 따라 읽은 내용입니다.",
      "Stored values interpreted using the schema definition.",
    ),
    unavailable: t(
      "해석할 저장 Payload를 제공받지 못했습니다. 기록 부재나 무효를 의미하지 않습니다.",
      "The stored payload is unavailable for interpretation. This does not establish absence or invalidity.",
    ),
    invalid: t(
      "저장값의 형식 또는 식별 정보가 맞지 않아 내용을 해석하지 못했습니다. 도장의 유효·무효 판정이 아닙니다.",
      "The stored value's format or identity did not match, so its content could not be interpreted. This is not a validity decision.",
    ),
    limited: t(
      "표시 크기 제한으로 내용 해석을 제공하지 않습니다. 도장 상태는 아래 관측 정보를 기준으로 확인합니다.",
      "Content interpretation is withheld because of the size limit. Refer to the separate observations below for record status.",
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
      <p role={c.status === "invalid" ? "status" : undefined}>
        {messages[c.status]}
      </p>
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
          <p className="fine-print">
            {t(
              "숫자 코드는 기록값 그대로 표시합니다. 의미·단위·날짜를 임의로 추정하지 않습니다.",
              "Numeric codes are shown as recorded; meanings, units and dates are not inferred.",
            )}
          </p>
        </>
      )}
      <p className="content-limitations">
        {t(
          "내용 해석은 사실성 검증이나 Dojang 적용성·서비스 이용 자격 승인이 아닙니다. 현재 판정: 확인 불가 (UNKNOWN).",
          "Content interpretation does not verify truth, Dojang applicability or service eligibility. Current decision: UNKNOWN.",
        )}
      </p>
      <details className="content-evidence">
        <summary>
          {t(
            "내용 해석 근거·식별값",
            "Interpretation evidence and identifiers",
          )}
        </summary>
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
      </details>
    </div>
  );
}
