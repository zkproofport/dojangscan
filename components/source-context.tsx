import { useEffect, useState } from "react";
import { usePreferences } from "@/lib/preferences";
import {
  addressURL,
  recordSource,
  recordSources,
  sourceLabel,
  sourceURL,
  type RecordSource,
} from "@/lib/record-navigation";

export default function SourceContext({
  uid,
  source,
  showRoles = true,
}: {
  uid?: string;
  source?: RecordSource;
  showRoles?: boolean;
}) {
  const [language] = usePreferences();
  const ko = language === "ko";
  const [search, setSearch] = useState(
    typeof location === "undefined" ? "" : location.search,
  );
  useEffect(() => {
    const update = () => setSearch(location.search);
    window.addEventListener("record-route", update);
    return () => window.removeEventListener("record-route", update);
  }, []);
  const current = source ?? recordSource(search);
  const q = new URLSearchParams(search);
  const issuer = q.get("issuer") ?? q.get("attester");
  const recipient = q.get("recipient") ?? q.get("address");
  const address = issuer || recipient;
  return (
    <section
      className="lookup-source"
      aria-label={ko ? "조회 범위" : "Query scope"}
    >
      <label className="source-picker">
        <span>{ko ? "조회 출처" : "Source"}</span>
        <select
          value={current}
          aria-label={
            ko
              ? "같은 대상의 다른 출처 조회 · 새 탭"
              : "Same subject in another source · new tab"
          }
          onChange={(e) => {
            const next = e.target.value as RecordSource;
            if (next !== current)
              window.open(
                sourceURL(next, search, uid),
                "_blank",
                "noopener,noreferrer",
              );
          }}
        >
          {recordSources.map((s) => (
            <option key={s} value={s}>
              {sourceLabel(s, ko)}
            </option>
          ))}
        </select>
      </label>
      {showRoles &&
        !(issuer && recipient) &&
        address &&
        !uid &&
        !q.get("uid") && (
          <nav
            className="record-role-control"
            aria-label={ko ? "조회 구분" : "Lookup type"}
          >
            <a
              href={addressURL(address, "recipient", current)}
              aria-current={!issuer ? "page" : undefined}
            >
              {ko ? "수신 내역" : "Received records"}
            </a>
            <a
              href={addressURL(address, "issuer", current)}
              aria-current={issuer ? "page" : undefined}
            >
              {ko ? "발급 내역" : "Issued records"}
            </a>
          </nav>
        )}
    </section>
  );
}
