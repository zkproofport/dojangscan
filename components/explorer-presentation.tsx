import { useId, useState } from "react";
import { ArrowUpRight, Fingerprint, Search } from "lucide-react";
import { SCHEMAS, NETWORK, short } from "@/lib/giwa";
import { usePreferences } from "@/lib/preferences";
import {
  resolveExplorerSearch,
  type SearchKind,
} from "@/lib/explorer-presentation";
import { CopyButton } from "./scan-ui";

export function ExplorerSearch({
  busy,
  onSearch,
}: {
  busy: boolean;
  onSearch: (kind: SearchKind, value: string) => void;
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  const id = useId();
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<SearchKind>("uid");
  const [invalid, setInvalid] = useState(false);
  function submit() {
    const result = resolveExplorerSearch(value, kind);
    setInvalid(!result);
    if (result) onSearch(result.kind, result.value);
  }
  return (
    <section
      className="explorer-search-panel"
      aria-label={ko ? "도장 검색" : "Attestation search"}
    >
      <label className="explorer-search-label" htmlFor={id}>
        {ko ? "도장 검색" : "Attestation search"}
      </label>
      <form
        className="explorer-search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Search size={22} aria-hidden="true" />
        <select
          aria-label={ko ? "검색 기준" : "Search by"}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as SearchKind);
            setInvalid(false);
          }}
        >
          <option value="uid">{ko ? "도장 UID" : "Attestation UID"}</option>
          <option value="schema">{ko ? "도장 종류" : "Schema"}</option>
          <option value="recipient">{ko ? "수신 주소" : "Recipient"}</option>
          <option value="issuer">{ko ? "발행자" : "Issuer"}</option>
        </select>
        <input
          id={id}
          value={value}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            kind === "issuer" || kind === "recipient"
              ? ko
                ? "지갑 주소 (0x…)"
                : "Wallet address (0x…)"
              : kind === "schema"
                ? ko
                  ? "종류 이름 또는 스키마 UID"
                  : "Schema name or UID"
                : ko
                  ? "UID 입력 (0x…)"
                  : "Enter UID (0x…)"
          }
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
        />
        <button disabled={busy} type="submit">
          {ko ? "검색" : "Search"}
        </button>
      </form>
      <p
        id={`${id}-hint`}
        className={invalid ? "explorer-input-error" : "explorer-hint"}
        role={invalid ? "alert" : undefined}
      >
        {invalid
          ? ko
            ? "입력 형식 오류 · UID 64자리, 주소 40자리 16진수(0x 제외)"
            : "Invalid input · UID: 64 hex characters; address: 40 (excluding 0x)"
          : ko
            ? "도장 UID · 도장 종류 · 수신자·발행자 주소로 저장된 기록을 검색합니다. 트랜잭션 검색은 Public에서 별도로 제공됩니다."
            : "Search stored records by UID, schema, recipient or issuer. Transaction lookup is available separately in Public."}
      </p>
      <div className="explorer-suggestions">
        <span>{ko ? "스키마별 조회" : "Browse by schema"}</span>
        {SCHEMAS.map((s) => (
          <button
            type="button"
            key={s.key}
            disabled={busy}
            onClick={() => {
              setKind("schema");
              setValue(ko ? s.label : s.name);
              setInvalid(false);
              onSearch("schema", s.uid);
            }}
          >
            {ko ? s.label : s.name}
          </button>
        ))}
      </div>
    </section>
  );
}
export function AddressIdentity({
  value,
  full = false,
}: {
  value: string;
  full?: boolean;
}) {
  const [language] = usePreferences();
  return (
    <span className="explorer-address">
      <a
        href={`${NETWORK.explorer}/address/${encodeURIComponent(value)}`}
        target="_blank"
        rel="noreferrer"
        title={value}
        aria-label={`${language === "ko" ? "주소를 외부 Explorer에서 열기" : "Open address in external Explorer"}: ${value}`}
      >
        <code>{full ? value : short(value)}</code>
        <ArrowUpRight size={12} aria-hidden="true" />
      </a>
      <CopyButton
        value={value}
        label={language === "ko" ? "주소 복사" : "Copy address"}
      />
    </span>
  );
}
export function LoadingRecords({ ko }: { ko: boolean }) {
  return (
    <div role="status" aria-live="polite" className="explorer-loading">
      <p>{ko ? "저장된 도장 조회 중…" : "Loading stored attestations…"}</p>
      <div aria-hidden="true" className="explorer-skeletons">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Fingerprint size={24} />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
