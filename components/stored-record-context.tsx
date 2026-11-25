import { usePreferences } from "@/lib/preferences";
import { displayDate } from "@/lib/explorer-presentation";
import { addressRoleURL } from "@/lib/product-experience";
import type { BackendMeta } from "@/lib/backend-api";

/** Present limits in plain language; keep exact snapshot identifiers expandable. */
export function StoredRecordContext({
  meta,
  showDecision = true,
}: {
  meta: BackendMeta;
  showDecision?: boolean;
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  return (
    <aside
      className="stored-record-context"
      aria-label={ko ? "기록의 조회 기준" : "Record reference"}
    >
      <p className="observation-line">
        <strong>
          {meta.freshness === "stale"
            ? ko
              ? "Live 저장 기록 · 최신성 주의"
              : "Stored records · no recent observation"
            : ko
              ? "수집된 발급 기록"
              : "Collected issuance records"}
        </strong>
        <span>
          {ko ? "마지막 관측" : "Last observed"}:{" "}
          {displayDate(meta.observedAt, ko)}
        </span>
      </p>
      <p>
        {ko
          ? showDecision
            ? "일부 수집·평가된 기록만 포함합니다. 이 기록만으로 현재 이용 자격을 확인할 수 없습니다."
            : "일부 수집·평가된 기록만 포함합니다."
          : showDecision
            ? "Only collected and evaluated records are included. This record alone does not establish current eligibility."
            : "Only collected and evaluated records are included."}
      </p>
      <details>
        <summary>
          {ko ? "조회 범위와 기술 기준" : "Scope and technical reference"}
        </summary>
        <p>
          {ko
            ? "저장된 평가 결과(projection)만 조회합니다. 미평가 UID·수집 범위 밖 기록은 제외되며, 빈 결과는 전체 체인의 기록 부재를 뜻하지 않습니다."
            : "Queries stored projections only. Unevaluated UIDs and records outside coverage are excluded; an empty result does not establish absence across the chain."}
        </p>
        <dl>
          <div>
            <dt>
              {ko ? "연속 평가 완료 블록" : "Contiguously evaluated through"}
            </dt>
            <dd>{meta.evaluatedBlock?.toLocaleString() ?? "UNKNOWN"}</dd>
          </div>
          <div>
            <dt>{ko ? "수집 범위" : "Collection scope"}</dt>
            <dd>
              {meta.coverage.raw_complete
                ? ko
                  ? "Raw 수집 완료"
                  : "Raw complete"
                : ko
                  ? "부분 수집"
                  : "Partial coverage"}
            </dd>
          </div>
          <div>
            <dt>Generation</dt>
            <dd>{meta.projectionGeneration ?? "UNKNOWN"}</dd>
          </div>
          <div>
            <dt>Current Decision</dt>
            <dd>UNKNOWN · ALLOW disabled</dd>
          </div>
        </dl>
      </details>
    </aside>
  );
}

export function AddressRoleControl({
  recipient,
  value,
}: {
  recipient: boolean;
  value: string;
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  return (
    <nav
      className="record-role-control"
      aria-label={ko ? "조회 구분" : "Lookup type"}
    >
      <a
        aria-current={recipient ? "page" : undefined}
        href={addressRoleURL(value, true)}
      >
        {ko ? "수신 내역" : "Received records"}
      </a>
      <a
        aria-current={!recipient ? "page" : undefined}
        href={addressRoleURL(value, false)}
      >
        {ko ? "발급 내역" : "Issued records"}
      </a>
    </nav>
  );
}

export function AddressRecordSearch({
  recipient,
  value,
  busy,
  onChange,
  onSubmit,
}: {
  recipient: boolean;
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  return (
    <section className="product-lookup issuer-lookup address-lookup">
      <h1>{ko ? "주소별 기록 조회" : "Records by address"}</h1>
      <p>
        {ko
          ? "주소의 수신·발급 내역을 조회합니다. 지갑 연결·서명은 필요하지 않습니다."
          : "Look up received and issued records. No wallet connection or signature required."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="record-address">
          {ko ? "조회할 주소" : "Address to look up"}
        </label>
        <div className="product-search-row">
          <input
            id="record-address"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0x…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button className="primary" disabled={busy}>
            {ko ? "기록 조회" : "Find records"}
          </button>
        </div>
      </form>
      <AddressRoleControl recipient={recipient} value={value} />
      {!recipient && (
        <a
          className="management-shortcut"
          href="?view=issuers&source=public&mode=manage"
        >
          {ko
            ? "발급·철회·권한 관리 · 서명 필요"
            : "Issuance and permissions · signature required"}{" "}

        </a>
      )}
    </section>
  );
}

export function EmptyStoredRecords({
  meta,
  recipient,
  address,
  filtered,
  onClear,
  onEdit,
  onPublic,
}: {
  meta: BackendMeta;
  recipient?: boolean;
  address?: string;
  filtered: boolean;
  onClear: () => void;
  onEdit: () => void;
  onPublic: () => void;
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  return (
    <section
      className="empty-stored-records"
      aria-label={ko ? "검색 결과" : "Search result"}
    >
      <h2>
        {ko
          ? "일치하는 저장 기록 없음"
          : "No matching stored records"}
      </h2>
      <p>
        {ko
          ? "현재 수집·평가된 범위의 결과입니다. 전체 체인에 도장이 없다는 뜻은 아닙니다."
          : "This result covers collected and evaluated records. It does not mean that no attestations exist across the chain."}
      </p>
      <StoredRecordContext meta={meta} />
      <div className="empty-record-actions">
        <button onClick={onEdit}>
          {ko ? "다른 주소·조건 조회" : "Change address or query"}
        </button>
        {address && (
          <a href={addressRoleURL(address, !recipient)}>
            {recipient
              ? ko
                ? "이 주소의 발급 기록"
                : "Records issued by this address"
              : ko
                ? "이 주소의 수신 기록"
                : "Records received by this address"}{" "}

          </a>
        )}
        {filtered && (
          <button onClick={onClear}>
            {ko ? "추가 필터 해제" : "Clear additional filters"}
          </button>
        )}
        <button className="text-button" onClick={onPublic}>
          {ko ? "공개 체인에서 조회" : "Look up on the public chain"}
        </button>
      </div>
    </section>
  );
}
