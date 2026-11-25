import { useId, useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { usePreferences } from "@/lib/preferences";
import {
  resolveProductLookup,
  isIssuerAddress,
} from "@/lib/product-experience";

export default function ProductHome() {
  const [language] = usePreferences();
  const ko = language === "ko";
  const t = (a: string, b: string) => (ko ? a : b);
  const id = useId();
  const [input, setInput] = useState("");
  const [role, setRole] = useState<"wallet" | "issuer">("wallet");
  const [source, setSource] = useState<"backend" | "recent">("backend");
  const [invalid, setInvalid] = useState(false);
  const target = resolveProductLookup(
    input,
    isIssuerAddress(input) ? role : "record",
    source,
  );
  return (
    <div className="product-home product-home-focused">
      <header className="product-intro">
        <span className="section-kicker">DOJANGSCAN · GIWA SEPOLIA</span>
        <h1>{t("도장 기록 확인", "Find an attestation record")}</h1>
        <p>
          {t(
            "주소로 수신·발급 기록을, UID로 개별 도장의 내용과 확인 근거를 조회합니다.",
            "Search an address for received or issued records, or a UID for a record’s content and evidence.",
          )}
        </p>
      </header>
      <section
        className="product-lookup"
        aria-label={t("기록 검색", "Record search")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setInvalid(!target);
            if (target) location.href = target.href;
          }}
        >
          <label htmlFor={id}>
            {t("지갑 주소 또는 도장 UID", "Wallet address or attestation UID")}
          </label>
          <div className="product-search-row">
            <Search size={22} aria-hidden="true" />
            <input
              id={id}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setInvalid(false);
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={invalid}
              aria-describedby={id + "-scope"}
              placeholder={t(
                "0x… 주소, UID 또는 Dojangscan 공유 링크",
                "0x… address, UID or Dojangscan share link",
              )}
            />
            <button className="primary" type="submit">
              {t("조회", "Search")} <ArrowRight size={18} />
            </button>
          </div>
          <div className="home-address-role">
            <label>
              {t("조회 범위", "Search scope")}{" "}
              <select
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as "backend" | "recent")
                }
              >
                <option value="backend">
                  {t("기존 저장 기록 (Live)", "Stored records (Live)")}
                </option>
                <option value="recent">
                  {t(
                    "최근 확정 이벤트 · 고정 구간",
                    "Recent finalized events · fixed window",
                  )}
                </option>
              </select>
            </label>
            <a href="?view=explore&source=backend&history=recent">
              {t("최근 확정 이벤트 보기", "Browse recent finalized events")} ↗
            </a>
          </div>
          <div className="home-address-role">
            <span>{t("주소 조회 역할", "Address lookup role")}</span>
            <div
              className="record-role-control"
              role="group"
              aria-label={t("주소 조회 역할", "Address lookup role")}
            >
              <button
                type="button"
                aria-pressed={role === "wallet"}
                onClick={() => setRole("wallet")}
              >
                {t("수신한 기록", "Received")}
              </button>
              <button
                type="button"
                aria-pressed={role === "issuer"}
                onClick={() => setRole("issuer")}
              >
                {t("발급한 기록", "Issued")}
              </button>
            </div>
            <span>
              {t(
                "UID·공유 링크에는 적용되지 않습니다.",
                "Does not change UID or share-link lookup.",
              )}
            </span>
          </div>
          <p
            id={id + "-scope"}
            className="product-search-context"
            aria-live="polite"
          >
            {target?.source === "recent" || (!target && source === "recent")
              ? t(
                  "최근 확정 구간의 발급·철회·Indexer 이벤트입니다. 실시간 추적이나 현재 유효성 판단이 아니며 기존 Live 기록과 합치지 않습니다.",
                  "Issuance, revocation and Indexer events in a fixed finalized window. No real-time tracking or current validity determination; separate from Live records.",
                )
              : target?.source === "public"
                ? t(
                    "이 공유 링크는 별도의 Public 조회로 연결됩니다.",
                    "This share link opens a separate Public lookup.",
                  )
                : target?.source === "history"
                  ? t(
                      "이 공유 링크는 한정된 과거 기록으로 연결됩니다. 현재 상태를 확정하지 않습니다.",
                      "This share link opens a bounded historical record, not a determination of current state.",
                    )
                  : t(
                      "저장된 기록 조회 · 지갑 연결·서명 불필요. 수집·평가되지 않은 기록은 검색되지 않습니다.",
                      "Stored records · no wallet connection or signature. Records not collected or evaluated are excluded.",
                    )}
          </p>
          {invalid && (
            <p className="notice danger" role="alert">
              {t(
                "주소(0x와 40자리), UID(0x와 64자리) 또는 도장 공유 링크를 확인하세요.",
                "Check the address (40 hex digits), UID (64 hex digits) or attestation share link.",
              )}
            </p>
          )}
        </form>
      </section>
      <p className="home-source-note">
        {t(
          "기록의 상태와 조회 기준 시각은 검색 결과에 표시됩니다. 현재 서비스 이용 자격은 확인하지 않습니다.",
          "Results include the observed state and reference time. Current service eligibility is not established.",
        )}
      </p>
      <details className="product-source-control home-secondary">
        <summary>
          {t("다른 조회·관리 도구", "Other lookup and management tools")}
        </summary>
        <nav>
          <a href="?view=explore&source=public">Public Explorer ↗</a>
          <a href="?view=explore&source=backend">
            {t("저장 데이터 탐색", "Stored data explorer")} ↗
          </a>
          <a href="?view=explore&source=backend&history=backfill">
            Historical ↗
          </a>
          <a href="?view=schemas&source=public">
            {t("스키마·ABI", "Schemas and ABI")} ↗
          </a>
          <a href="?view=issuers&mode=manage&source=public">
            {t(
              "발급·철회·권한 관리 · 서명 필요",
              "Manage issuance and permissions · signature required",
            )}{" "}
            ↗
          </a>
          <a href="?view=lab&source=public">Proof Studio ↗</a>
        </nav>
        <p>
          {t(
            "각 출처는 확인 범위가 다르며 결과를 자동으로 합치지 않습니다.",
            "Sources have separate coverage; results are not automatically combined.",
          )}
        </p>
      </details>
    </div>
  );
}
